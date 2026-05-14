import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Timer, BarChart3, FileText, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import { formatPct01 } from '../utils/srsQualityCopy';

/** Weights for a single “how close did the draft heuristics look” score (0–1 each). */
const W_HEURISTIC_ACCURACY = 0.45;
const W_INPUT_TOKEN_F1 = 0.35;
const W_SECTION_HEADING_F1 = 0.2;
/** Composite at/above this is labeled “good” when alignment does not force review. */
const COMPOSITE_GOOD_MIN = 0.52;
/** Between this and COMPOSITE_GOOD_MIN → “mixed”. Below → “weak”. */
const COMPOSITE_FAIR_MIN = 0.38;

function pick01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

/**
 * One-line overall verdict for the model-run heuristic block.
 * Alignment “review suggested” always wins over a high composite (human check still needed).
 */
function computeOverallModelVerdict(qs) {
  if (!qs || typeof qs !== 'object') return null;

  const review = !!(qs.alignment_review_recommended ?? qs.hallucination_has_potential);
  const ha = pick01(qs.heuristic_accuracy);
  const fi = pick01(qs.input_token_f1);
  const fs = pick01(qs.section_heading_f1);

  let w = 0;
  let sum = 0;
  if (ha !== null) {
    w += W_HEURISTIC_ACCURACY;
    sum += W_HEURISTIC_ACCURACY * ha;
  }
  if (fi !== null) {
    w += W_INPUT_TOKEN_F1;
    sum += W_INPUT_TOKEN_F1 * fi;
  }
  if (fs !== null) {
    w += W_SECTION_HEADING_F1;
    sum += W_SECTION_HEADING_F1 * fs;
  }
  const composite = w > 0 ? sum / w : null;

  if (review) {
    return {
      headline: 'Review recommended',
      tone: 'review',
      composite,
      review: true,
      caption:
        'Alignment monitoring wants a pass against your source. That outweighs a strong heuristic score—treat this as “needs human check”, not pass/fail from percentages alone.',
    };
  }
  if (composite === null) {
    return {
      headline: 'Overall score unavailable',
      tone: 'unknown',
      composite: null,
      review: false,
      caption: 'Fill in heuristic accuracy / F1 fields to compute the blended bar.',
    };
  }
  if (composite >= COMPOSITE_GOOD_MIN) {
    return {
      headline: 'Good heuristic match',
      tone: 'good',
      composite,
      review: false,
      caption: `Blended score ${formatPct01(composite)} meets the “good” band (≥ ${formatPct01(COMPOSITE_GOOD_MIN)}), using the weights below.`,
    };
  }
  if (composite >= COMPOSITE_FAIR_MIN) {
    return {
      headline: 'Mixed / acceptable',
      tone: 'fair',
      composite,
      review: false,
      caption: `Blended score ${formatPct01(composite)} is between “fair” (${formatPct01(COMPOSITE_FAIR_MIN)}) and “good” (${formatPct01(COMPOSITE_GOOD_MIN)}).`,
    };
  }
  return {
    headline: 'Weak heuristic match',
    tone: 'weak',
    composite,
    review: false,
    caption: `Blended score ${formatPct01(composite)} is below the “fair” line (${formatPct01(COMPOSITE_FAIR_MIN)}).`,
  };
}

/**
 * Generation-time model performance / quality_scores matrix (from srs.generation_meta).
 * Kept out of the main SRS document view — open from the sidebar when you want to inspect runs.
 */
const SrsModelRunPage = ({ srsData }) => {
  const modelRunSummary = useMemo(() => {
    const gm = srsData?.generation_meta;
    if (!gm || typeof gm !== 'object') return null;
    const mp = gm.model_performance;
    const qs = gm.quality_scores;
    const interp =
      typeof gm.model_performance_interpretation === 'string' ? gm.model_performance_interpretation.trim() : '';
    const qInterp =
      typeof gm.quality_scores_interpretation === 'string' ? gm.quality_scores_interpretation.trim() : '';
    const hasMp = mp && typeof mp === 'object' && Object.keys(mp).length > 0;
    const hasQs = qs && typeof qs === 'object' && Object.keys(qs).length > 0;
    if (!hasMp && !interp && !hasQs && !qInterp) return null;
    return { mp: hasMp ? mp : {}, qs: hasQs ? qs : {}, interp, qInterp };
  }, [srsData?.generation_meta]);

  const overallVerdict = useMemo(() => {
    const qs = modelRunSummary?.qs;
    if (!qs || typeof qs !== 'object' || Object.keys(qs).length === 0) return null;
    return computeOverallModelVerdict(qs);
  }, [modelRunSummary]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 rounded-xl bg-r2d-primary/15 p-3 text-r2d-primary dark:text-amber-300">
            <Timer className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Model run</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              Heuristic precision/recall/F1, alignment monitoring, and provider timings from{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {srsData?.document_id || 'the active SRS'}
              </span>
              . Loaded from this SRS object only (no extra request). Switch documents on the SRS page to refresh numbers.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            to="/srs"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80"
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            SRS document
          </Link>
          <Link
            to="/srs-metrics"
            className="inline-flex items-center gap-2 rounded-lg bg-r2d-primary text-white px-4 py-2.5 text-sm font-medium hover:bg-r2d-primaryLight shadow-sm"
          >
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
            SRS quality metrics
          </Link>
        </div>
      </div>

      {!modelRunSummary ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-900/50 p-8 text-center">
          <p className="text-slate-700 dark:text-slate-300 font-medium">No model run metadata on this SRS yet</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Generate or load an SRS that includes <span className="font-mono text-xs">generation_meta</span> (model
            performance / quality scores) to see the matrix here.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/generate-srs"
              className="inline-flex items-center justify-center rounded-lg bg-r2d-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-r2d-primaryLight"
            >
              Generate SRS
            </Link>
            <Link
              to="/history"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Load from history
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-5">
            generation_meta snapshot · {srsData?.document_id || '—'}
          </p>

          {overallVerdict ? (
            <div
              className={`mb-6 rounded-xl border p-4 sm:p-5 ${
                overallVerdict.tone === 'good'
                  ? 'border-emerald-300/90 bg-emerald-50/80 dark:border-emerald-700/80 dark:bg-emerald-950/25'
                  : overallVerdict.tone === 'fair'
                    ? 'border-amber-300/90 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/25'
                    : overallVerdict.tone === 'weak'
                      ? 'border-rose-300/90 bg-rose-50/80 dark:border-rose-800/70 dark:bg-rose-950/25'
                      : overallVerdict.tone === 'review'
                        ? 'border-amber-400 bg-amber-50/90 dark:border-amber-600 dark:bg-amber-950/35'
                        : 'border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 mt-0.5" aria-hidden>
                    {overallVerdict.tone === 'good' ? (
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    ) : overallVerdict.tone === 'review' ? (
                      <AlertTriangle className="h-8 w-8 text-amber-700 dark:text-amber-300" />
                    ) : (
                      <Activity className="h-8 w-8 text-slate-600 dark:text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Overall model run (heuristic)
                    </p>
                    <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
                      {overallVerdict.headline}
                    </h2>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/95 leading-relaxed">
                      {overallVerdict.caption}
                    </p>
                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Blended score weights: heuristic accuracy {Math.round(W_HEURISTIC_ACCURACY * 100)}%, input-token
                      F1 {Math.round(W_INPUT_TOKEN_F1 * 100)}%, section-heading F1 {Math.round(W_SECTION_HEADING_F1 * 100)}
                      %. Bands: below {formatPct01(COMPOSITE_FAIR_MIN)} = weak; {formatPct01(COMPOSITE_FAIR_MIN)}–
                      {formatPct01(COMPOSITE_GOOD_MIN)} = mixed; ≥ {formatPct01(COMPOSITE_GOOD_MIN)} = good — unless
                      alignment review is suggested (then always “review recommended”).
                    </p>
                  </div>
                </div>
                {typeof overallVerdict.composite === 'number' ? (
                  <div className="shrink-0 w-full sm:w-52">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Blended score
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                      {formatPct01(overallVerdict.composite)}
                    </p>
                    <div className="relative mt-3 h-2.5 rounded-full bg-slate-200/90 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          overallVerdict.tone === 'good'
                            ? 'bg-emerald-500'
                            : overallVerdict.tone === 'fair'
                              ? 'bg-amber-500'
                              : overallVerdict.tone === 'weak'
                                ? 'bg-rose-500'
                                : overallVerdict.tone === 'review'
                                  ? 'bg-amber-600'
                                  : 'bg-slate-500'
                        }`}
                        style={{ width: `${Math.round(overallVerdict.composite * 100)}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-px bg-slate-700/35 dark:bg-white/25"
                        style={{ left: `${COMPOSITE_FAIR_MIN * 100}%` }}
                        title={`Fair threshold ${formatPct01(COMPOSITE_FAIR_MIN)}`}
                      />
                      <div
                        className="absolute top-0 h-full w-px bg-slate-900/45 dark:bg-white/35"
                        style={{ left: `${COMPOSITE_GOOD_MIN * 100}%` }}
                        title={`Good threshold ${formatPct01(COMPOSITE_GOOD_MIN)}`}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>0%</span>
                      <span>Fair {formatPct01(COMPOSITE_FAIR_MIN)}</span>
                      <span>Good {formatPct01(COMPOSITE_GOOD_MIN)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {modelRunSummary.qInterp ? (
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed border-l-4 border-emerald-600/70 dark:border-emerald-400/80 pl-3 mb-5">
              {modelRunSummary.qInterp}
            </p>
          ) : null}
          {modelRunSummary.interp ? (
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed border-l-4 border-r2d-primary pl-3 mb-5">
              {modelRunSummary.interp}
            </p>
          ) : null}
          {Object.keys(modelRunSummary.qs).length > 0 ? (
            <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="border-b border-slate-200 dark:border-slate-600 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Precision / recall / F1 (heuristic)
                </p>
                {modelRunSummary.qs.notes ? (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-snug">{modelRunSummary.qs.notes}</p>
                ) : null}
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium w-[min(22rem,45%)]">Metric</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600 bg-white/70 dark:bg-slate-900/40">
                  <tr className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Section heading precision</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPct01(modelRunSummary.qs.section_heading_precision)}
                    </td>
                  </tr>
                  <tr className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Section heading recall</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPct01(modelRunSummary.qs.section_heading_recall)}
                    </td>
                  </tr>
                  <tr className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Section heading F1</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPct01(modelRunSummary.qs.section_heading_f1)}
                    </td>
                  </tr>
                  <tr className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Input-token precision</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPct01(modelRunSummary.qs.input_token_precision)}
                    </td>
                  </tr>
                  <tr className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Input-token recall</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPct01(modelRunSummary.qs.input_token_recall)}
                    </td>
                  </tr>
                  <tr className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Input-token F1</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPct01(modelRunSummary.qs.input_token_f1)}
                    </td>
                  </tr>
                  <tr className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Heuristic accuracy</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPct01(modelRunSummary.qs.heuristic_accuracy)}
                    </td>
                  </tr>
                  <tr className="text-slate-800 dark:text-slate-100 align-top">
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">Alignment (review-tier)</td>
                    <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">
                      <div className="font-medium">
                        {(modelRunSummary.qs.alignment_review_recommended ?? modelRunSummary.qs.hallucination_has_potential)
                          ? 'Review suggested'
                          : 'None required'}
                      </div>
                      {typeof modelRunSummary.qs.hallucination_grounding_confidence === 'number' ? (
                        <div className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Grounding overlap {formatPct01(modelRunSummary.qs.hallucination_grounding_confidence)} · review
                          notes{' '}
                          {modelRunSummary.qs.alignment_review_notes_count ??
                            modelRunSummary.qs.hallucination_flags_count ??
                            0}
                          {typeof modelRunSummary.qs.alignment_informational_notes_count === 'number' &&
                          modelRunSummary.qs.alignment_informational_notes_count > 0 ? (
                            <span> · FYI only {modelRunSummary.qs.alignment_informational_notes_count}</span>
                          ) : null}
                          {modelRunSummary.qs.grounding_monitoring_strictness ? (
                            <span> · monitor={String(modelRunSummary.qs.grounding_monitoring_strictness)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
          {Object.keys(modelRunSummary.mp).length > 0 || Object.keys(modelRunSummary.qs).length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-3 pt-3">
                All raw fields
              </p>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Metric</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {Object.entries({
                    ...Object.fromEntries(Object.entries(modelRunSummary.qs).filter(([k]) => k !== 'notes')),
                    ...modelRunSummary.mp,
                  })
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => (
                      <tr key={k} className="text-slate-800 dark:text-slate-100">
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {k}
                        </td>
                        <td className="px-3 py-2 break-all">{typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SrsModelRunPage;

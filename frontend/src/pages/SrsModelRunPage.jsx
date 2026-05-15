import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Timer, BarChart3, FileText } from 'lucide-react';
import { formatPct01 } from '../utils/srsQualityCopy';
import PresentationRouteSplash from '../components/PresentationRouteSplash';

/**
 * Read-only inspection of `generation_meta` bundled at SRS creation time: provider timings,
 * `quality_scores` heuristics, and the raw key/value dump for advanced reviewers.
 *
 * Blended overall-model-run interpretation lives on the server as
 * `generation_meta.overall_model_run_heuristic` (see `overall_model_run_heuristic.py`).
 */

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

  return (
    <PresentationRouteSplash
      title="Model run metrics"
      subtitle="Loading generation snapshot, heuristics, and alignment notes…"
      icon={Timer}
      delayMs={2600}
    >
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 rounded-xl bg-r2d-primary/15 p-3 text-r2d-primary dark:text-sky-300">
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
          {Object.keys(modelRunSummary.mp).length > 0 ||
          Object.keys(modelRunSummary.qs).length > 0 ||
          (srsData?.generation_meta?.overall_model_run_heuristic &&
            typeof srsData.generation_meta.overall_model_run_heuristic === 'object') ? (
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
                    ...(srsData?.generation_meta?.overall_model_run_heuristic &&
                    typeof srsData.generation_meta.overall_model_run_heuristic === 'object'
                      ? {
                          overall_model_run_heuristic: JSON.stringify(
                            srsData.generation_meta.overall_model_run_heuristic,
                            null,
                            2
                          ),
                        }
                      : {}),
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
    </PresentationRouteSplash>
  );
};

export default SrsModelRunPage;

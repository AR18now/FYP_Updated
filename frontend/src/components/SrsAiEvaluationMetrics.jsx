import React, { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { FlaskConical, Loader2, Download, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import config from '../config';
import { getApiErrorMessage } from '../utils/apiErrors';

/**
 * Optional srs_eval integration: on-demand POST to `SRS_EVAL_EXISTING` for structured metric cards.
 * Includes helper prompt builders; distinct from the lighter dashboard bundle in `srsDashboardClient`.
 */

/** Maps a 0–1 score to Tailwind color classes for compact metric cards. */
function scoreTone(score, skipped) {
  if (skipped) return { bar: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-400', label: 'N/A' };
  if (score >= 0.72) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'Good' };
  if (score >= 0.45) return { bar: 'bg-amber-500', text: 'text-amber-800 dark:text-amber-200', label: 'Moderate' };
  return { bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', label: 'Needs work' };
}

function MetricCard({ metric }) {
  const skipped = metric.skipped === true || metric.score === null || metric.score === undefined;
  const s = typeof metric.score === 'number' ? metric.score : 0;
  const tone = scoreTone(s, skipped);
  const pct = skipped ? 0 : Math.round(Math.min(100, Math.max(0, s * 100)));

  return (
    <article className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900/80 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-r2d-border dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{metric.name}</h3>
            {metric.score_label && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{metric.score_label}</p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tone.text} bg-white dark:bg-slate-900 border border-current/20`}>
            {tone.label}
          </span>
        </div>
        {!skipped && (
          <>
            <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] font-mono text-slate-500">Score (0–100): {pct}</p>
          </>
        )}
        {!skipped && metric.score_secondary != null && metric.key === 'hallucination' && (
          <p className="text-[10px] text-slate-500 mt-1">
            Hallucination rate: {(metric.score_secondary * 100).toFixed(1)}% of lines (lower is better)
          </p>
        )}
      </div>
      <div className="px-4 py-3 space-y-2 text-xs flex-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">What this means</p>
          <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{metric.what_this_means}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">How it was calculated</p>
          <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{metric.how_calculated}</p>
        </div>
        {metric.highlights?.warnings?.length > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
            <p className="text-[10px] font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Notes
            </p>
            <ul className="mt-0.5 list-disc list-inside text-amber-950/90 dark:text-amber-100/90 text-[10px] space-y-0.5">
              {metric.highlights.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {metric.highlights?.examples?.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Info className="h-3 w-3" /> Examples
            </p>
            <ul className="mt-1 space-y-1">
              {metric.highlights.examples.map((ex, i) => (
                <li key={i} className="text-[10px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                  {ex.type === 'flagged_line' && <span className="text-rose-600 dark:text-rose-400 font-sans font-medium">Flagged: </span>}
                  {ex.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

/** Join processed requirement items into one string for evaluation context. */
export function buildRequirementsPromptFromResults(resultsData) {
  if (!resultsData) return '';
  let arr = [];
  if (Array.isArray(resultsData)) arr = resultsData;
  else if (resultsData.results && Array.isArray(resultsData.results)) arr = resultsData.results;
  else if (resultsData.status) arr = [resultsData];
  else arr = [resultsData];
  const parts = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const t = item.original_text || item.content || item.text || item.requirement || '';
    if (typeof t === 'string' && t.trim()) parts.push(t.trim());
  }
  return parts.join('\n\n');
}

/**
 * Collapsible panel: runs AI metrics on the current SRS vs requirements text (`SRS_EVAL_EXISTING`).
 */
export default function SrsAiEvaluationMetrics({ srsData, currentResults }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const srsText = useMemo(() => {
    let t = srsData?.raw_text || srsData?.sections?._raw_text || '';
    if (!String(t).trim() && srsData?.sections && typeof srsData.sections === 'object') {
      try {
        t = JSON.stringify(srsData.sections);
      } catch {
        t = '';
      }
    }
    return String(t || '');
  }, [srsData]);

  const prompt = useMemo(() => buildRequirementsPromptFromResults(currentResults), [currentResults]);

  const canRun = srsText.trim().length >= 80;

  const runEval = useCallback(async () => {
    const p = prompt.trim() || 'User-provided requirements (see SRS).';
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const { data } = await axios.post(
        config.API_ENDPOINTS.SRS_EVAL_EXISTING,
        { prompt: p, srs_text: srsText },
        { timeout: 180000 }
      );
      setResult(data);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Evaluation service unavailable. Start: cd srs_eval_service && uvicorn app:app --port 8010'));
    } finally {
      setLoading(false);
    }
  }, [prompt, srsText]);

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `srs-ai-eval-${result.run_id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const metrics = result?.metrics || [];

  return (
    <div className="mb-6 rounded-xl border border-teal-200/80 dark:border-teal-900/50 bg-teal-50/40 dark:bg-slate-900/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-teal-100/50 dark:hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FlaskConical className="h-5 w-5 text-teal-700 dark:text-teal-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI evaluation metrics</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              Instruction adherence, hallucination, context match, coherence (on this SRS vs your requirements)
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-teal-200/60 dark:border-teal-900/40 space-y-4">
          {!canRun && (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
              Need SRS text and processed requirements. Go back to <strong>Processing results</strong> if needed, then return here.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || !canRun}
              onClick={runEval}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white px-4 py-2 text-sm font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              {loading ? 'Analyzing…' : 'Run metrics on this SRS'}
            </button>
            {result && (
              <button
                type="button"
                onClick={downloadJson}
                className="inline-flex items-center gap-2 rounded-lg border border-r2d-border bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5" />
                Download JSON
              </button>
            )}
          </div>
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </p>
          )}
          {result && (
            <>
              <p className="text-[11px] text-slate-500">
                Run <span className="font-mono">{result.run_id}</span> · {result.timing_seconds}s
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {metrics.map((m) => (
                  <MetricCard key={m.key} metric={m} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

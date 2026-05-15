import React, { useMemo, useState, useCallback } from 'react';
import { BarChart3, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { getApiErrorMessage } from '../utils/apiErrors';
import { DOC_QUALITY_METRIC_ROWS, formatPct01 } from '../utils/srsQualityCopy';
import { collectPromptFromResults, postSrsDashboardWithFallback } from '../utils/srsDashboardClient';

/** Pulls `generation_meta` slices out of a stored SRS snapshot for compact display in expert UI. */
function buildModelRunSummary(srs) {
  const gm = srs?.generation_meta;
  if (!gm || typeof gm !== 'object') return null;
  const mp = gm.model_performance;
  const qs = gm.quality_scores;
  const interp = typeof gm.model_performance_interpretation === 'string' ? gm.model_performance_interpretation.trim() : '';
  const qInterp = typeof gm.quality_scores_interpretation === 'string' ? gm.quality_scores_interpretation.trim() : '';
  const hasMp = mp && typeof mp === 'object' && Object.keys(mp).length > 0;
  const hasQs = qs && typeof qs === 'object' && Object.keys(qs).length > 0;
  if (!hasMp && !interp && !hasQs && !qInterp) return null;
  return { mp: hasMp ? mp : {}, qs: hasQs ? qs : {}, interp, qInterp };
}

/**
 * Same matrices / quality signals the author saw next to the SRS: dashboard snapshot,
 * generation-time model metrics, and optional on-demand refresh for older queue items.
 */
const ExpertSrsSnapshotMetrics = ({ snapshot, currentResults }) => {
  const [open, setOpen] = useState(false);
  const [fetchedDash, setFetchedDash] = useState(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState(null);

  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};

  const dashboard = fetchedDash || snap.srs_dashboard_snapshot || null;
  const kb = dashboard?.kb_metrics;
  const hall = snap.hallucination_analysis || snap.sections?._hallucination_analysis || dashboard?.hallucination_analysis;
  const modelRun = useMemo(() => buildModelRunSummary(snap), [snapshot]);

  const canFetchDashboard =
    String(snap.raw_text || '').trim().length >= 40 || String(JSON.stringify(snap.sections || {})).length >= 40;

  const hasAnyStoredSignals = !!(
    snap.srs_dashboard_snapshot ||
    modelRun ||
    (hall && typeof hall === 'object' && Object.keys(hall).length > 0) ||
    snap.verification_report
  );

  const loadDashboard = useCallback(async () => {
    setDashError(null);
    setLoadingDash(true);
    try {
      const raw = String(snap.raw_text || '').trim();
      const fallback = (() => {
        try {
          return JSON.stringify(snap.sections || {}, null, 0);
        } catch {
          return '';
        }
      })();
      const text = raw.length >= 40 ? raw : String(fallback || '').trim();
      if (text.length < 40) {
        setDashError('Not enough SRS text in this snapshot to compute quality tables.');
        setLoadingDash(false);
        return;
      }
      const prompt = collectPromptFromResults(currentResults);
      const res = await postSrsDashboardWithFallback({
        srs: {
          raw_text: snap.raw_text,
          sections: snap.sections,
          hallucination_analysis: snap.hallucination_analysis || snap.sections?._hallucination_analysis,
          verification_report: snap.verification_report,
        },
        prompt: prompt || text.slice(0, 4000),
      });
      setFetchedDash(res.data || null);
    } catch (e) {
      setDashError(getApiErrorMessage(e, 'Could not load quality matrices from the server.'));
    } finally {
      setLoadingDash(false);
    }
  }, [snap, currentResults]);

  const ieeeRows = useMemo(() => {
    const ieee = snap.verification_report?.ieee_metrics;
    if (!ieee || typeof ieee !== 'object') return [];
    return Object.entries(ieee)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => ({ k, v }))
      .slice(0, 40);
  }, [snap.verification_report]);

  if (!hasAnyStoredSignals && !canFetchDashboard) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2">
        No saved quality matrices for this submission (SRS text is also too short to recompute here).
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <BarChart3 className="h-4 w-4 text-r2d-primary shrink-0" aria-hidden />
          {"Author's matrices and model metrics"}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-200 dark:border-slate-600 space-y-4 text-sm">
          {canFetchDashboard && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
              <button
                type="button"
                onClick={loadDashboard}
                disabled={loadingDash}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {loadingDash ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {dashboard ? 'Refresh tables from server' : 'Load same tables as SRS viewer'}
              </button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Newer submissions include a frozen copy when the author sent for review. Use the button to fetch or refresh from the API.
              </span>
            </div>
          )}
          {dashError && (
            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded px-2 py-1.5 border border-rose-200 dark:border-rose-800">
              {dashError}
            </p>
          )}

          {dashboard?.summary_line && (
            <p className="text-sm text-slate-700 dark:text-slate-200 border-l-4 border-r2d-primary pl-3">{dashboard.summary_line}</p>
          )}

          {kb && typeof kb === 'object' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Document wording (KB)</p>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-600">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-2 font-medium">Metric</th>
                      <th className="px-2 py-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {DOC_QUALITY_METRIC_ROWS.map((row) => {
                      const v = kb[row.key];
                      if (v === undefined || v === null || Number.isNaN(Number(v))) return null;
                      return (
                        <tr key={row.key}>
                          <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100">{row.label}</td>
                          <td className="px-2 py-1.5 font-mono tabular-nums">{formatPct01(v)}</td>
                        </tr>
                      );
                    })}
                    {typeof kb.arm_overall_score === 'number' && (
                      <tr>
                        <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100">ARM overall</td>
                        <td className="px-2 py-1.5 font-mono tabular-nums">{formatPct01(kb.arm_overall_score)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Array.isArray(dashboard?.srs_eval?.metrics) && dashboard.srs_eval.metrics.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">SRS evaluation</p>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-600">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-2 font-medium">Key</th>
                      <th className="px-2 py-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {dashboard.srs_eval.metrics
                      .filter((m) => m && !m.skipped && typeof m.score === 'number')
                      .map((m) => (
                        <tr key={m.key || m.name}>
                          <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100">{m.name || m.key}</td>
                          <td className="px-2 py-1.5 font-mono tabular-nums">{formatPct01(m.score)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {hall && (typeof hall.confidence_score === 'number' || typeof hall.has_hallucinations === 'boolean') && (
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Generation-time alignment</p>
              {typeof hall.confidence_score === 'number' && (
                <p>
                  Grounding confidence: <span className="font-mono font-semibold">{formatPct01(hall.confidence_score)}</span>
                </p>
              )}
              {typeof hall.has_hallucinations === 'boolean' && (
                <p>
                  Review-tier flag: <span className="font-semibold">{hall.has_hallucinations ? 'Review suggested' : 'Clear'}</span>
                </p>
              )}
            </div>
          )}

          {ieeeRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">IEEE / verification metrics</p>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-600 max-h-40 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {ieeeRows.map(({ k, v }) => (
                      <tr key={k}>
                        <td className="px-2 py-1 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{k}</td>
                        <td className="px-2 py-1 break-all">{typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modelRun && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Model run (generation_meta)</p>
              {modelRun.qInterp ? (
                <p className="text-xs text-slate-700 dark:text-slate-200 mb-2 border-l-4 border-emerald-600/70 pl-2">{modelRun.qInterp}</p>
              ) : null}
              {modelRun.interp ? (
                <p className="text-xs text-slate-700 dark:text-slate-200 mb-2 border-l-4 border-r2d-primary pl-2">{modelRun.interp}</p>
              ) : null}
              {Object.keys(modelRun.qs).length > 0 ? (
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-600">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-2 py-2 font-medium">Heuristic metric</th>
                        <th className="px-2 py-2 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                      {Object.entries(modelRun.qs)
                        .filter(([k]) => k !== 'notes')
                        .map(([k, v]) => (
                          <tr key={k}>
                            <td className="px-2 py-1 font-mono text-slate-600 dark:text-slate-400">{k}</td>
                            <td className="px-2 py-1 font-mono tabular-nums">
                              {typeof v === 'number' ? formatPct01(v) : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {snap.srs_dashboard_snapshot && !fetchedDash && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tables below are the snapshot stored when the author sent this for review (same panels as next to the SRS in the app).
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpertSrsSnapshotMetrics;

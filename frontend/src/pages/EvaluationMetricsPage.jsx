import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, AlertTriangle, Shield, Sparkles, FileText } from 'lucide-react';

const METRIC_LABELS = {
  clarity: 'Clarity (readability)',
  ambiguity: 'Ambiguity (inverse)',
  testability: 'Testability',
  completeness: 'Completeness (FR+NFR)',
  consistency: 'Consistency',
  conflict_score: 'Conflict avoidance',
  nfr_specificity: 'NFR specificity',
  professional_style: 'Professional style',
  relevance: 'Relevance',
};

function MetricBar({ label, value, hint }) {
  const v = typeof value === 'number' && !Number.isNaN(value) ? Math.max(0, Math.min(1, value)) : 0;
  const pct = Math.round(v * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-sm tabular-nums font-semibold text-slate-900 dark:text-slate-100">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-r2d-primary to-r2d-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

/** Horizontal comparison chart — relative bar lengths for at-a-glance engineering review. */
function MetricsComparisonChart({ entries }) {
  const valid = entries.filter((e) => typeof e.value === 'number' && !Number.isNaN(e.value));
  if (valid.length === 0) return null;
  return (
    <div className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated dark:bg-slate-900/80 dark:border-slate-700 p-4 sm:p-6 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-r2d-accent" />
        Relative comparison
      </h2>
      <div className="space-y-4">
        {valid.map(({ key, label, value }) => {
          const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
          return (
            <div key={key} className="flex items-center gap-2 sm:gap-3">
              <span className="w-28 sm:w-36 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400 truncate" title={label}>
                {label}
              </span>
              <div className="flex-1 h-8 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-r2d-primary/90 to-r2d-accent/90 flex items-center justify-end pr-2 min-w-[2rem] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                >
                  <span className="text-[10px] font-bold text-white tabular-nums">{pct}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const EvaluationMetricsPage = ({ srsData }) => {
  const report = srsData?.verification_report;
  const manual = report?.manual_metrics || {};
  const conflict = report?.conflict_analysis;
  const nfr = report?.nfr_specificity_analysis;
  const style = report?.professional_style_analysis;

  const metricEntries = useMemo(() => {
    return Object.entries(METRIC_LABELS).map(([key, label]) => ({
      key,
      label,
      value: manual[key],
    }));
  }, [manual]);

  if (!srsData) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/80 p-10 text-center shadow-sm">
        <BarChart3 className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No SRS loaded</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">
          Generate an SRS first. Metrics are computed automatically when SRS is created.
        </p>
        <Link
          to="/generate-srs"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-r2d-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-r2d-primaryLight"
        >
          <FileText className="h-4 w-4" />
          Go to Generate SRS
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-1 sm:px-0">
      <div className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated px-4 sm:px-6 py-5 shadow-card dark:bg-slate-900/85 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-r2d-primary dark:text-slate-100 tracking-tight">SRS evaluation metrics</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
          Engineering quality signals for the active session. Higher bars are better unless noted.
        </p>
        {srsData.document_id && (
          <p className="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400">Document: {srsData.document_id}</p>
        )}
      </div>

      <MetricsComparisonChart
        entries={metricEntries.map(({ key, label, value }) => ({ key, label, value }))}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-r2d-border bg-r2d-surfaceElevated dark:bg-slate-900/80 dark:border-slate-700 p-4 sm:p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Manual metrics
          </h2>
          <div className="space-y-6">
            {metricEntries.map(({ key, label, value }) => (
              <MetricBar key={key} label={label} value={value} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated dark:bg-slate-900/80 dark:border-slate-700 p-4 sm:p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Conflicts
            </h2>
            {conflict ? (
              <>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {typeof conflict.score === 'number' ? Math.round(conflict.score * 100) : '—'}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Conflict avoidance score</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                  Pairs flagged: <strong>{conflict.conflict_count ?? 0}</strong>
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No conflict analysis in this response.</p>
            )}
          </div>

          <div className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated dark:bg-slate-900/80 dark:border-slate-700 p-4 sm:p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              NFR specificity
            </h2>
            {nfr && typeof nfr.score === 'number' ? (
              <MetricBar label="Score" value={nfr.score} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No NFR specificity block.</p>
            )}
          </div>

          <div className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated dark:bg-slate-900/80 dark:border-slate-700 p-4 sm:p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Professional style
            </h2>
            {style && typeof style.score === 'number' ? (
              <MetricBar label="Score" value={style.score} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No style analysis block.</p>
            )}
          </div>
        </div>
      </div>

      {report?.model_limitations?.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/40 p-6">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">Model limitations</h2>
          <ul className="list-disc list-inside text-sm text-amber-950/90 dark:text-amber-100/90 space-y-1">
            {report.model_limitations.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EvaluationMetricsPage;

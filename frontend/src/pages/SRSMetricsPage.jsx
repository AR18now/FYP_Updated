import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, FileText, RefreshCw } from 'lucide-react';
import config from '../config';
import { getApiErrorMessage } from '../utils/apiErrors';

function srsPlainText(srs) {
  if (!srs) return '';
  const raw = String(srs.raw_text || '').trim();
  if (raw.length >= 80) return raw;
  try {
    return JSON.stringify(srs.sections || {}, null, 0);
  } catch {
    return raw;
  }
}

const SRSMetricsPage = ({ srsData }) => {
  const text = useMemo(() => srsPlainText(srsData), [srsData]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const load = useCallback(async () => {
    if (!text || text.length < 80) {
      setError('SRS text is too short to score (need at least ~80 characters). Open a fuller SRS or regenerate.');
      setRows([]);
      setMetrics(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(config.API_ENDPOINTS.EVALUATE_SRS_QUALITY_METRICS, { raw_text: text });
      const table = Array.isArray(res.data?.srs_quality_table) ? res.data.srs_quality_table : [];
      setRows(table);
      setMetrics(res.data?.metrics && typeof res.data.metrics === 'object' ? res.data.metrics : null);
      if (!table.length && res.data?.metrics) {
        setError('Quality detail table was empty. Check that the API is running the latest version.');
      }
    } catch (e) {
      setRows([]);
      setMetrics(null);
      setError(getApiErrorMessage(e, 'Could not load metrics.'));
    } finally {
      setLoading(false);
    }
  }, [text]);

  useEffect(() => {
    load();
  }, [load]);

  if (!srsData) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center text-slate-600 dark:text-slate-400">
        <p className="text-sm">No SRS loaded. Generate one first.</p>
        <Link to="/generate-srs" className="mt-4 inline-block text-sm text-r2d-primary underline">
          Go to Generate SRS
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-1">
      <header className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Generated SRS</p>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          {srsData.title || 'SRS document'}
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-mono">ID: {srsData.document_id || srsData.id || '—'}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
          Structural wording checks (same scoring pipeline as the offline document-quality evaluation). Scores are 0–100%.
          Counts are raw matches in the document text.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <Link
            to="/srs"
            className="inline-flex items-center text-xs px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Back to SRS
          </Link>
        </div>
      </header>

      {error && (
        <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2" role="alert">
          {error}
        </div>
      )}

      {loading && !rows.length ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 w-[28%]">Metric</th>
                <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 w-[10%]">Score</th>
                <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 w-[14%]">Count</th>
                <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">What it means</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-slate-100 dark:border-slate-800 last:border-0 align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{r.label}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-800 dark:text-slate-200">{r.score_display || '—'}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs">
                    {r.count != null ? (
                      <>
                        <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">{r.count}</span>
                        {r.count_label ? <span className="block text-slate-500 dark:text-slate-500 mt-0.5">{r.count_label}</span> : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{r.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {metrics && typeof metrics.overall_score === 'number' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Blended <strong className="text-slate-700 dark:text-slate-300">overall_score</strong>:{' '}
          {Math.round(Math.max(0, Math.min(1, metrics.overall_score)) * 100)}% (combines many signals, including the
          structural checks above; more rows can be added to this page later).
        </p>
      )}
    </div>
  );
};

export default SRSMetricsPage;

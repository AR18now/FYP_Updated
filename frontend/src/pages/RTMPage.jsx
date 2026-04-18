import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, GitCompareArrows, RefreshCw } from 'lucide-react';
import config from '../config';
import { getApiErrorMessage } from '../utils/apiErrors';
import { buildGenerateUseCasesRequestBody, hasModelTextualUseCases } from '../utils/useCaseRequest';

const pct = (v) => `${Math.round((Number(v) || 0) * 100)}%`;

const badgeClass = (kind) => {
  if (kind === 'covered' || kind === 'good' || kind === 'testable') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800';
  }
  if (kind === 'partial') {
    return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800';
  }
  return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800';
};

const RTMPage = ({ srsData, useCaseData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const canAnalyze = !!srsData;

  const runAnalysis = async () => {
    if (!srsData) return;
    setLoading(true);
    setError(null);
    try {
      let useCasePayload = { ...(useCaseData || {}) };
      if (!useCasePayload.textual_usecases?.text && hasModelTextualUseCases(srsData)) {
        useCasePayload = {
          ...useCasePayload,
          textual_usecases: srsData.textual_usecases,
        };
      }
      const hasTextual = !!useCasePayload?.textual_usecases?.text;
      const hasDiagram = !!useCasePayload?.diagram?.plantuml_code || !!useCasePayload?.diagram?.diagram_base64;
      if ((!hasTextual || !hasDiagram) && hasModelTextualUseCases(srsData)) {
        const ucResp = await axios.post(
          config.API_ENDPOINTS.GENERATE_USECASES,
          buildGenerateUseCasesRequestBody(srsData)
        );
        useCasePayload = { ...useCasePayload, ...(ucResp.data || {}) };
      }
      const res = await axios.post(config.API_ENDPOINTS.RTM_ANALYZE, {
        srs_data: srsData,
        use_case_data: useCasePayload,
      });
      setReport(res.data || null);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to run RTM analysis.'));
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => report?.summary || {}, [report]);
  const rows = useMemo(() => report?.rows || [], [report]);

  const frRows = useMemo(() => {
    return rows.filter((r) => {
      const typ = String(r?.type || '').toUpperCase();
      const rid = String(r?.req_id || '').toUpperCase();
      return typ === 'FR' || /^FR-\d+$/.test(rid);
    });
  }, [rows]);

  const frSummary = useMemo(() => {
    const total = frRows.length;
    if (!total) {
      return { coverage_ratio: 0, consistency_ratio: 0, covered_requirements: 0, total_requirements: 0 };
    }
    const covered = frRows.filter((r) => String(r?.coverage_status || '').toLowerCase() === 'covered').length;
    const good = frRows.filter((r) => String(r?.consistency_status || '').toLowerCase() === 'good').length;
    return {
      coverage_ratio: covered / total,
      consistency_ratio: good / total,
      covered_requirements: covered,
      total_requirements: total,
    };
  }, [frRows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated shadow-card dark:bg-slate-900/85 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-r2d-primary dark:text-slate-100">Requirements Traceability Matrix</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Cross-checks functional requirements (FR) across SRS, textual use cases, and use case diagram.
            </p>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={!canAnalyze || loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-slate-400 text-white text-sm w-full sm:w-auto"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
            {loading ? 'Analyzing...' : 'Run RTM Analysis'}
          </button>
        </div>
        {!canAnalyze && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            No SRS in session yet. Generate an SRS first from <Link to="/generate-srs" className="underline">Generate SRS</Link>.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      </section>

      {report && (
        <>
          <section className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900 dark:border-slate-700 p-4">
              <p className="text-xs uppercase text-slate-500">Coverage (FR only)</p>
              <p className="text-2xl font-bold text-r2d-primary dark:text-slate-100 mt-1">{pct(frSummary.coverage_ratio)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {frSummary.covered_requirements}/{frSummary.total_requirements} functional requirements linked
              </p>
            </div>
            <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900 dark:border-slate-700 p-4">
              <p className="text-xs uppercase text-slate-500">Consistency (FR only)</p>
              <p className="text-2xl font-bold text-r2d-primary dark:text-slate-100 mt-1">{pct(frSummary.consistency_ratio)}</p>
              <p className="text-xs text-slate-500 mt-1">Textual and diagram links agree for listed FRs</p>
            </div>
          </section>

          <section className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated shadow-card dark:bg-slate-900/85 dark:border-slate-700 p-3 sm:p-4">
            <h2 className="text-lg font-semibold text-r2d-primary dark:text-slate-100 mb-3">RTM Table — functional requirements</h2>
            <div className="overflow-auto">
              <table className="min-w-[860px] md:min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-3">Req ID</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Requirement</th>
                    <th className="py-2 pr-3">Textual Use Cases</th>
                    <th className="py-2 pr-3">Diagram Use Cases</th>
                    <th className="py-2 pr-3">Coverage</th>
                    <th className="py-2 pr-3">Consistency</th>
                  </tr>
                </thead>
                <tbody>
                  {frRows.map((r, idx) => (
                    <tr key={`${r.req_id}-${idx}`} className="align-top border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3 font-mono text-xs">{r.req_id}</td>
                      <td className="py-2 pr-3">{r.type}</td>
                      <td className="py-2 pr-3 max-w-[340px]">
                        <p className="line-clamp-3 break-words">{r.requirement}</p>
                        <p className="text-xs text-slate-500 mt-1 break-words">{r.notes}</p>
                      </td>
                      <td className="py-2 pr-3 text-xs whitespace-normal break-words">{(r.textual_usecase_names || []).join(', ') || '—'}</td>
                      <td className="py-2 pr-3 text-xs whitespace-normal break-words">{(r.diagram_usecase_names || []).join(', ') || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex px-2 py-0.5 rounded border text-xs ${badgeClass(r.coverage_status)}`}>{r.coverage_status}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex px-2 py-0.5 rounded border text-xs ${badgeClass(r.consistency_status)}`}>{r.consistency_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(summary.orphan_textual_usecases?.length > 0 || summary.orphan_diagram_usecases?.length > 0) && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Orphan Use Cases
              </p>
              <p className="text-xs mt-2 text-amber-800 dark:text-amber-200 break-words">
                Textual: {(summary.orphan_textual_usecases || []).join(', ') || 'None'} | Diagram: {(summary.orphan_diagram_usecases || []).join(', ') || 'None'}
              </p>
            </section>
          )}
        </>
      )}

      {!report && canAnalyze && (
        <section className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 p-6 text-center">
          <CheckCircle2 className="h-6 w-6 mx-auto text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Run analysis to generate your RTM table and quality links.</p>
        </section>
      )}
    </div>
  );
};

export default RTMPage;

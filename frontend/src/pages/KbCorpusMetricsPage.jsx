import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Library } from 'lucide-react';
import config from '../config';

/**
 * Embeds the full offline KB batch metrics table (IEEE 830 extracted corpus, etc.)
 * served as HTML from the API using ``data/output/kb_quality_report_final_extracted.json``.
 */
const KbCorpusMetricsPage = () => {
  const reportUrl = useMemo(
    () => `${config.API_BASE_URL}/api/knowledge-base-corpus-metrics-report`,
    []
  );

  return (
    <div className="max-w-[100vw] mx-auto animate-fade-in px-2 sm:px-4 pb-10">
      <header className="max-w-5xl mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 p-4 sm:p-5 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Library className="h-6 w-6 text-r2d-primary shrink-0" />
          Knowledge base corpus metrics
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Wide table of scores from <span className="font-mono text-xs">rag/evaluate_srs_kb.py</span> on your TXT corpus
          (for example <span className="font-mono text-xs">final_extracted_srs_ieee830</span>). The report is built from{' '}
          <span className="font-mono text-xs">data/output/kb_quality_report_final_extracted.json</span> when present.
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <span className="block">
            Regenerate JSON:{' '}
            <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px]">
              python rag/evaluate_srs_kb.py --kb_dir &lt;path&gt; --json_out
              data/output/kb_quality_report_final_extracted.json
            </code>
          </span>
          <span className="block">
            Optional static HTML file:{' '}
            <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px]">
              python rag/export_kb_metrics_html.py --input_json data/output/kb_quality_report_final_extracted.json
              --output_html data/output/kb_metrics_report_final_extracted.html
            </code>
          </span>
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-r2d-primary dark:text-cyan-300 hover:underline"
        >
          ← Workspace home
        </Link>
      </header>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950/50 shadow-inner">
        <iframe
          title="SRS knowledge base metrics report"
          src={reportUrl}
          className="w-full h-[calc(100dvh-14rem)] min-h-[520px] border-0 bg-white"
        />
      </div>
    </div>
  );
};

export default KbCorpusMetricsPage;

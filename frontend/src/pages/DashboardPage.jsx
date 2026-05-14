import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const DashboardPage = ({ srsData }) => {
  const srsTitle = srsData?.title ? String(srsData.title).slice(0, 48) : null;

  return (
    <div className="w-full space-y-8 animate-fade-in">
      {srsTitle && (
        <p className="text-xs text-slate-500 dark:text-slate-500 font-mono truncate" title={srsData?.document_id}>
          Current SRS: {srsTitle}
          {srsData?.document_id ? ` · ${srsData.document_id}` : ''}
        </p>
      )}

      <section aria-labelledby="primary-task-heading" className="max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-700/80">
          <div className="relative px-5 pt-5 pb-4 sm:px-7 sm:pt-7 sm:pb-5">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-r2d-primary via-r2d-primaryLight to-r2d-accent opacity-[0.12] dark:opacity-[0.22]"
              aria-hidden
            />
            <div className="relative flex items-start gap-3 sm:gap-4">
              <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-r2d-primary to-r2d-accent text-white shadow-md">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-r2d-primary dark:text-blue-300">
                  Start here
                </p>
                <h2
                  id="primary-task-heading"
                  className="text-xl font-bold leading-snug text-slate-900 dark:text-slate-50 sm:text-2xl sm:leading-tight"
                >
                  Make a requirements document for your system
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Describe what you are building—goals, constraints, and stakeholders—then run the workspace to produce a
                  structured specification draft. You can refine it, add traceability, and export when you are ready.
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200/90 bg-slate-50/90 px-5 py-4 sm:px-7 dark:border-slate-700 dark:bg-slate-950/40">
            <Link
              to="/generate-srs"
              className="group flex w-full items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-r2d-primary via-r2d-primary to-r2d-accent px-4 py-3.5 text-left text-white shadow-md ring-1 ring-white/10 transition hover:brightness-[1.03] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5 sm:py-4"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold sm:text-base">Open the generation workspace</span>
                <span className="mt-0.5 block text-xs font-normal text-blue-100/95 sm:text-sm">
                  Add inputs, run processing, and review your draft
                </span>
              </span>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition group-hover:bg-white/25">
                <ArrowRight className="h-5 w-5" aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;

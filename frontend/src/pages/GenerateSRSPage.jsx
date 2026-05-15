import React from 'react';
import { Sparkles, Workflow } from 'lucide-react';
import RequirementsInput from '../components/RequirementsInput';

/**
 * Thin wrapper around `RequirementsInput` — the main author-facing capture + pipeline UI.
 * Props are forwarded so results/SRS state can live in `App.js` route-level state.
 */
const GenerateSRSPage = (props) => {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in w-full">
      <section className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated shadow-card dark:bg-slate-900/85 dark:border-slate-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 lg:px-8 lg:py-6 flex flex-wrap items-start gap-3 sm:gap-4 border-b border-r2d-border/80 dark:border-slate-700/80 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-r2d-primary to-r2d-primaryLight text-white flex items-center justify-center shadow-md shrink-0">
            <Workflow className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-r2d-primary dark:text-slate-100 tracking-tight">Generate SRS</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Capture requirements, run optional clarification, then{' '}
              <strong className="text-slate-800 dark:text-slate-200">Process &amp; Generate SRS</strong> to execute the
              full NLP and model pipeline.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-r2d-accent bg-r2d-accentMuted/60 dark:bg-r2d-primary/35 px-3 py-1.5 rounded-full border border-r2d-accent/30 dark:border-r2d-primary/60">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            IEEE 830
          </div>
        </div>
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <RequirementsInput {...props} />
        </div>
      </section>
    </div>
  );
};

export default GenerateSRSPage;

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  PanelLeft,
  FileText,
  BarChart3,
  UserCheck,
  ClipboardList,
  GitBranch,
  Table2,
  Settings,
  History,
} from 'lucide-react';
import { BrandMark } from '../components/BrandLogo';

const taskLinkClass =
  'flex items-center gap-3 rounded-xl border border-r2d-border bg-r2d-surfaceElevated px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:border-r2d-primary/30 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors';

const DashboardPage = ({ hasResults, hasSrs, hasUseCases, srsData }) => {
  const nextStep = useMemo(() => {
    if (!hasResults) {
      return 'Enter requirements and run processing.';
    }
    if (!hasSrs) {
      return 'Generate your SRS from the processing results.';
    }
    if (!hasUseCases) {
      return 'Optional: generate use cases and diagram from your SRS.';
    }
    return 'Review metrics, traceability, or export documents.';
  }, [hasResults, hasSrs, hasUseCases]);

  const srsTitle = srsData?.title ? String(srsData.title).slice(0, 48) : null;

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <header>
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          <div className="h-36 bg-gradient-to-r from-r2d-primary via-r2d-primaryLight to-r2d-accent" />
          <div className="p-5 sm:p-6 -mt-12">
            <div className="inline-flex rounded-md bg-white/90 dark:bg-slate-900/90 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 shadow">
              Active Workspace
            </div>
            <div className="mt-3 flex items-center gap-3">
              <BrandMark className="h-10 w-10 border border-slate-200 dark:border-slate-600 shrink-0" imgClassName="h-full w-full object-contain" />
              <h1 className="text-2xl font-semibold text-r2d-primary dark:text-slate-100 tracking-tight">Workspace Home</h1>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{nextStep}</p>
          </div>
        </div>
        {srsTitle && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500 font-mono truncate" title={srsData?.document_id}>
            Current SRS: {srsTitle}
            {srsData?.document_id ? ` · ${srsData.document_id}` : ''}
          </p>
        )}
      </header>

      {/* Primary task */}
      <section aria-labelledby="primary-task">
        <h2 id="primary-task" className="sr-only">
          Main task
        </h2>
        <Link
          to="/generate-srs"
          className="flex items-center justify-between gap-3 rounded-xl border-2 border-r2d-primary/40 bg-gradient-to-r from-r2d-primary to-r2d-accent px-4 sm:px-5 py-4 text-white shadow-md hover:from-r2d-primaryLight hover:to-r2d-accent transition-colors"
        >
          <span className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            <span className="min-w-0">
              <span className="block font-semibold">Generate SRS</span>
              <span className="block text-xs text-slate-200 font-normal mt-0.5">Input · process · create document</span>
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
        </Link>
      </section>

      {/* Session checklist — one line */}
      <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        <span className={hasResults ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
          {hasResults ? '✓ Processed' : '○ Not processed'}
        </span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
        <span className={hasSrs ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
          {hasSrs ? '✓ SRS' : '○ No SRS'}
        </span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
        <span className={hasUseCases ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
          {hasUseCases ? '✓ Use cases' : '○ No use cases'}
        </span>
      </p>

      {/* Task links — short labels, no long blurbs */}
      <section aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
          Workspace
        </h2>
        <ul className="grid md:grid-cols-2 gap-2">
          <li>
            <Link to="/results" className={taskLinkClass}>
              <PanelLeft className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              Processing results
            </Link>
          </li>
          <li>
            <Link to="/srs" className={taskLinkClass}>
              <FileText className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              SRS document
            </Link>
          </li>
          <li>
            <Link to="/srs-metrics" className={taskLinkClass}>
              <BarChart3 className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              SRS quality metrics
            </Link>
          </li>
          <li>
            <Link to="/expert-review" className={taskLinkClass}>
              <UserCheck className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              Expert review
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="deliverables-heading">
        <h2 id="deliverables-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
          Deliverables
        </h2>
        <ul className="grid md:grid-cols-2 gap-2">
          <li>
            <Link to="/textual-usecases" className={taskLinkClass}>
              <ClipboardList className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              Textual use cases
            </Link>
          </li>
          <li>
            <Link to="/usecase-diagram" className={taskLinkClass}>
              <GitBranch className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              Use case diagram
            </Link>
          </li>
          <li>
            <Link to="/rtm" className={taskLinkClass}>
              <Table2 className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              RTM matrix
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="other-heading">
        <h2 id="other-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
          Other
        </h2>
        <ul className="grid md:grid-cols-2 gap-2">
          <li>
            <Link to="/history" className={taskLinkClass}>
              <History className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              History
            </Link>
          </li>
          <li>
            <Link to="/settings" className={taskLinkClass}>
              <Settings className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
              Settings
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default DashboardPage;

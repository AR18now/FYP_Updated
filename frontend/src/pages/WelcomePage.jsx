import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  User,
  UserCheck,
  LogIn,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  Moon,
  Sun,
  CheckCircle2,
  PenLine,
  Inbox,
} from 'lucide-react';
import { BrandFull } from '../components/BrandLogo';
import { useTheme } from '../context/ThemeContext';
import { isAuthenticated, getCurrentUser, ROLES } from '../utils/auth';

/** Decorative SVG — author / SRS workspace */
function AuthorPortalArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="24" y="20" width="120" height="150" rx="10" fill="currentColor" className="text-emerald-100 dark:text-emerald-900/60" />
      <rect
        x="44"
        y="8"
        width="120"
        height="150"
        rx="10"
        stroke="currentColor"
        strokeWidth="3"
        className="text-emerald-500/80 fill-white dark:fill-slate-800"
      />
      <path d="M60 40h88M60 58h72M60 76h88M60 94h56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-emerald-600/50 dark:text-emerald-400/40" />
      <circle cx="148" cy="128" r="28" fill="currentColor" className="text-r2d-primary/90" />
      <path d="M138 128l6 6 14-16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M168 36l-8 8M160 36h8v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-emerald-500" />
    </svg>
  );
}

/** Decorative SVG — reviewer queue */
function ReviewerPortalArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect
        x="52"
        y="12"
        width="96"
        height="136"
        rx="8"
        strokeWidth="3"
        className="stroke-amber-600/70 fill-amber-50 dark:stroke-amber-500/50 dark:fill-amber-950/40"
      />
      <rect x="64" y="32" width="72" height="8" rx="2" className="fill-amber-200/80 dark:fill-amber-800/50" />
      <rect x="64" y="48" width="56" height="8" rx="2" className="fill-amber-200/60 dark:fill-amber-800/40" />
      <rect x="64" y="72" width="72" height="8" rx="2" className="fill-slate-200 dark:fill-slate-600" />
      <rect x="64" y="88" width="48" height="8" rx="2" className="fill-slate-200 dark:fill-slate-600" />
      <path d="M64 112h48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-700/40" />
      <circle cx="156" cy="44" r="22" fill="currentColor" className="text-slate-800 dark:text-slate-200" />
      <path d="M148 44l5 5 12-14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400" />
    </svg>
  );
}

const WelcomePage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  if (isAuthenticated()) {
    const u = getCurrentUser();
    return <Navigate to={u?.role === ROLES.EXPERT ? '/expert' : '/'} replace />;
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden flex items-center justify-center p-4 md:p-8"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-r2d-border bg-r2d-surfaceElevated/95 px-3 py-2 text-sm text-r2d-primary shadow-sm hover:bg-r2d-surface dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <span>Back</span>
      </button>
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-emerald-400/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-r2d-border bg-r2d-surfaceElevated/95 px-3 py-2 text-sm text-r2d-primary shadow-sm hover:bg-r2d-surface dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>

      <div className="w-full max-w-6xl space-y-10 animate-fade-in">
        <header className="text-center space-y-5">
          <div className="flex justify-center">
            <BrandFull className="h-14 sm:h-16 w-auto max-w-[min(280px,85vw)] object-contain mx-auto" alt="Req2Design" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display text-r2d-primary dark:text-slate-100">
            Choose your workspace
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            These are two different portals with separate sign-in pages. Pick the lane that matches what you are here to do
            today.
          </p>
        </header>

        {/* Mobile: horizontal hint between stacked cards */}
        <div className="lg:hidden flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
          <span className="shrink-0 font-semibold tracking-wide uppercase">Two separate accounts</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-stretch gap-6 lg:gap-0 lg:rounded-3xl lg:overflow-hidden lg:shadow-2xl lg:border lg:border-r2d-border dark:lg:border-slate-700">
          {/* Author / User lane */}
          <section className="relative flex-1 flex flex-col md:flex-row md:items-stretch gap-6 rounded-3xl border-2 border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/95 via-white to-white dark:from-emerald-950/35 dark:via-slate-900 dark:to-slate-900 shadow-xl lg:rounded-none lg:border-0 lg:shadow-none p-6 md:p-8 lg:pr-4">
            <div className="absolute top-4 right-4 md:static md:order-2 md:flex md:items-center md:justify-center md:w-[42%] shrink-0">
              <AuthorPortalArt className="w-full max-w-[200px] mx-auto md:max-w-none h-auto opacity-95" />
            </div>
            <div className="relative md:order-1 md:flex-1 flex flex-col min-w-0">
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 px-3 py-1 text-xs font-bold uppercase tracking-wide border border-emerald-500/25">
                <PenLine className="h-3.5 w-3.5" aria-hidden />
                I create requirements
              </span>
              <div className="mt-4 inline-flex rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 p-3 w-fit text-white shadow-md">
                <User className="h-8 w-8" aria-hidden />
              </div>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">User</h2>
              <p className="text-xs font-medium text-emerald-800/80 dark:text-emerald-400/90">Author workspace · SRS, diagrams, RTM</p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">
                Generate SRS documents, use cases, diagrams, and send drafts for human expert review when you want a structured
                quality check.
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-400/80">
                Typical flow
              </p>
              <ul className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                  Capture and refine requirements, then run generation.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                  Build use cases, diagrams, and traceability (RTM).
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                  Request expert review from your project when ready.
                </li>
              </ul>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/login/user"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  User sign in
                </Link>
                <Link
                  to="/signup/user"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-600/40 bg-white/80 dark:bg-slate-800/80 px-4 py-3 text-sm font-semibold text-emerald-900 dark:text-emerald-100 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  New user account
                </Link>
              </div>
            </div>
          </section>

          {/* Divider — desktop only */}
          <div
            className="hidden lg:flex flex-col w-[min(7rem,8vw)] shrink-0 items-center justify-center gap-3 bg-gradient-to-b from-slate-100 via-slate-50 to-amber-50/40 dark:from-slate-800 dark:via-slate-800 dark:to-amber-950/20 border-x border-slate-200/80 dark:border-slate-700 px-2 text-center"
            role="separator"
            aria-label="Choose exactly one portal"
          >
            <span className="w-px flex-1 min-h-[3rem] max-h-24 bg-gradient-to-b from-emerald-300/0 via-slate-300 dark:via-slate-600 to-amber-300/0" />
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 leading-snug">
              Pick
              <br />
              one
            </span>
            <Inbox className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 leading-snug">
              Not
              <br />
              both
            </span>
            <span className="w-px flex-1 min-h-[3rem] max-h-24 bg-gradient-to-b from-emerald-300/0 via-slate-300 dark:via-slate-600 to-amber-300/0" />
          </div>

          {/* Expert lane */}
          <section className="relative flex-1 flex flex-col md:flex-row md:items-stretch gap-6 rounded-3xl border-2 border-amber-300/90 dark:border-amber-700/50 bg-gradient-to-br from-amber-50/95 via-orange-50/40 to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xl lg:rounded-none lg:border-0 lg:shadow-none p-6 md:p-8 lg:pl-4 ring-1 ring-amber-200/50 dark:ring-amber-900/30">
            <div className="absolute top-4 right-4 md:static md:order-2 md:flex md:items-center md:justify-center md:w-[42%] shrink-0">
              <ReviewerPortalArt className="w-full max-w-[200px] mx-auto md:max-w-none h-auto opacity-95" />
            </div>
            <div className="relative md:order-1 md:flex-1 flex flex-col min-w-0">
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-600/12 text-amber-950 dark:text-amber-200 px-3 py-1 text-xs font-bold uppercase tracking-wide border border-amber-600/30">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                I review submissions
              </span>
              <div className="mt-4 inline-flex rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 dark:from-amber-700 dark:to-amber-900 p-3 w-fit text-white shadow-md">
                <UserCheck className="h-8 w-8" aria-hidden />
              </div>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">Expert reviewer</h2>
              <p className="text-xs font-medium text-amber-900/80 dark:text-amber-300/90">Reviewer panel · queue only</p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">
                Use this only if you were onboarded as a reviewer: open the pending queue, read SRS snapshots, and submit
                structured expert feedback.
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-400/80">
                Typical flow
              </p>
              <ul className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                  Open the pending review queue in the expert panel.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                  Read the SRS snapshot and any discussion thread.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                  Submit your verdict and structured feedback.
                </li>
              </ul>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/login/expert"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 transition-colors shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  Expert sign in
                </Link>
                <Link
                  to="/signup/expert"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-800/25 dark:border-amber-500/40 bg-white/90 dark:bg-slate-800/90 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-amber-50 hover:bg-amber-50/80 dark:hover:bg-slate-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  New expert account
                </Link>
              </div>
            </div>
          </section>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-500 max-w-xl mx-auto leading-relaxed">
          <ArrowRight className="inline h-3 w-3 mr-1 opacity-70 align-middle" aria-hidden />
          If you are writing your own SRS, stay on the green <strong className="font-semibold text-emerald-700 dark:text-emerald-400">user</strong> side. If you only
          review others&apos; work, use the amber <strong className="font-semibold text-amber-800 dark:text-amber-400">expert</strong> side — credentials do not carry
          across.
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;

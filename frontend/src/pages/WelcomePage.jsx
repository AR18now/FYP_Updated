import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { User, UserCheck, LogIn, UserPlus, ArrowLeft, ArrowRight, Moon, Sun, CheckCircle2 } from 'lucide-react';
import { BrandFull } from '../components/BrandLogo';
import { useTheme } from '../context/ThemeContext';
import { isAuthenticated, getCurrentUser, ROLES } from '../utils/auth';

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
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-r2d-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-r2d-primary/20 blur-3xl" />
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-r2d-border bg-r2d-surfaceElevated/95 px-3 py-2 text-sm text-r2d-primary shadow-sm hover:bg-r2d-surface dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>

      <div className="w-full max-w-4xl space-y-10">
        <header className="text-center space-y-5">
          <div className="flex justify-center">
            <BrandFull className="h-14 sm:h-16 w-auto max-w-[min(280px,85vw)] object-contain mx-auto" alt="Req2Design" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display text-r2d-primary dark:text-slate-100">
            Choose your workspace
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            User and expert accounts are intentionally separate. Select your portal first so you enter the correct flow from
            the very start.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-r2d-border bg-white/90 dark:bg-slate-900/80 dark:border-slate-700 shadow-xl p-6 md:p-8 flex flex-col">
            <div className="rounded-xl bg-gradient-to-br from-r2d-primary to-r2d-accent p-3 w-fit text-white mb-4">
              <User className="h-8 w-8" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">User</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">
              Generate SRS documents, use cases, diagrams, and submit drafts for human expert review when you need a
              structured check.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              User flow
            </p>
            <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                1. Input and refine requirements
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                2. Process and generate SRS
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                3. Create use cases, diagram, RTM, then request expert review
              </li>
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                to="/login/user"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-r2d-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-r2d-primaryLight transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
              <Link
                to="/signup/user"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-r2d-border bg-r2d-surface px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <UserPlus className="h-4 w-4" />
                Sign up
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-r2d-border dark:border-slate-700 bg-r2d-accentMuted/55 dark:bg-slate-900/80 shadow-xl p-6 md:p-8 flex flex-col ring-1 ring-r2d-accent/20 dark:ring-r2d-primary/40">
            <div className="rounded-xl bg-gradient-to-br from-r2d-primary to-r2d-accent p-3 w-fit text-white mb-4">
              <UserCheck className="h-8 w-8" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Expert reviewer</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">
              Sign in to the reviewer panel only: view the pending queue, read SRS snapshots, and submit structured expert
              feedback.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Expert flow
            </p>
            <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                1. Open pending review queue
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                2. Review SRS snapshots and discussion thread
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                3. Submit verdict and structured feedback
              </li>
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                to="/login/expert"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-r2d-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-r2d-primaryLight transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
              <Link
                to="/signup/expert"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-r2d-border dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-r2d-primary dark:text-slate-100 hover:bg-r2d-accentMuted/40 dark:hover:bg-slate-700"
              >
                <UserPlus className="h-4 w-4" />
                Sign up
              </Link>
            </div>
          </section>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-500">
          <ArrowRight className="inline h-3 w-3 mr-1 opacity-70" aria-hidden />
          Accounts are separate: register as a user to author SRS, or as an expert to review submissions.
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;

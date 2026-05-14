import React from 'react';
import {
  ArrowRight,
  DoorOpen,
  FileInput,
  ClipboardList,
  Table2,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { BrandFull } from '../components/BrandLogo';

const FLOW_STEPS = [
  {
    step: 1,
    title: 'Workspace',
    body: 'Pick author vs reviewer and sign in with the matching portal.',
    icon: DoorOpen,
  },
  {
    step: 2,
    title: 'Generate SRS',
    body: 'Capture inputs and produce structured IEEE-style requirement drafts.',
    icon: FileInput,
  },
  {
    step: 3,
    title: 'Use cases & diagrams',
    body: 'Derive textual use cases and diagrams from your SRS.',
    icon: ClipboardList,
  },
  {
    step: 4,
    title: 'Traceability',
    body: 'Maintain an RTM so requirements stay linked to artifacts.',
    icon: Table2,
  },
  {
    step: 5,
    title: 'Quality & review',
    body: 'Inspect SRS metrics and route drafts to expert review when needed.',
    icon: UserCheck,
  },
];

const IntroSplashPage = ({ onComplete }) => {
  const handleStart = () => {
    if (onComplete) onComplete();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-r2d-primaryDark flex items-center justify-center px-4 py-10 sm:py-12">
      <div className="pointer-events-none absolute inset-0 splash-grid opacity-30" />
      <div className="pointer-events-none splash-bg-layer">
        <div className="splash-ghost-card splash-card-pos-a">
          <p className="splash-card-title">Requirements</p>
          <div className="splash-typing-lines">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="splash-ghost-card splash-card-pos-b">
          <p className="splash-card-title">Use Cases</p>
          <div className="splash-diagram">
            <span className="splash-node splash-node-a" />
            <span className="splash-node splash-node-b" />
            <span className="splash-node splash-node-c" />
            <span className="splash-link splash-link-ab" />
            <span className="splash-link splash-link-ac" />
          </div>
        </div>
        <div className="splash-ghost-card splash-card-pos-c splash-card-mobile-hide">
          <p className="splash-card-title">Validation</p>
          <div className="splash-typing-lines">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="splash-ghost-card splash-card-pos-d splash-card-mobile-hide">
          <p className="splash-card-title">Traceability</p>
          <div className="splash-diagram">
            <span className="splash-node splash-node-a" />
            <span className="splash-node splash-node-b" />
            <span className="splash-node splash-node-c" />
            <span className="splash-link splash-link-ab" />
            <span className="splash-link splash-link-ac" />
          </div>
        </div>
        <div className="splash-ghost-card splash-card-pos-e splash-card-mobile-hide">
          <p className="splash-card-title">SRS Draft</p>
          <div className="splash-typing-lines">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="splash-ghost-card splash-card-pos-f splash-card-mobile-hide">
          <p className="splash-card-title">Review Flow</p>
          <div className="splash-diagram">
            <span className="splash-node splash-node-a" />
            <span className="splash-node splash-node-b" />
            <span className="splash-node splash-node-c" />
            <span className="splash-link splash-link-ab" />
            <span className="splash-link splash-link-ac" />
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -top-28 -left-20 h-80 w-80 rounded-full bg-r2d-primary/25 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-r2d-primaryLight/20 blur-3xl animate-pulse" />

      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row gap-8 lg:gap-10 lg:items-stretch">
        {/* Left: app flow */}
        <section className="flex-1 rounded-2xl border border-r2d-primary/35 bg-slate-900/50 backdrop-blur-md p-6 sm:p-8 shadow-xl shadow-amber-950/35">
          <div className="flex items-center gap-2 text-r2d-primaryLight mb-4">
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">End-to-end flow</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight splash-neon-text">
            What Req2Design does
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            One pipeline from rough intent to review-ready artifacts — AI-assisted, with optional human expert review.
          </p>
          <ol className="mt-6 space-y-4">
            {FLOW_STEPS.map(({ step, title, body, icon: Icon }) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl border border-white/10 bg-r2d-primaryDark/40 px-3 py-3 sm:px-4 sm:py-3.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-r2d-primary/30 text-amber-50 ring-1 ring-r2d-primaryLight/35">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Step {step}
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="text-slate-200">{title}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-400 leading-snug">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Right: brand + start */}
        <div className="w-full lg:max-w-md shrink-0 rounded-2xl border border-r2d-primary/35 bg-slate-900/60 backdrop-blur-md p-8 shadow-2xl shadow-amber-950/45 flex flex-col items-center text-center">
          <BrandFull className="w-28 h-28 sm:w-32 sm:h-32 select-none" alt="Req2Design" />
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white splash-neon-text">
            Req2Design
          </h1>

          <p className="mt-5 text-sm sm:text-base text-slate-300 max-w-sm leading-relaxed splash-neon-text">
            AI-powered Requirements Engineering Workspace
          </p>

          <div className="mt-6 h-1.5 w-52 bg-r2d-primary/40 rounded-full overflow-hidden">
            <div className="splash-loader h-full" />
          </div>

          <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Next: choose your workspace
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-r2d-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/35 hover:bg-r2d-primaryLight transition-colors"
          >
            Start the app
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroSplashPage;

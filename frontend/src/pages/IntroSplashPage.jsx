import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BrandFull } from '../components/BrandLogo';

const IntroSplashPage = ({ onComplete }) => {
  const handleStart = () => {
    if (onComplete) onComplete();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 splash-grid opacity-25" />
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
      <div className="pointer-events-none absolute -top-28 -left-20 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-300/20 bg-slate-900/55 backdrop-blur-md p-8 shadow-2xl shadow-cyan-500/10 flex flex-col items-center text-center">
        <BrandFull className="w-28 h-28 sm:w-32 sm:h-32 select-none" alt="Req2Design" />
        <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white splash-neon-text">
          Req2Design
        </h1>

        <p className="mt-5 text-sm sm:text-base text-zinc-300 max-w-sm leading-relaxed splash-neon-text">
          AI-powered Requirements Engineering Workspace
        </p>

        <div className="mt-6 h-1.5 w-52 bg-slate-800/90 rounded-full overflow-hidden">
          <div className="splash-loader h-full" />
        </div>

        <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-zinc-400">Click start to continue</p>
        <button
          type="button"
          onClick={handleStart}
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
        >
          Start
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default IntroSplashPage;

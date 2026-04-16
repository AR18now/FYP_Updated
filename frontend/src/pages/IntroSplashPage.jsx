import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

const IntroSplashPage = ({ onComplete }) => {
  const handleStart = () => {
    if (onComplete) onComplete();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 splash-grid" />
      <div className="pointer-events-none absolute -top-28 -left-20 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl animate-pulse" />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-slate-900/55 backdrop-blur-md p-8 text-center shadow-2xl shadow-cyan-500/10">
        <div className="mx-auto mb-5 h-16 w-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-400 to-indigo-500 splash-neon-ring">
          <Sparkles className="h-8 w-8 text-white" aria-hidden />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white splash-neon-text">
          Req2Design
        </h1>
        <p className="mt-3 text-sm sm:text-base text-cyan-100/90">
          AI-powered Requirements Engineering Workspace
        </p>

        <p className="mt-4 text-xs uppercase tracking-wider text-cyan-200/75">
          Click start to continue
        </p>
        <button
          type="button"
          onClick={handleStart}
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 hover:from-cyan-400 hover:to-indigo-400 transition-colors"
        >
          Start
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default IntroSplashPage;

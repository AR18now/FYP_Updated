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
      <div className="pointer-events-none absolute -top-28 -left-20 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        <BrandFull className="w-28 h-28 sm:w-32 sm:h-32 select-none" alt="Req2Design" />

        <p className="mt-6 text-sm sm:text-base text-zinc-300 max-w-sm leading-relaxed">
          AI-powered Requirements Engineering Workspace
        </p>

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

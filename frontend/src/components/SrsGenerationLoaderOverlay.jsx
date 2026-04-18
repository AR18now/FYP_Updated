import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

const GENERATING_HINTS = [
  'Structuring sections (IEEE 830)…',
  'Streaming model output — the timer reflects real generation time.',
  'Synthesizing introduction, scope, and system features…',
];

const WAITING_HINTS = [
  'Preparing your processing results…',
  'Almost ready to stream the SRS…',
];

const PROCESSING_HINTS = [
  'Running NLP preprocessing and validation on the server…',
  'Resolving ambiguities and extracting structured fields…',
  'The timer reflects your actual request duration — large files take longer.',
];

function useElapsedMsWhile(active) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) {
      setMs(0);
      return undefined;
    }
    const t0 = performance.now();
    const id = window.setInterval(() => setMs(performance.now() - t0), 100);
    return () => clearInterval(id);
  }, [active]);
  return ms;
}

function useRotatingHint(active, hints, resetKey) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [resetKey]);
  useEffect(() => {
    if (!active) {
      setI(0);
      return undefined;
    }
    const id = window.setInterval(() => setI((x) => (x + 1) % hints.length), 4500);
    return () => clearInterval(id);
  }, [active, hints.length]);
  return hints[i] || hints[0];
}

/**
 * Full-viewport loading surface for pipeline steps: requirement processing, SRS streaming, etc.
 */
export default function SrsGenerationLoaderOverlay({
  active,
  variant = 'generating',
  streamPreview = '',
  title,
  subtitle,
}) {
  const elapsedMs = useElapsedMsWhile(active);
  const hints =
    variant === 'waiting' ? WAITING_HINTS : variant === 'processing' ? PROCESSING_HINTS : GENERATING_HINTS;
  const hint = useRotatingHint(active, hints, variant);

  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active) return null;

  const heading =
    title ||
    (variant === 'waiting'
      ? 'Loading processed requirements'
      : variant === 'processing'
        ? 'Processing requirements'
        : 'Generating your SRS');
  const sub =
    subtitle ||
    (variant === 'waiting'
      ? 'Syncing the pipeline with this page — please wait.'
      : variant === 'processing'
        ? 'The backend is analyzing input, normalizing text, and preparing output. Please keep this tab open.'
        : 'The model is producing your document. You can read partial output as it arrives.');
  const sec = (elapsedMs / 1000).toFixed(1);
  const streamText = String(streamPreview || '');
  const showStream = variant === 'generating' && streamText.length > 0;
  const showStreamPlaceholder = variant === 'generating' && streamText.length === 0;
  const titleId = variant === 'processing' ? 'pipeline-loader-title' : 'srs-loader-title';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 dark:bg-black/55 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200/90 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 animate-fade-in">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-r2d-primary to-r2d-accent text-white shadow-lg">
            {variant === 'processing' ? (
              <Loader2 className="h-7 w-7 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-7 w-7 shrink-0 animate-pulse" aria-hidden />
            )}
          </div>
          <h2 id={titleId} className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
            {heading}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">{sub}</p>
          <div
            className="mt-1 inline-flex items-baseline gap-2 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 px-4 py-2 text-sm font-mono tabular-nums text-r2d-primary dark:text-r2d-accentSoft"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="text-slate-500 dark:text-slate-400 font-sans text-xs font-medium uppercase tracking-wide">
              Elapsed
            </span>
            <span className="font-semibold">{sec}s</span>
          </div>
          <p
            className="text-xs text-slate-500 dark:text-slate-400 max-w-md min-h-[2.5rem] transition-opacity duration-300"
            aria-live="polite"
          >
            {hint}
          </p>
        </div>

        <div className="mt-6 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className="srs-gen-indeterminate-inner h-full rounded-full bg-gradient-to-r from-r2d-primary via-r2d-accent to-r2d-primary" />
        </div>

        {showStreamPlaceholder && (
          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 italic">
            Waiting for the first tokens from the model…
          </p>
        )}
        {showStream && (
          <div className="mt-6 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Live output
            </p>
            <pre className="max-h-[min(38vh,280px)] overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
              {streamText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';

const DEFAULT_MS = 2600;

/**
 * Full-viewport presentation gate for “heavy” demo routes (metrics): shows a branded splash for
 * `delayMs`, then reveals children. Children stay mounted (opacity/pointer-events) so data hooks
 * can still run while the overlay is visible.
 *
 * Props: `title`, optional `subtitle`, optional `icon` (Lucide component), optional `delayMs`, `children`.
 */
function PresentationRouteSplash({ title, subtitle, icon: Icon = BarChart3, delayMs = DEFAULT_MS, children }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
    const t = window.setTimeout(() => setOpen(false), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  return (
    <div className="relative min-h-[50vh]">
      {open ? (
        <div
          className="presentation-splash-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-center"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="presentation-splash-blob presentation-splash-blob--a" aria-hidden />
          <span className="presentation-splash-blob presentation-splash-blob--b" aria-hidden />
          <span className="presentation-splash-blob presentation-splash-blob--c" aria-hidden />
          <div className="relative z-10 flex flex-col items-center gap-4 max-w-md">
            <div className="presentation-splash-icon-ring flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white shadow-lg backdrop-blur-md border border-white/20">
              <Icon className="h-8 w-8 opacity-95" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-semibold text-white tracking-tight">{title}</p>
              {subtitle ? (
                <p className="mt-2 text-sm text-slate-200/90 leading-relaxed">{subtitle}</p>
              ) : null}
            </div>
            <div className="w-48 h-1.5 rounded-full bg-white/15 overflow-hidden border border-white/10">
              <div className="presentation-splash-progress h-full rounded-full" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300/90 font-semibold">Req2Design</p>
          </div>
        </div>
      ) : null}
      <div className={open ? 'opacity-0 pointer-events-none select-none' : 'animate-page-reveal'}>{children}</div>
    </div>
  );
}

export default PresentationRouteSplash;

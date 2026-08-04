import React from 'react';
import type { LoadingState } from '../three/sceneManager';

/** Full-bleed boot screen with a real percentage from the LoadingManager. */
export const LoadingOverlay: React.FC<{ state: LoadingState }> = ({ state }) => {
  const percent = Math.round(Math.min(1, Math.max(0, state.progress)) * 100);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-slate-950/95 backdrop-blur">
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-red-500">Mazda MX-5</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Render Studio</h2>
      </div>

      <div className="w-64">
        <div className="h-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-600 to-amber-400 transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] text-slate-500">
          <span className="truncate pr-3">{state.label}</span>
          <span className="text-slate-300">{percent}%</span>
        </div>
      </div>
    </div>
  );
};

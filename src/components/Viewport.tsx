import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CarConfig } from '../config/types';
import { carData } from '../data/schema';
import { SceneManager, type LoadingState, type SceneStats } from '../three/sceneManager';
import { LoadingOverlay } from './LoadingOverlay';

export interface ViewportHandle {
  capture: (scale?: number) => string | null;
}

interface ViewportProps {
  config: CarConfig;
  onCameraPreset: (id: string) => void;
  handleRef: React.RefObject<ViewportHandle | null>;
}

/**
 * React owns the DOM node; `SceneManager` owns everything inside it. The only
 * data flowing in is the config object, and the only thing flowing out is
 * loading progress and render stats.
 */
export const Viewport: React.FC<ViewportProps> = ({ config, onCameraPreset, handleRef }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneManager | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ progress: 0, label: 'Starting engine', done: false });
  const [stats, setStats] = useState<SceneStats>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    usingFallbackModel: true,
    usingHdriEnvironment: false,
  });

  // Keep the latest config available to the async boot without re-running it.
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const manager = new SceneManager(mount, {
      onLoadingChange: setLoading,
      onStats: setStats,
    });
    sceneRef.current = manager;

    let cancelled = false;
    void manager.initialise(configRef.current).then(() => {
      // A config change may have landed while the scene was booting.
      if (!cancelled) void manager.setConfig(configRef.current);
    });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      manager.dispose();
    };
  }, []);

  useEffect(() => {
    void sceneRef.current?.setConfig(config);
  }, [config]);

  useImperativeHandle(handleRef, () => ({
    capture: (scale = 2) => sceneRef.current?.capture(scale) ?? null,
  }));

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div ref={mountRef} className="h-full w-full" />

      {!loading.done && <LoadingOverlay state={loading} />}

      {/* Live render telemetry */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 font-mono text-[10px] text-slate-300 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {stats.fps} FPS
          <span className="text-slate-600">|</span>
          {stats.drawCalls} calls
          <span className="text-slate-600">|</span>
          {(stats.triangles / 1000).toFixed(0)}k tris
        </span>
        {stats.usingFallbackModel && (
          <span
            className="rounded-full border border-amber-600/40 bg-amber-950/60 px-3 py-1 font-mono text-[10px] text-amber-300 backdrop-blur"
            title="No GLB found for this generation — rendering the parametric fallback mesh."
          >
            PROCEDURAL MESH
          </span>
        )}
        {!stats.usingHdriEnvironment && (
          <span
            className="rounded-full border border-sky-700/40 bg-sky-950/60 px-3 py-1 font-mono text-[10px] text-sky-300 backdrop-blur"
            title="No .hdr found for this environment — lighting from the code-generated rig."
          >
            GENERATED IBL
          </span>
        )}
      </div>

      {/* Camera presets */}
      <div className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-xl border border-slate-700/70 bg-slate-900/85 p-1 backdrop-blur">
        {carData.cameraPresets.map((preset) => {
          const active = preset.id === config.cameraPreset;
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              onClick={() => onCameraPreset(preset.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                active ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

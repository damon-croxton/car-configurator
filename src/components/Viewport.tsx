import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CarConfig } from '../config/types';
import { carData } from '../data/schema';
import type { IslandReport } from '../three/carModel';
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
    usingHdriEnvironment: false,
  });
  const [islands, setIslands] = useState<{ shown: IslandReport[]; total: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [cut, setCut] = useState<{ min: number; max: number; value: number | null } | null>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

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

  const toggleIslands = () => {
    if (islands) {
      sceneRef.current?.showIslandDebug(false);
      setIslands(null);
      setSelected(null);
      setCut(null);
    } else {
      const result = sceneRef.current?.showIslandDebug(true) ?? { shown: [], total: 0 };
      setIslands(result);
      setHiddenKeys(result.shown.filter((i) => i.hidden).map((i) => i.key));
      setCut(sceneRef.current?.roofCutRange() ?? null);
    }
  };

  /** Add or remove a part from the roof-lining set, and re-split immediately. */
  const toggleHidden = (key: string) => {
    const next = hiddenKeys.includes(key)
      ? hiddenKeys.filter((k) => k !== key)
      : [...hiddenKeys, key];
    setHiddenKeys(next);
    sceneRef.current?.setRoofLining(next, cut?.value ?? null);
  };

  const setCutValue = (value: number | null) => {
    setCut((prev) => (prev ? { ...prev, value } : prev));
    sceneRef.current?.setRoofLining(hiddenKeys, value);
  };

  const select = (index: number | null) => {
    setSelected(index);
    sceneRef.current?.highlightIsland(index);
    if (index !== null) {
      rowRefs.current[index]?.scrollIntoView({ block: 'nearest' });
    }
  };

  // Clicking the canvas picks an island — but the same drag orbits the camera,
  // so only treat it as a click when the pointer barely moved.
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const handlePointerDown = (event: React.PointerEvent) => {
    pressed.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event: React.PointerEvent) => {
    const start = pressed.current;
    pressed.current = null;
    if (!islands || !start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const hit = sceneRef.current?.pickIsland(event.clientX - rect.left, event.clientY - rect.top);
    select(hit ?? null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div
        ref={mountRef}
        className="h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />

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
        {!stats.usingHdriEnvironment && (
          <span
            className="rounded-full border border-sky-700/40 bg-sky-950/60 px-3 py-1 font-mono text-[10px] text-sky-300 backdrop-blur"
            title="No .hdr found for this environment — lighting from the code-generated rig."
          >
            GENERATED IBL
          </span>
        )}
        <button
          type="button"
          onClick={toggleIslands}
          title="Debug: colour each loose part of the cabin mesh that sits inside the roof volume."
          className={`pointer-events-auto rounded-full border px-3 py-1 font-mono text-[10px] backdrop-blur transition-colors ${
            islands
              ? 'border-amber-500 bg-amber-500/20 text-amber-200'
              : 'border-amber-700/40 bg-amber-950/60 text-amber-300 hover:bg-amber-900/60'
          }`}
        >
          {islands ? `ROOF ISLANDS (${islands.total})` : 'Debug: roof islands'}
        </button>
      </div>

      {/* Island debug legend */}
      {islands && (
        <div className="absolute left-4 top-16 flex max-h-[calc(100%-9rem)] w-72 flex-col rounded-xl border border-slate-700/70 bg-slate-900/90 p-3 backdrop-blur">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              Roof-volume loose parts
            </p>
            {selected !== null && (
              <button
                type="button"
                onClick={() => select(null)}
                className="font-mono text-[10px] text-amber-300 hover:text-amber-200"
              >
                clear
              </button>
            )}
          </div>

          {islands.total === 0 && (
            <p className="text-[11px] text-slate-400">
              None found. Switch to the ND — only it has a soft top.
            </p>
          )}

          <ul className="-mr-1 space-y-0.5 overflow-y-auto pr-1">
            {islands.shown.map((island) => {
              const active = selected === island.index;
              return (
                <li
                  key={island.index}
                  ref={(el) => { rowRefs.current[island.index] = el; }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="checkbox"
                    checked={hiddenKeys.includes(island.key)}
                    onChange={() => toggleHidden(island.key)}
                    title="Hide this part along with the roof"
                    className="h-3 w-3 shrink-0 accent-amber-500"
                  />
                  <button
                    type="button"
                    data-island-key={island.key}
                    onClick={() => select(active ? null : island.index)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors ${
                      active ? 'bg-amber-500/20 text-amber-100' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border border-black/40"
                      style={{ backgroundColor: island.colour }}
                    />
                    <span className="truncate font-mono">
                      #{island.index} · {island.triangles}t ·{' '}
                      {island.size.map((v) => v.toFixed(2)).join('×')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {cut && (
            <div className="mt-2 shrink-0 border-t border-slate-700/60 pt-2">
              <div className="mb-1 flex items-baseline justify-between">
                <label htmlFor="roof-cut" className="font-mono text-[10px] uppercase text-slate-400">
                  Height cut
                </label>
                <span className="font-mono text-[10px] text-slate-300">
                  {cut.value === null ? 'off' : `${cut.value.toFixed(3)} m`}
                </span>
              </div>
              <input
                id="roof-cut"
                type="range"
                min={cut.min}
                max={cut.max}
                step={0.002}
                value={cut.value ?? cut.max}
                onChange={(event) => setCutValue(Number(event.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                <span className="font-mono">{cut.min.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => setCutValue(null)}
                  className="text-amber-300 hover:text-amber-200"
                >
                  off
                </button>
                <span className="font-mono">{cut.max.toFixed(2)}</span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-slate-500">
                Hides anything <em>above</em> this height, but only inside the listed parts — so
                A-pillars keep their lower halves.
              </p>
            </div>
          )}

          <p className="mt-2 shrink-0 border-t border-slate-700/60 pt-2 text-[10px] leading-snug text-slate-500">
            Tick to hide a part with the roof. Click it to isolate. Set roof{' '}
            <span className="text-slate-300">Down</span> to see the result.
          </p>
        </div>
      )}

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

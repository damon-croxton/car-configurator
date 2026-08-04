import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  FileText,
  Link2,
  RotateCcw,
  Sliders,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { CarConfig, PresetBuild } from '../config/types';
import { PRESET_BUILDS } from '../config/presets';
import { buildShareUrl } from '../config/urlState';
import { getGeneration, getRoofType } from '../data/schema';
import { soundEngine } from '../utils/audioEngine';

interface HeaderProps {
  config: CarConfig;
  onApplyPreset: (preset: PresetBuild) => void;
  onOpenSpecSheet: () => void;
  onSnapshot: () => void;
  onReset: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onApplyPreset,
  onOpenSpecSheet,
  onSnapshot,
  onReset,
  onUndo,
  canUndo,
  onToggleSidebar,
}) => {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [revving, setRevving] = useState(false);
  const [shared, setShared] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  const generation = getGeneration(config.generation);
  const roof = getRoofType(config.roofType);

  useEffect(() => {
    if (!presetsOpen) return;
    const close = (event: MouseEvent) => {
      if (!presetsRef.current?.contains(event.target as Node)) setPresetsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [presetsOpen]);

  const handleShare = async () => {
    const url = buildShareUrl(config);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard can be blocked; the URL bar already holds the same link.
    }
    setShared(true);
    window.setTimeout(() => setShared(false), 1800);
  };

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-red-600 to-amber-500 text-[11px] font-bold tracking-wider text-white">
          {generation.code}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-100">Mazda MX-5 Configurator</h1>
          <p className="truncate font-mono text-[10px] text-slate-500">
            {generation.name} · {roof.shortName} {config.roofState}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative" ref={presetsRef}>
          <button
            type="button"
            onClick={() => setPresetsOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Presets</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {presetsOpen && (
            <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
              <p className="border-b border-slate-800 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Curated builds
              </p>
              <div className="max-h-[70vh] overflow-y-auto p-1.5">
                {PRESET_BUILDS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onApplyPreset(preset);
                      setPresetsOpen(false);
                    }}
                    className="group w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-800"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-red-400">
                        {preset.name}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-400 group-hover:bg-slate-700">
                        {preset.badge}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{preset.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <IconButton
          label="Engine sound"
          active={revving}
          onClick={() => soundEngine.toggleRev(config.exhaust, setRevving)}
        >
          {revving ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </IconButton>

        <IconButton label="Copy share link" active={shared} onClick={handleShare}>
          {shared ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        </IconButton>

        <IconButton label="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </IconButton>

        <IconButton label="Reset to factory" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
        </IconButton>

        <button
          type="button"
          onClick={onOpenSpecSheet}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Spec sheet</span>
        </button>

        <button
          type="button"
          onClick={onSnapshot}
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-red-500"
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Snapshot</span>
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle configurator"
          className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 lg:hidden"
        >
          <Sliders className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

const IconButton: React.FC<{
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`rounded-lg border p-2 transition-colors ${
      active
        ? 'border-red-500/60 bg-red-600/20 text-red-400'
        : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-100'
    } ${disabled ? 'cursor-not-allowed opacity-40 hover:text-slate-400' : ''}`}
  >
    {children}
  </button>
);

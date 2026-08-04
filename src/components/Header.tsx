import React, { useState } from 'react';
import { CameraPreset, CarConfig, PresetBuild } from '../types';
import { PRESET_BUILDS } from '../data/presets';
import { soundEngine } from '../utils/audioEngine';
import {
  Camera,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  FileText,
  Sliders,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  config: CarConfig;
  onChangeConfig: (newConfig: CarConfig) => void;
  selectedCamera: CameraPreset;
  onSelectCamera: (cam: CameraPreset) => void;
  onOpenSpecSheet: () => void;
  onTakeSnapshot: () => void;
  onReset: () => void;
  toggleSidebarMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onChangeConfig,
  selectedCamera,
  onSelectCamera,
  onOpenSpecSheet,
  onTakeSnapshot,
  onReset,
  toggleSidebarMobile,
}) => {
  const [isRevving, setIsRevving] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  const cameras: { id: CameraPreset; label: string }[] = [
    { id: 'hero_34', label: '3/4 Front' },
    { id: 'side', label: 'Side' },
    { id: 'rear_34', label: '3/4 Rear' },
    { id: 'front', label: 'Front' },
    { id: 'top', label: 'Top' },
    { id: 'low_stance', label: 'Stance' },
    { id: 'cockpit', label: 'Interior' },
  ];

  const handleToggleAudio = () => {
    soundEngine.toggleRev(config.exhaustStyle, (active) => setIsRevving(active));
  };

  const applyPreset = (preset: PresetBuild) => {
    onChangeConfig({
      ...config,
      ...preset.config,
    });
    setShowPresetDropdown(false);
  };

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-red-900/30 tracking-wider">
          ND
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            MAZDA MX-5 <span className="text-xs px-2 py-0.5 rounded bg-red-950/80 border border-red-800/80 text-red-400 font-mono">ND ROADSTER</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">
            3D Studio Render & Customizer
          </p>
        </div>
      </div>

      {/* Center Camera Angle Selector Pills */}
      <div className="hidden lg:flex items-center gap-1 bg-slate-950/60 border border-slate-800/80 p-1 rounded-full">
        {cameras.map((cam) => {
          const isActive = selectedCamera === cam.id;
          return (
            <button
              key={cam.id}
              onClick={() => onSelectCamera(cam.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {cam.label}
            </button>
          );
        })}
      </div>

      {/* Right Quick Actions */}
      <div className="flex items-center gap-2">
        {/* Preset Builds Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresetDropdown(!showPresetDropdown)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Preset Builds</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showPresetDropdown && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 divide-y divide-slate-800">
              <div className="px-3 py-2 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Select Custom Concept
              </div>
              <div className="py-1 space-y-1">
                {PRESET_BUILDS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-all flex flex-col group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-red-400">
                        {preset.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {preset.badge}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      {preset.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Audio Engine Rev Button */}
        <button
          onClick={handleToggleAudio}
          className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
            isRevving
              ? 'bg-red-600/20 border-red-500 text-red-400 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          title="Engine Sound Simulator"
        >
          {isRevving ? (
            <>
              <Volume2 className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline font-mono text-red-400">REVVING</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline font-mono">EXHAUST SOUND</span>
            </>
          )}
        </button>

        {/* Spec Sheet Modal Button */}
        <button
          onClick={onOpenSpecSheet}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all"
          title="Build Spec Sheet"
        >
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="hidden md:inline">Spec Sheet</span>
        </button>

        {/* Snapshot Capture Button */}
        <button
          onClick={onTakeSnapshot}
          className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-lg shadow-red-900/40 flex items-center gap-1.5 transition-all"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">Render Snapshot</span>
        </button>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all"
          title="Reset to Factory OEM"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Mobile Customizer Toggle */}
        <button
          onClick={toggleSidebarMobile}
          className="lg:hidden p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

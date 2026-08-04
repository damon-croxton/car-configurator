import React from 'react';
import { CarConfig } from '../types';
import { X, Check, Copy, Download, Share2, Award, Zap, Scale } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BuildSummaryModalProps {
  config: CarConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const BuildSummaryModal: React.FC<BuildSummaryModalProps> = ({
  config,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    const buildCode = btoa(JSON.stringify(config));
    navigator.clipboard.writeText(buildCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  // Calculate estimated stats based on modifications
  const weightSavedKg =
    (config.hoodStyle === 'carbon_vented' ? 4 : 0) +
    (config.exhaustStyle === 'tomei_single_big' ? 11 : 0) +
    (config.wheelStyle === 'volk_te37' || config.wheelStyle === 'enkei_rpf1' ? 6 : 0) +
    (config.interiorColor === 'recaro_bucket' ? 12 : 0);

  const totalEstWeight = 1040 - weightSavedKg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-400 font-bold font-mono">
              ND
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                MAZDA MX-5 ND SPECIFICATION
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {config.paintName} • Custom Roadster Build
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Specs Content Grid */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Performance Metrics Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                <Scale className="w-4 h-4 text-amber-400" />
                <span>Curb Weight</span>
              </div>
              <div className="text-lg font-bold text-slate-100 mt-2 font-mono">
                {totalEstWeight} <span className="text-xs text-slate-400 font-normal">kg</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-1">
                -{weightSavedKg} kg vs Stock
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                <Zap className="w-4 h-4 text-red-400" />
                <span>Engine Power</span>
              </div>
              <div className="text-lg font-bold text-slate-100 mt-2 font-mono">
                181 <span className="text-xs text-slate-400 font-normal">HP</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                SkyActiv-G 2.0L @ 7,000 RPM
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                <Award className="w-4 h-4 text-cyan-400" />
                <span>Balance</span>
              </div>
              <div className="text-lg font-bold text-slate-100 mt-2 font-mono">
                50 : 50
              </div>
              <div className="text-[10px] text-cyan-400 font-mono mt-1">
                Front-Midship Distribution
              </div>
            </div>
          </div>

          {/* Config Detail Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Build Modification Manifest
            </h3>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 divide-y divide-slate-800/80 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Exterior Color:</span>
                <span className="font-semibold text-slate-200">{config.paintName} ({config.paintFinish})</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Roof Configuration:</span>
                <span className="font-semibold text-slate-200 capitalize">{config.roofType.replace('_', ' ')}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Wheel Setup:</span>
                <span className="font-semibold text-slate-200 capitalize">{config.wheelStyle.replace('_', ' ')} ({config.wheelFinish.replace('_', ' ')})</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Suspension Drop:</span>
                <span className="font-semibold text-red-400 font-mono">
                  {config.suspensionDrop === 0 ? 'Factory OEM' : `Lowered -${(config.suspensionDrop * 3.5).toFixed(1)}" (${config.camberAngle.toFixed(1)}° Camber)`}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Front Aero Splitter:</span>
                <span className="font-semibold text-slate-200 capitalize">{config.frontLip.replace('_', ' ')}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Rear Spoiler:</span>
                <span className="font-semibold text-slate-200 capitalize">{config.spoilerStyle.replace('_', ' ')}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Exhaust System:</span>
                <span className="font-semibold text-slate-200 capitalize">{config.exhaustStyle.replace('_', ' ')}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Cockpit Upholstery:</span>
                <span className="font-semibold text-slate-200 capitalize">{config.interiorColor.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={handleCopyCode}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? 'Build Code Copied!' : 'Copy Share Code'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-900/40 transition-all"
          >
            Close Spec Sheet
          </button>
        </div>
      </div>
    </div>
  );
};

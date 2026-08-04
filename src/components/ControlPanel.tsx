import React, { useState } from 'react';
import {
  CarConfig,
  FrontLipStyle,
  InteriorColor,
  PaintFinish,
  RearDiffuserStyle,
  RoofColor,
  RoofType,
  SideSkirtStyle,
  SpoilerStyle,
  StudioEnvironment,
  WheelFinish,
  WheelStyle,
  ExhaustStyle,
} from '../types';
import { CUSTOM_PAINTS, OEM_PAINTS } from '../data/presets';
import {
  Palette,
  Disc,
  Layers,
  Sparkles,
  Sliders,
  Sun,
  Shield,
  Check,
  Zap,
} from 'lucide-react';

interface ControlPanelProps {
  config: CarConfig;
  onChangeConfig: (newConfig: CarConfig) => void;
}

type TabType = 'paint' | 'roof' | 'wheels' | 'bodykit' | 'interior' | 'studio';

export const ControlPanel: React.FC<ControlPanelProps> = ({ config, onChangeConfig }) => {
  const [activeTab, setActiveTab] = useState<TabType>('paint');

  const updateConfig = <K extends keyof CarConfig>(key: K, value: CarConfig[K]) => {
    onChangeConfig({
      ...config,
      [key]: value,
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'paint', label: 'Paint & Finish', icon: <Palette className="w-4 h-4" /> },
    { id: 'roof', label: 'Roof System', icon: <Shield className="w-4 h-4" /> },
    { id: 'wheels', label: 'Wheels & Stance', icon: <Disc className="w-4 h-4" /> },
    { id: 'bodykit', label: 'Aero & Exhaust', icon: <Layers className="w-4 h-4" /> },
    { id: 'interior', label: 'Cockpit & Tint', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'studio', label: 'Lighting & FX', icon: <Sun className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-full lg:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 flex flex-col h-full overflow-hidden select-none z-20">
      {/* Category Tabs Header */}
      <div className="flex items-center overflow-x-auto border-b border-slate-800 p-2 gap-1 scrollbar-none bg-slate-950/40 shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-red-600 text-white font-semibold shadow-md shadow-red-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-slate-200 text-xs">
        {/* ============================================================== */}
        {/* TAB 1: PAINT & FINISH                                         */}
        {/* ============================================================== */}
        {activeTab === 'paint' && (
          <div className="space-y-6">
            {/* OEM Mazda Paint Swatches */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Factory OEM Mazda Colors
                </h3>
                <span className="text-[10px] text-red-400 font-mono">KODO Design</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {OEM_PAINTS.map((p) => {
                  const isSelected = config.paintColor === p.hex;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        updateConfig('paintColor', p.hex);
                        updateConfig('paintName', p.name);
                        updateConfig('paintFinish', p.type);
                      }}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        isSelected
                          ? 'border-red-500 bg-red-950/20 shadow-md shadow-red-950/50'
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-lg shrink-0 border border-white/20 shadow-inner flex items-center justify-center"
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-slate-200 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{p.type}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Tuning Colors & Wraps */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Aftermarket Colors & Wraps
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {CUSTOM_PAINTS.map((p) => {
                  const isSelected = config.paintColor === p.hex;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        updateConfig('paintColor', p.hex);
                        updateConfig('paintName', p.name);
                        updateConfig('paintFinish', p.type);
                      }}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        isSelected
                          ? 'border-red-500 bg-red-950/20 shadow-md shadow-red-950/50'
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-lg shrink-0 border border-white/20 shadow-inner flex items-center justify-center"
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-slate-200 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{p.type}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hex Color Picker */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Custom Hex Color Picker</span>
                <span className="font-mono text-slate-400 uppercase">{config.paintColor}</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.paintColor}
                  onChange={(e) => {
                    updateConfig('paintColor', e.target.value);
                    updateConfig('paintName', 'Custom Customization');
                  }}
                  className="w-10 h-10 rounded-lg border-0 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={config.paintColor}
                  onChange={(e) => updateConfig('paintColor', e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Paint Finish Selector */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Paint Clearcoat & Finish Type
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {(['gloss', 'metallic', 'pearl', 'matte', 'chrome'] as PaintFinish[]).map((finish) => (
                  <button
                    key={finish}
                    onClick={() => updateConfig('paintFinish', finish)}
                    className={`p-2 rounded-lg border text-center capitalize text-xs font-medium transition-all ${
                      config.paintFinish === finish
                        ? 'bg-red-600 text-white border-red-500 font-bold'
                        : 'bg-slate-800/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {finish}
                  </button>
                ))}
              </div>
            </div>

            {/* Clearcoat Gloss Slider */}
            <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span>Clearcoat Gloss Intensity</span>
                <span className="font-mono text-red-400">{Math.round(config.clearcoatGloss * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.clearcoatGloss}
                onChange={(e) => updateConfig('clearcoatGloss', parseFloat(e.target.value))}
                className="w-full accent-red-600 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ROOF SYSTEM                                            */}
        {/* ============================================================== */}
        {activeTab === 'roof' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Roof Configuration
              </h3>
              <div className="space-y-2">
                {[
                  { id: 'softtop_open', title: 'Open Top Roadster', desc: 'Open-air roadster with visible roll hoops and cockpit.' },
                  { id: 'softtop_closed', title: 'Soft Top Canopy Up', desc: 'Closed canvas convertible roof with rear glass window.' },
                  { id: 'rf_hardtop', title: 'RF Retractable Fastback', desc: 'Power targa hardtop with flying buttress pillars.' },
                ].map((roof) => (
                  <button
                    key={roof.id}
                    onClick={() => updateConfig('roofType', roof.id as RoofType)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      config.roofType === roof.id
                        ? 'bg-red-950/30 border-red-500 shadow-md'
                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{roof.title}</span>
                      {config.roofType === roof.id && <Zap className="w-4 h-4 text-red-400" />}
                    </div>
                    <span className="text-[11px] text-slate-400">{roof.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Roof Canopy Material Color */}
            {config.roofType === 'softtop_closed' && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                  Soft Top Canvas Material Color
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'black', label: 'Black Cloth', hex: '#1a1a1a' },
                    { id: 'tan', label: 'Heritage Tan', hex: '#78350f' },
                    { id: 'cherry', label: 'Dark Cherry', hex: '#881337' },
                  ].map((rc) => (
                    <button
                      key={rc.id}
                      onClick={() => updateConfig('roofColor', rc.id as RoofColor)}
                      className={`p-2.5 rounded-xl border text-center font-medium transition-all flex flex-col items-center gap-1.5 ${
                        config.roofColor === rc.id
                          ? 'border-red-500 bg-red-950/20'
                          : 'border-slate-800 bg-slate-800/40'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full border border-white/20"
                        style={{ backgroundColor: rc.hex }}
                      />
                      <span className="text-[11px] text-slate-300">{rc.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: WHEELS & STANCE                                        */}
        {/* ============================================================== */}
        {activeTab === 'wheels' && (
          <div className="space-y-6">
            {/* Wheel Styles */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Wheel Design & Brand
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'oem_17', name: 'OEM 17" 8-Spoke', desc: 'Factory Lightweight Alloy' },
                  { id: 'volk_te37', name: 'Rays Volk TE37', desc: 'Forged 6-Spoke Concave' },
                  { id: 'enkei_rpf1', name: 'Enkei RPF1', desc: 'F1 Twin 5-Spoke Mesh' },
                  { id: 'bbs_rs', name: 'BBS RS 3-Piece', desc: 'Classic Step Lip Mesh' },
                  { id: 'work_s1', name: 'Work Meister S1', desc: 'Deep Dish 5-Spoke' },
                  { id: 'rotiform_lasr', name: 'Rotiform LAS-R', desc: 'Aero Turbofan Mesh' },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => updateConfig('wheelStyle', w.id as WheelStyle)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.wheelStyle === w.id
                        ? 'border-red-500 bg-red-950/20 shadow-md'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-200">{w.name}</div>
                    <div className="text-[10px] text-slate-400">{w.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Wheel Finishes */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Wheel Finish
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'satin_black', label: 'Satin Black' },
                  { id: 'bronze', label: 'Bronze' },
                  { id: 'hyper_silver', label: 'Hyper Silver' },
                  { id: 'gunmetal', label: 'Gunmetal' },
                  { id: 'chrome', label: 'Chrome' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => updateConfig('wheelFinish', f.id as WheelFinish)}
                    className={`p-2 rounded-lg border text-center text-xs font-medium transition-all ${
                      config.wheelFinish === f.id
                        ? 'bg-red-600 text-white border-red-500 font-bold'
                        : 'bg-slate-800/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Suspension Height Drop (Stance) */}
            <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span>Suspension Height (Stance Drop)</span>
                <span className="font-mono text-red-400">
                  {config.suspensionDrop === 0
                    ? 'Stock Height'
                    : config.suspensionDrop > 0.8
                    ? 'Air Slammed (-4.0")'
                    : `Lowered -${(config.suspensionDrop * 3.5).toFixed(1)}"`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.suspensionDrop}
                onChange={(e) => updateConfig('suspensionDrop', parseFloat(e.target.value))}
                className="w-full accent-red-600 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Wheel Camber Angle */}
            <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span>Negative Wheel Camber</span>
                <span className="font-mono text-red-400">{config.camberAngle.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min="-5"
                max="0"
                step="0.2"
                value={config.camberAngle}
                onChange={(e) => updateConfig('camberAngle', parseFloat(e.target.value))}
                className="w-full accent-red-600 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Wheel Spacers / Fitment Offset */}
            <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span>Wheel Spacers / Track Width</span>
                <span className="font-mono text-red-400">
                  {config.wheelSpacerOffset > 0.7 ? 'Aggressive Flush' : 'OEM Track'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.wheelSpacerOffset}
                onChange={(e) => updateConfig('wheelSpacerOffset', parseFloat(e.target.value))}
                className="w-full accent-red-600 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Brake Caliper Colors */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Brembo Brake Caliper Color
              </h3>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Red', hex: '#cc0000' },
                  { name: 'Yellow', hex: '#eab308' },
                  { name: 'Acid Green', hex: '#10b981' },
                  { name: 'Silver', hex: '#94a3b8' },
                  { name: 'Blue', hex: '#2563eb' },
                  { name: 'Black', hex: '#18181b' },
                ].map((c) => (
                  <button
                    key={c.name}
                    onClick={() => updateConfig('caliperColor', c.hex)}
                    className={`w-8 h-8 rounded-full border border-white/20 transition-all flex items-center justify-center ${
                      config.caliperColor === c.hex ? 'ring-2 ring-red-500 scale-110' : ''
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {config.caliperColor === c.hex && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: AERO & EXHAUST                                         */}
        {/* ============================================================== */}
        {activeTab === 'bodykit' && (
          <div className="space-y-6">
            {/* Front Lip Splitter */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Front Lip / Splitter Aero
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'stock', label: 'Stock OEM Front' },
                  { id: 'mazdaspeed', label: 'Mazdaspeed Lip' },
                  { id: 'apr_carbon', label: 'APR Carbon Splitter' },
                  { id: 'leg_motorsport', label: 'Leg Motor Sport' },
                ].map((lip) => (
                  <button
                    key={lip.id}
                    onClick={() => updateConfig('frontLip', lip.id as FrontLipStyle)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.frontLip === lip.id
                        ? 'border-red-500 bg-red-950/20'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-200">{lip.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rear Spoiler / Wing */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Rear Spoiler & Wings
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'none', label: 'Clean (No Spoiler)' },
                  { id: 'oem_ducktail', label: 'OEM Ducktail Lip' },
                  { id: 'carbon_lip', label: 'Carbon Fiber Spoiler' },
                  { id: 'voltex_gt_wing', label: 'Voltex GT Wing' },
                ].map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => updateConfig('spoilerStyle', sp.id as SpoilerStyle)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.spoilerStyle === sp.id
                        ? 'border-red-500 bg-red-950/20'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-200">{sp.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Exhaust Tips & Sound System */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Exhaust System & Tips
              </h3>
              <div className="space-y-2">
                {[
                  { id: 'stock_single', label: 'Stock Single Exit', desc: 'OEM SkyActiv-G 2.0L sound' },
                  { id: 'oem_dual', label: 'OEM Dual Polish Tips', desc: 'Slightly throatier dual tips' },
                  { id: 'titanium_quad', label: 'Titanium Quad Exhaust', desc: 'Quad burnt blue titanium tips' },
                  { id: 'tomei_single_big', label: 'Tomei Titanium Single Big Bore', desc: 'Lightweight high-pitch track exhaust' },
                ].map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => updateConfig('exhaustStyle', ex.id as ExhaustStyle)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                      config.exhaustStyle === ex.id
                        ? 'border-red-500 bg-red-950/20'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-200">{ex.label}</div>
                    <div className="text-[10px] text-slate-400">{ex.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hood Style */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Engine Hood Options
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'stock', label: 'Stock Body Color' },
                  { id: 'carbon_vented', label: 'Carbon Vented Hood' },
                ].map((h) => (
                  <button
                    key={h.id}
                    onClick={() => updateConfig('hoodStyle', h.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.hoodStyle === h.id
                        ? 'border-red-500 bg-red-950/20'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-200">{h.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: COCKPIT & TINT                                         */}
        {/* ============================================================== */}
        {activeTab === 'interior' && (
          <div className="space-y-6">
            {/* Interior Seats */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Seats & Cockpit Upholstery
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'black_leather', name: 'Black Nappa Leather', desc: 'Red Contrast Stitching' },
                  { id: 'tan_nappa', name: 'Tan Heritage Nappa', desc: 'Luxury GT Finish' },
                  { id: 'red_alcantara', name: 'Red Alcantara', desc: 'Sport Suede Trim' },
                  { id: 'recaro_bucket', name: 'Recaro Carbon Buckets', desc: 'Track Competition' },
                ].map((ic) => (
                  <button
                    key={ic.id}
                    onClick={() => updateConfig('interiorColor', ic.id as InteriorColor)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.interiorColor === ic.id
                        ? 'border-red-500 bg-red-950/20'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-200">{ic.name}</div>
                    <div className="text-[10px] text-slate-400">{ic.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Window Tint Slider */}
            <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span>Windshield Window Tint</span>
                <span className="font-mono text-red-400">{Math.round(config.windowTint * 100)}% Dark</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={config.windowTint}
                onChange={(e) => updateConfig('windowTint', parseFloat(e.target.value))}
                className="w-full accent-red-600 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* License Plate Customizer */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Custom License Plate
              </h3>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Plate Text</label>
                <input
                  type="text"
                  maxLength={8}
                  value={config.licensePlateText}
                  onChange={(e) => updateConfig('licensePlateText', e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-sm uppercase text-slate-100 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Plate Style</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'jdm', label: 'JDM Green/White' },
                    { id: 'california', label: 'California White' },
                    { id: 'euro', label: 'Euro Long' },
                    { id: 'black_gold', label: 'CA Legacy Black/Gold' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => updateConfig('licensePlateStyle', st.id as any)}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                        config.licensePlateStyle === st.id
                          ? 'bg-red-600 text-white border-red-500'
                          : 'bg-slate-800/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: LIGHTING & STUDIO FX                                   */}
        {/* ============================================================== */}
        {activeTab === 'studio' && (
          <div className="space-y-6">
            {/* Studio Environment Presets */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Studio Backdrop & Ambiance
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'dark_studio', name: 'Dark Spotlight', desc: 'Minimalist High-Contrast' },
                  { id: 'golden_hour', name: 'Golden Hour Sunset', desc: 'Warm Natural Directional' },
                  { id: 'tokyo_night', name: 'Tokyo Highway Night', desc: 'Shinjuku Neon Lights' },
                  { id: 'sunset_coast', name: 'Pacific Sunset Coast', desc: 'Warm Golden Horizon' },
                  { id: 'industrial_warehouse', name: 'Industrial Warehouse', desc: 'Exposed Steel Spotlight' },
                  { id: 'desert_salt_flats', name: 'Bonneville Salt Flats', desc: 'High-Key Pure White' },
                  { id: 'alpine_pass', name: 'Alpine Mountain Pass', desc: 'Cool Morning Atmosphere' },
                  { id: 'clean_white', name: 'Exhibition White', desc: 'Pure Showroom Studio' },
                  { id: 'cyber_neon', name: 'Cyber Neon City', desc: 'Cyan & Magenta Accents' },
                ].map((env) => (
                  <button
                    key={env.id}
                    onClick={() => updateConfig('environment', env.id as StudioEnvironment)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.environment === env.id
                        ? 'border-red-500 bg-red-950/20 shadow-md'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-200">{env.name}</div>
                    <div className="text-[10px] text-slate-400">{env.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Lighting Toggles */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Vehicle Lights & FX
              </h3>
              <div className="space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-medium text-slate-300">LED Headlights & DRL Glow</span>
                  <input
                    type="checkbox"
                    checked={config.headlightsOn}
                    onChange={(e) => updateConfig('headlightsOn', e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-medium text-slate-300">Teardrop Rear Taillights</span>
                  <input
                    type="checkbox"
                    checked={config.taillightsOn}
                    onChange={(e) => updateConfig('taillightsOn', e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-medium text-slate-300">Wheels Motion Spin</span>
                  <input
                    type="checkbox"
                    checked={config.wheelsRotating}
                    onChange={(e) => updateConfig('wheelsRotating', e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Floor Reflection Intensity */}
            <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span>Studio Floor Mirror Reflection</span>
                <span className="font-mono text-red-400">{Math.round(config.floorReflection * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.floorReflection}
                onChange={(e) => updateConfig('floorReflection', parseFloat(e.target.value))}
                className="w-full accent-red-600 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

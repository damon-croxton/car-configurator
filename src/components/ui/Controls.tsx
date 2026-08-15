import React from 'react';
import { Check } from 'lucide-react';

/** Shared building blocks for the configurator panel. */

export const Section: React.FC<{
  title: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ title, hint, children }) => (
  <section className="space-y-3">
    <header className="flex items-baseline justify-between gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
      {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
    </header>
    {children}
  </section>
);

export interface Option {
  id: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  /** Short pill shown against the label — used to mark options with a 3D part. */
  badge?: string;
}

export const OptionGrid: React.FC<{
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  columns?: 1 | 2 | 3;
}> = ({ options, value, onChange, columns = 2 }) => (
  <div
    className={`grid gap-2 ${columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
  >
    {options.map((option) => {
      const active = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
          aria-pressed={active}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            active
              ? 'border-red-500/70 bg-red-500/10 text-slate-50'
              : 'border-slate-700/70 bg-slate-800/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
          } ${option.disabled ? 'cursor-not-allowed opacity-35 hover:border-slate-700/70 hover:bg-slate-800/40' : ''}`}
        >
          <span className="flex items-start justify-between gap-1.5">
            <span className="block text-xs font-medium leading-tight">{option.label}</span>
            {option.badge && (
              <span
                title="This part is modelled — selecting it changes the car"
                className="mt-px shrink-0 rounded bg-emerald-400/15 px-1 py-px text-[9px] font-semibold uppercase leading-none tracking-wide text-emerald-300"
              >
                {option.badge}
              </span>
            )}
          </span>
          {option.sublabel && (
            <span className="mt-0.5 block text-[10px] leading-tight text-slate-500">{option.sublabel}</span>
          )}
        </button>
      );
    })}
  </div>
);

export interface IconOption {
  id: string;
  label: string;
  /** Path to a small square thumbnail — a real render, not a generic glyph. */
  icon: string;
}

/**
 * A dense grid of thumbnail buttons, for choices numerous enough (or visual
 * enough) that OptionGrid's full-width label rows waste more space than they
 * earn. Each tile is a real image, not a stand-in icon — the whole point is
 * that a wheel's silhouette tells you more at a glance than its name does.
 */
export const IconOptionGrid: React.FC<{
  options: IconOption[];
  /** Empty string means "none selected" — only meaningful when allowDeselect. */
  value: string;
  onChange: (id: string) => void;
  columns?: 3 | 4 | 5;
  /** Clicking the already-active tile calls onChange('') instead of no-op. */
  allowDeselect?: boolean;
}> = ({ options, value, onChange, columns = 4, allowDeselect = false }) => (
  <div
    className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : columns === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}
  >
    {options.map((option) => {
      const active = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          title={option.label}
          onClick={() => onChange(active && allowDeselect ? '' : option.id)}
          aria-pressed={active}
          className={`group flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
            active
              ? 'border-red-500/70 bg-red-500/10'
              : 'border-slate-700/70 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800'
          }`}
        >
          <span className="aspect-square w-full overflow-hidden rounded-md bg-slate-950/40">
            <img src={option.icon} alt="" className="h-full w-full object-contain" draggable={false} />
          </span>
          <span
            className={`block w-full truncate text-center text-[9px] font-medium leading-tight ${
              active ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200'
            }`}
          >
            {option.label}
          </span>
        </button>
      );
    })}
  </div>
);

export const SegmentedControl: React.FC<{
  options: Option[];
  value: string;
  onChange: (id: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex rounded-lg border border-slate-700/70 bg-slate-900/60 p-1">
    {options.map((option) => {
      const active = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
          aria-pressed={active}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
            active ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
          } ${option.disabled ? 'cursor-not-allowed opacity-35' : ''}`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export interface Swatch {
  id: string;
  name: string;
  hex: string;
  caption?: string;
}

export const SwatchGrid: React.FC<{
  swatches: Swatch[];
  value: string;
  onChange: (id: string) => void;
}> = ({ swatches, value, onChange }) => (
  <div className="grid grid-cols-5 gap-2">
    {swatches.map((swatch) => {
      const active = swatch.id === value;
      return (
        <button
          key={swatch.id}
          type="button"
          title={`${swatch.name}${swatch.caption ? ` · ${swatch.caption}` : ''}`}
          onClick={() => onChange(swatch.id)}
          aria-label={swatch.name}
          aria-pressed={active}
          className={`relative aspect-square rounded-lg border-2 transition-transform ${
            active ? 'border-red-500 scale-105' : 'border-slate-700/70 hover:border-slate-500'
          }`}
        >
          <span
            className="absolute inset-[3px] rounded-[5px] shadow-inner"
            style={{
              background: `linear-gradient(150deg, ${swatch.hex} 0%, ${swatch.hex} 55%, rgba(255,255,255,0.28) 100%)`,
            }}
          />
          {active && (
            <Check className="absolute inset-0 m-auto h-4 w-4 drop-shadow" strokeWidth={3} color="#fff" />
          )}
        </button>
      );
    })}
  </div>
);

export const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 1, format, onChange }) => (
  <label className="block space-y-1.5">
    <span className="flex items-baseline justify-between text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-200">{format ? format(value) : value}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number.parseFloat(event.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-red-500"
    />
  </label>
);

export const ToggleRow: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-800/40 px-3 py-2 text-left transition-colors hover:border-slate-500"
  >
    <span>
      <span className="block text-xs font-medium text-slate-200">{label}</span>
      {hint && <span className="mt-0.5 block text-[10px] text-slate-500">{hint}</span>}
    </span>
    <span
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-red-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          checked ? 'left-[1.125rem]' : 'left-0.5'
        }`}
      />
    </span>
  </button>
);

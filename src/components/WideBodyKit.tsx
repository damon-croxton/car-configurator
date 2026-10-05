import React from 'react';
import type { CarConfig } from '../config/types';
import { aeroOptionsFor, type AeroSlotId, type Generation } from '../data/schema';
import type { ModEntry } from '../data/mods';

/** Aero options that belong to the wide-body kit, by slot. */
export const WIDE_BODY_OPTIONS: Partial<Record<AeroSlotId, string[]>> = {
  frontLip: ['wide_body_lip'],
  sideSkirts: ['wide_body_skirts'],
  rearDiffuser: ['wide_body_diffuser'],
  rearWing: ['wide_ducktail', 'carbon_wide_ducktail'],
};

export const isWideBodyOption = (slot: AeroSlotId, id: string) =>
  WIDE_BODY_OPTIONS[slot]?.includes(id) ?? false;

/**
 * The Rocket Bunny / Pandem-style kit in one place: overfenders (extras in
 * the `widebody` area) plus the kit's lip, skirts, diffuser and ducktail
 * (aero slot options), with a one-tap "fit the lot".
 */
export const WideBodyKit: React.FC<{
  config: CarConfig;
  generation: Generation;
  fenders: ModEntry[];
  onChange: (patch: Partial<CarConfig>) => void;
  onToggleExtra: (id: string, on: boolean) => void;
}> = ({ config, generation, fenders, onChange, onToggleExtra }) => {
  const has = (slot: AeroSlotId, id: string) => aeroOptionsFor(generation, slot).some((o) => o.id === id);
  const stock = (slot: AeroSlotId) => aeroOptionsFor(generation, slot)[0].id;
  const fitted = fenders.find((m) => config.extraMods.includes(m.id));
  const toggles: { slot: AeroSlotId; id: string; label: string }[] = [
    { slot: 'frontLip', id: 'wide_body_lip', label: 'Front lip' },
    { slot: 'sideSkirts', id: 'wide_body_skirts', label: 'Side skirts' },
    { slot: 'rearDiffuser', id: 'wide_body_diffuser', label: 'Diffuser' },
  ].filter((t) => has(t.slot as AeroSlotId, t.id)) as { slot: AeroSlotId; id: string; label: string }[];
  const ducktails = (WIDE_BODY_OPTIONS.rearWing ?? []).filter((id) => has('rearWing', id));
  const partCount = [fitted, ...toggles.map((t) => config[t.slot] === t.id), ducktails.includes(config.rearWing as string)]
    .filter(Boolean).length;

  const fitAll = () => {
    if (!fitted && fenders[0]) onToggleExtra(fenders[0].id, true);
    onChange({
      ...Object.fromEntries(toggles.map((t) => [t.slot, t.id])),
      ...(ducktails.length && !ducktails.includes(config.rearWing as string) ? { rearWing: ducktails[0] } : {}),
    } as Partial<CarConfig>);
  };
  const removeAll = () => {
    if (fitted) onToggleExtra(fitted.id, false);
    onChange({
      ...Object.fromEntries(toggles.filter((t) => config[t.slot] === t.id).map((t) => [t.slot, stock(t.slot)])),
      ...(ducktails.includes(config.rearWing as string) ? { rearWing: stock('rearWing') } : {}),
    } as Partial<CarConfig>);
  };

  return (
    <section className="space-y-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.04] p-3">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300">Wide-body kit</h3>
        <span className="text-[10px] text-slate-500">{partCount} of {2 + toggles.length} fitted</span>
      </header>
      <p className="text-[10px] leading-relaxed text-slate-400">
        Rocket Bunny / Pandem-style bolt-on kit. The overfenders push the wheels out to fill them.
      </p>

      <Row label="Overfenders">
        <Pill label="None" active={!fitted} onClick={() => fitted && onToggleExtra(fitted.id, false)} />
        {fenders.map((mod) => (
          <Pill
            key={mod.id}
            label={mod.displayName.replace(/ ?Wide-Body Overfenders/, '') || 'Body colour'}
            title={mod.uiHint}
            active={fitted?.id === mod.id}
            onClick={() => onToggleExtra(mod.id, fitted?.id !== mod.id)}
          />
        ))}
      </Row>

      {ducktails.length > 0 && (
        <Row label="Ducktail">
          <Pill label="None" active={!ducktails.includes(config.rearWing as string)}
            onClick={() => ducktails.includes(config.rearWing as string) && onChange({ rearWing: stock('rearWing') })} />
          {ducktails.map((id) => (
            <Pill key={id} label={id.startsWith('carbon') ? 'Carbon' : 'Body colour'} active={config.rearWing === id}
              onClick={() => onChange({ rearWing: id })} />
          ))}
        </Row>
      )}

      <Row label="Kit parts">
        {toggles.map((t) => (
          <Pill key={t.id} label={t.label} active={config[t.slot] === t.id}
            onClick={() => onChange({ [t.slot]: config[t.slot] === t.id ? stock(t.slot) : t.id } as Partial<CarConfig>)} />
        ))}
      </Row>

      <div className="flex gap-2 pt-0.5">
        <button type="button" onClick={fitAll}
          className="flex-1 rounded-md bg-red-600 px-2 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-red-500">
          Fit full kit
        </button>
        <button type="button" onClick={removeAll} disabled={partCount === 0}
          className="rounded-md border border-slate-700/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-40">
          Remove
        </button>
      </div>
    </section>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    <div className="flex flex-wrap gap-1">{children}</div>
  </div>
);

const Pill: React.FC<{ label: string; title?: string; active: boolean; onClick: () => void }> = ({
  label, title, active, onClick,
}) => (
  <button
    type="button"
    aria-pressed={active}
    title={title}
    onClick={onClick}
    className={`rounded-md border px-2 py-1 text-[10.5px] leading-tight transition-colors ${
      active
        ? 'border-red-500/70 bg-red-500/10 text-slate-50'
        : 'border-slate-700/70 bg-slate-800/40 text-slate-300 hover:border-slate-500'
    }`}
  >
    {label}
  </button>
);

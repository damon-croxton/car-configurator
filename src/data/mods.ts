import modsData from './modsData.json';
import type { CarConfig } from '../config/types';

/**
 * Typed access to the mod catalogue, and the rule for which mods a build shows.
 *
 * The interesting part is that almost nothing new is needed to drive them.
 * `carData.json` has always listed aero and wheel options — `gt_wing`,
 * `vented_carbon`, `enkei_rpf1` — and they have always been inert, because the
 * base assets have no such parts. A mod that adopts one of those ids makes the
 * control that already exists do something.
 *
 * See mx5-mod-modelling-brief.md §7.1 and §8.
 */

export interface ModEntry {
  id: string;
  gen: string[];
  category: string;
  displayName: string;
  /** A `CarConfig` field name, or null when no control exists yet. */
  slot: string | null;
  /** The id in that field's catalogue this mod *is*. */
  optionId: string | null;
  attachType: 'bolt_on' | 'replace';
  attachTo: 'body' | 'wheel';
  /** App-space point (mm) the geometry was exported relative to. Wheels only. */
  originMm?: Record<string, [number, number, number]>;
  /** Base-asset node names to switch off, per generation. */
  hides?: Record<string, string[]>;
  /** Base-asset surface classes to switch off — how wheels are hidden. */
  hidesSurfaceClasses?: string[];
  incompatibleWith?: string[];
  requires?: string[];
  anchors?: Record<string, string[]>;
  materials: string[];
  bboxMm?: Record<string, { min: number[]; max: number[] }>;
  triangleBudget?: number;
  /** Short line shown under the toggle in the panel — e.g. a triangle-count
   *  warning for a heavy comparison asset. Distinct from the JSON's `$note`
   *  fields, which are documentation for the catalogue file, not the UI. */
  uiHint?: string;
  /** True for mods that keep their own baked-texture materials instead of
   *  the flat §3 contract (the Wasi204 wheel pack) — the Wheel finish
   *  picker has no effect on these, which the panel uses to decide whether
   *  a sourced wheel belongs with the recolourable styles or the pack grid. */
  materialContractExempt?: boolean;
  file: Record<string, string>;
  flags?: { requiresFenderRoll?: boolean; trackWidening?: number };
  derivedFromBaseMesh?: boolean;
}

const MODS = (modsData.mods as unknown as ModEntry[]) ?? [];

/** Every catalogued mod that has an asset for this generation. */
export function modsFor(generationId: string): ModEntry[] {
  return MODS.filter((m) => m.gen.includes(generationId) && Boolean(m.file?.[generationId]));
}

export function modById(id: string): ModEntry | undefined {
  return MODS.find((m) => m.id === id);
}

/**
 * The mod that a given catalogue option actually renders as, if any.
 *
 * The panel uses this to mark which choices change the car and which only move
 * the spec sheet. That distinction has always existed — most aero ids have
 * never had geometry behind them — but until now there was no way to see it
 * without selecting one and noticing nothing happened.
 */
export function modForOption(
  generationId: string,
  slot: string,
  optionId: string,
): ModEntry | undefined {
  return modsFor(generationId).find((m) => m.slot === slot && m.optionId === optionId);
}

/**
 * Mods with no catalogue slot of their own — additive bolt-ons that are simply
 * on or off. They live in `CarConfig.extraMods`.
 */
export function optionalMods(generationId: string): ModEntry[] {
  // 'test' mods (sourced-asset comparison pairs, decimation A/B tests) are
  // real, loadable, validated entries — but they are not meant to be a
  // permanent panel option, so they stay out of "Additional parts" and are
  // only reachable by naming them explicitly in ?mods=.
  return modsFor(generationId).filter((m) => m.slot === null && m.category !== 'test');
}

/**
 * Mod ids forced on by `?mods=BP04,DT07` in the address bar.
 *
 * Some finished assets have no `CarConfig` field yet — a boot lid and bonnet
 * hardware have nowhere to live in the schema — so there is no way to select
 * them through the UI. Rather than invent controls before the shape of them is
 * settled, this lets a build be inspected now. It is additive and deliberately
 * outside the shareable config: `urlState.ts` neither writes nor reads it.
 */
export function parseModIds(search: string): string[] {
  const raw = new URLSearchParams(search).get('mods');
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Read once, at import, and remembered.
 *
 * `urlState.ts` rewrites the address bar to the keys it knows about as soon as
 * the app boots, so `?mods=` is gone by the time the scene asks for it. Reading
 * at module load happens first, and means a reload still honours the parameter
 * even though it no longer appears in the bar.
 */
const FORCED = typeof window === 'undefined' ? [] : parseModIds(window.location.search);

export function forcedModIds(): string[] {
  return FORCED;
}

/**
 * The mods a build should be showing.
 *
 * A mod is on when the `CarConfig` field it claims holds the option id it
 * represents — so choosing "GT Wing" in the panel that already exists is what
 * fits the GT wing. Forced ids are then layered on top for review.
 */
export function activeMods(generationId: string, config: CarConfig, forced: string[] = []): ModEntry[] {
  const available = modsFor(generationId);
  const chosen = new Map<string, ModEntry>();

  for (const mod of available) {
    if (!mod.slot || !mod.optionId) continue;
    const selected = (config as unknown as Record<string, unknown>)[mod.slot];
    if (selected === mod.optionId) chosen.set(mod.id, mod);
  }

  for (const id of config.extraMods ?? []) {
    const mod = available.find((m) => m.id === id);
    if (mod) chosen.set(mod.id, mod);
  }

  for (const id of forced) {
    const mod = available.find((m) => m.id === id);
    if (mod) chosen.set(mod.id, mod);
  }

  // A mod that declares an incompatibility wins over the one it excludes only
  // if it was selected later, so resolve deterministically by catalogue order.
  const picked = [...chosen.values()];
  return picked.filter(
    (mod) => !picked.some((other) => other !== mod && other.incompatibleWith?.includes(mod.id)),
  );
}

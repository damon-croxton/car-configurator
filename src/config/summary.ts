import type { CarConfig } from './types';
import { AERO_SLOTS } from './defaults';
import {
  getAeroPart,
  getCabinFinish,
  getCaliperColor,
  getGeneration,
  getInteriorTrim,
  getPaintColor,
  getPaintFinish,
  getRoofFabric,
  getRoofType,
  getStancePreset,
  getWheelFinish,
  getWheelStyle,
  carData,
  type AeroSlotId,
} from '../data/schema';
import { activeMods } from '../data/mods';
import { modelHasClass } from '../data/surfaces';

export interface SpecLine {
  group: string;
  label: string;
  value: string;
  /**
   * Extra cost over the base car, in the catalogue's currency units. A rough
   * placeholder, not a quote: most figures are derived from catalogue weight
   * and downforce, and the spec sheet labels them as estimates.
   */
  price: number;
}

export interface BuildSummary {
  title: string;
  lines: SpecLine[];
  weightKg: number;
  weightDeltaKg: number;
  powerHp: number;
  powerDeltaHp: number;
  downforceKg: number;
  total: number;
  basePrice: number;
}

const BASE_PRICE = 34_500;

const AERO_LABELS: Record<AeroSlotId, string> = {
  frontLip: 'Front lip',
  sideSkirts: 'Side skirts',
  rearDiffuser: 'Rear diffuser',
  rearWing: 'Rear wing',
  hood: 'Hood',
  exhaust: 'Exhaust',
  rollBar: 'Roll bar',
};

/** Placeholder part pricing derived from the catalogue's weight/downforce figures. */
function aeroPrice(slot: AeroSlotId, id: string): number {
  const part = getAeroPart(slot, id);
  if (part.id.startsWith('stock') || part.id === 'none' || part.id === 'wing_delete') return 0;
  const material = part.material === 'carbon' || part.material === 'titanium' ? 3.2 : 1.4;
  return Math.round((220 + part.downforce * 22 + Math.abs(part.weight) * 55) * material);
}

/** `rear_aero` and `rear aero` both appear in the catalogue; show either as "Rear aero". */
const categoryLabel = (category: string) => {
  const words = category.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Closest stance preset for the current ride height, for display purposes. */
export function describeStance(config: CarConfig): string {
  const nearest = carData.stancePresets.reduce((best, preset) =>
    Math.abs(preset.drop - config.rideHeight) < Math.abs(best.drop - config.rideHeight) ? preset : best,
  );
  const exact = Math.abs(nearest.drop - config.rideHeight) < 4;
  return exact ? nearest.name : `${nearest.name} (${config.rideHeight} mm)`;
}

export function buildSummary(config: CarConfig): BuildSummary {
  const generation = getGeneration(config.generation);
  const paint = getPaintColor(config.paint);
  const finish = getPaintFinish(config.paintFinishOverride || paint.finish);
  const roof = getRoofType(config.roofType);
  const wheel = getWheelStyle(config.wheelStyle);
  const wheelFinish = getWheelFinish(config.wheelFinish);
  const interior = getInteriorTrim(config.interiorTrim);
  const mods = activeMods(config.generation, config);
  // A sourced or pack wheel lives in extraMods and overrides wheelStyle on the
  // car, so the sheet must name it rather than the style it replaced.
  const fittedWheel = mods.find((m) => m.attachTo === 'wheel');
  const sourcedWheel = fittedWheel && !fittedWheel.slot ? fittedWheel : undefined;
  const extras = mods.filter((m) => m.attachTo === 'body' && !m.slot);

  const lines: SpecLine[] = [];

  lines.push({
    group: 'Model',
    label: 'Generation',
    value: `${generation.code} — ${generation.name} (${generation.years})`,
    price: 0,
  });
  const hasSoftTop = modelHasClass(generation.surfaceModel, 'soft_top');
  lines.push({
    group: 'Model',
    label: 'Roof',
    value: hasSoftTop ? `${roof.name} · ${config.roofState === 'up' ? 'Up' : 'Down'}` : 'Open (no roof modelled)',
    price: config.roofType === 'rf' ? 3_100 : 0,
  });
  if (hasSoftTop && roof.supportsFabricColor) {
    lines.push({
      group: 'Model',
      label: 'Roof fabric',
      value: getRoofFabric(config.roofFabric).name,
      price: config.roofFabric === 'black' ? 0 : 420,
    });
  }

  lines.push({
    group: 'Paint',
    label: 'Colour',
    value: `${paint.name}${paint.code ? ` (${paint.code})` : ''}`,
    price: paint.premium,
  });
  lines.push({ group: 'Paint', label: 'Finish', value: finish.name, price: 0 });

  lines.push({
    group: 'Wheels',
    label: 'Style',
    value: `${sourcedWheel ? sourcedWheel.displayName : `${wheel.brand} ${wheel.name}`} · ${config.wheelDiameter}"`,
    price: sourcedWheel || !wheel.oem ? 2_400 : 0,
  });
  lines.push({ group: 'Wheels', label: 'Finish', value: wheelFinish.name, price: wheelFinish.id === 'chrome' ? 900 : 0 });
  lines.push({ group: 'Wheels', label: 'Ride height', value: describeStance(config), price: config.rideHeight < -5 ? 1_850 : 0 });
  lines.push({ group: 'Wheels', label: 'Camber', value: `${config.camber.toFixed(1)}°`, price: 0 });
  lines.push({ group: 'Wheels', label: 'Track offset', value: `${config.trackOffset} mm per corner`, price: config.trackOffset > 2 ? 260 : 0 });
  // Only listed when they are on the car — the stock wheel has no brake meshes.
  if (fittedWheel && config.wheelBrakes) {
    const paintable = fittedWheel.materials.includes('MOD_CaliperPaint');
    lines.push({
      group: 'Wheels',
      label: 'Brakes',
      value: paintable ? `Shown · ${getCaliperColor(config.caliperColor).name} calipers` : 'Shown · supplied finish',
      price: paintable && config.caliperColor !== 'powder_black' ? 340 : 0,
    });
  }

  let aeroWeight = 0;
  let downforce = 0;
  let powerDelta = 0;
  for (const slot of AERO_SLOTS) {
    const part = getAeroPart(slot, config[slot] as string);
    aeroWeight += part.weight;
    downforce += part.downforce;
    powerDelta += part.power ?? 0;
    lines.push({ group: 'Aero', label: AERO_LABELS[slot], value: part.name, price: aeroPrice(slot, part.id) });
  }
  // Toggle-on accessories carry no catalogue weight or price, so they are
  // listed for completeness without inventing figures for them.
  for (const mod of extras) {
    lines.push({ group: 'Additional parts', label: categoryLabel(mod.category), value: mod.displayName, price: 0 });
  }

  lines.push({ group: 'Interior', label: 'Cabin', value: interior.name, price: interior.id === 'black_leather' ? 0 : 1_250 });
  // Per-part finishes are only listed when they differ from the cabin theme.
  for (const [part, field, label, price] of [
    ['seats', 'seatTrim', 'Seats', 1_450], ['wheel', 'wheelTrim', 'Steering wheel', 380],
    ['accent', 'trimAccent', 'Dash & door trim', 260], ['insert', 'doorInsert', 'Door inserts', 180],
  ] as const) {
    const finish = getCabinFinish(part, config[field]);
    if (finish) lines.push({ group: 'Interior', label, value: finish.name, price });
  }
  lines.push({
    group: 'Glass & lights',
    label: 'Window tint',
    value: config.windowTint === 0 ? 'Clear (OEM)' : `${Math.round((1 - config.windowTint) * 100)}% VLT`,
    price: config.windowTint > 0.05 ? 380 : 0,
  });
  lines.push({
    group: 'Glass & lights',
    label: 'Light mods',
    value:
      [config.smokedIndicators && 'Smoked indicators', config.tintedHeadlights && 'Tinted housings']
        .filter(Boolean)
        .join(' · ') || 'None',
    price: (config.smokedIndicators ? 180 : 0) + (config.tintedHeadlights ? 240 : 0),
  });

  // Relative to this generation's own stock wheel, not the ND's.
  const stockWheel = getWheelStyle(generation.defaultWheel);
  const wheelWeight = sourcedWheel ? 0 : (wheel.weightPerCorner - stockWheel.weightPerCorner) * 4;
  const weightDelta = Math.round(aeroWeight + roof.weightDelta + interior.weight + wheelWeight);
  const total = lines.reduce((sum, line) => sum + line.price, BASE_PRICE);

  return {
    title: `${generation.code} ${roof.shortName} · ${paint.name}`,
    lines,
    weightKg: generation.specs.weight + weightDelta,
    weightDeltaKg: weightDelta,
    powerHp: generation.specs.power + powerDelta,
    powerDeltaHp: powerDelta,
    downforceKg: downforce,
    total,
    basePrice: BASE_PRICE,
  };
}

/** Human-readable one-liner for the stance preset currently in effect. */
export function stancePresetName(config: CarConfig): string {
  return getStancePreset(
    carData.stancePresets.reduce((best, preset) =>
      Math.abs(preset.drop - config.rideHeight) < Math.abs(best.drop - config.rideHeight) ? preset : best,
    ).id,
  ).name;
}

export { BASE_PRICE };

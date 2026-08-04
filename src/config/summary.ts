import type { CarConfig } from './types';
import { AERO_SLOTS } from './defaults';
import {
  getAeroPart,
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

export interface SpecLine {
  group: string;
  label: string;
  value: string;
  /** Extra cost over the base car, in the catalogue's currency units. */
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

/** Rough part pricing derived from the catalogue's weight/downforce figures. */
function aeroPrice(slot: AeroSlotId, id: string): number {
  const part = getAeroPart(slot, id);
  if (part.id.startsWith('stock') || part.id === 'none' || part.id === 'wing_delete') return 0;
  const material = part.material === 'carbon' || part.material === 'titanium' ? 3.2 : 1.4;
  return Math.round((220 + part.downforce * 22 + Math.abs(part.weight) * 55) * material);
}

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

  const lines: SpecLine[] = [];

  lines.push({
    group: 'Model',
    label: 'Generation',
    value: `${generation.code} — ${generation.name} (${generation.years})`,
    price: 0,
  });
  lines.push({
    group: 'Model',
    label: 'Roof',
    value: `${roof.name} · ${config.roofState === 'up' ? 'Up' : 'Down'}`,
    price: config.roofType === 'rf' ? 3_100 : 0,
  });
  if (roof.supportsFabricColor) {
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
    group: 'Paint',
    label: 'Caliper paint',
    value: getCaliperColor(config.caliperColor).name,
    price: config.caliperColor === 'powder_black' ? 0 : 340,
  });

  lines.push({
    group: 'Wheels',
    label: 'Style',
    value: `${wheel.brand} ${wheel.name} · ${config.wheelDiameter}"`,
    price: wheel.oem ? 0 : 2_400,
  });
  lines.push({ group: 'Wheels', label: 'Finish', value: wheelFinish.name, price: wheelFinish.id === 'chrome' ? 900 : 0 });
  lines.push({ group: 'Wheels', label: 'Ride height', value: describeStance(config), price: config.rideHeight < -5 ? 1_850 : 0 });
  lines.push({ group: 'Wheels', label: 'Camber', value: `${config.camber.toFixed(1)}°`, price: 0 });
  lines.push({ group: 'Wheels', label: 'Track offset', value: `${config.trackOffset} mm per corner`, price: config.trackOffset > 2 ? 260 : 0 });

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

  lines.push({ group: 'Interior', label: 'Trim', value: interior.name, price: interior.id === 'black_leather' ? 0 : 1_250 });
  lines.push({
    group: 'Interior',
    label: 'Window tint',
    value: config.windowTint === 0 ? 'Clear (OEM)' : `${Math.round((1 - config.windowTint) * 100)}% VLT`,
    price: config.windowTint > 0.05 ? 380 : 0,
  });
  lines.push({
    group: 'Interior',
    label: 'Light mods',
    value:
      [config.smokedIndicators && 'Smoked indicators', config.tintedHeadlights && 'Tinted housings']
        .filter(Boolean)
        .join(' · ') || 'None',
    price: (config.smokedIndicators ? 180 : 0) + (config.tintedHeadlights ? 240 : 0),
  });

  const weightDelta = Math.round(aeroWeight + roof.weightDelta + interior.weight + (wheel.weightPerCorner - 9.1) * 4);
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

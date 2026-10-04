import type { CarConfig } from './types';
import {
  getCabinFinish,
  aeroOptionsFor,
  carData,
  getGeneration,
  getPaintColor,
  materialsData,
  roofOptionsFor,
  wheelOptionsFor,
  type AeroSlotId,
} from '../data/schema';
import { optionalMods, resolveModConflicts } from '../data/mods';
import { cabinControls } from '../data/surfaces';

export const AERO_SLOTS: AeroSlotId[] = [
  'frontLip',
  'sideSkirts',
  'rearDiffuser',
  'rearWing',
  'hood',
  'exhaust',
  'rollBar',
];

export const DEFAULT_CONFIG: CarConfig = {
  generation: 'nd',
  roofType: 'st',
  roofState: 'up',
  roofFabric: 'black',

  paint: 'soul_red',
  paintCustomHex: '#ff2d55',
  paintFinishOverride: '',
  flakeIntensity: 0.7,
  clearcoat: 1.0,
  caliperColor: 'brembo_red',

  // The car arrives stock. Before mods existed these defaults were a styling
  // choice and only ever moved the spec sheet; now that the catalogue ids are
  // wired to real geometry, a ducktail and twin tips here would mean the app
  // opens on a modified car and gives you nothing to compare against.
  wheelStyle: 'oem_17_design',
  wheelFinish: 'gunmetal',
  wheelSheen: '',
  wheelPackTint: '',
  wheelDiameter: 17,
  rideHeight: 0,
  camber: -0.5,
  trackOffset: 0,
  wheelBrakes: false,
  tyreWidth: 1,
  tyreSidewall: 1,
  tyreVisible: true,

  extraMods: [],

  frontLip: 'stock',
  sideSkirts: 'stock',
  rearDiffuser: 'stock',
  rearWing: 'wing_delete',
  hood: 'stock',
  exhaust: 'stock_single',
  rollBar: 'none',
  smokedIndicators: false,
  tintedHeadlights: false,

  interiorTrim: 'black_leather',
  seatTrim: '',
  wheelTrim: '',
  trimAccent: '',
  doorInsert: '',
  // Glass and lamps now render, so these launch as the asset was authored:
  // clear glass, lamps off. (Both used to be inert, which is why they were
  // ever on by default.)
  windowTint: 0,

  environment: 'salt_flats',
  headlights: false,
  taillights: false,
  drl: true,
  exposure: 1.0,
  bloom: false,
  ssao: false,
  contactShadow: true,
  groundReflection: 0.3,

  wheelSpin: false,
  turntable: false,
  cameraPreset: 'exterior_360',
};

/** Clamp helper shared by the UI sliders and the URL decoder. */
export const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;

export const RANGES = {
  rideHeight: [-90, 15] as const,
  camber: [-5, 1] as const,
  trackOffset: [-10, 35] as const,
  tyreWidth: [0.75, 1.35] as const,
  tyreSidewall: [0.55, 1.35] as const,
  windowTint: [0, 0.85] as const,
  exposure: [0.4, 1.8] as const,
  flakeIntensity: [0, 1] as const,
  clearcoat: [0, 1] as const,
  groundReflection: [0, 1] as const,
};

/**
 * Force a config onto options the chosen generation actually offers. Called
 * after every mutation so switching generation (or loading a hand-edited URL)
 * can never leave a dangling part id pointing at nothing.
 */
export function reconcileConfig(config: CarConfig): CarConfig {
  const generation = getGeneration(config.generation);
  const next: CarConfig = { ...config, generation: generation.id };

  const roofs = roofOptionsFor(generation);
  if (!roofs.some((r) => r.id === next.roofType)) next.roofType = generation.defaultRoofType;

  if (!carData.interiorTrims.some((t) => t.id === next.interiorTrim)) {
    next.interiorTrim = DEFAULT_CONFIG.interiorTrim;
  }
  // Per-part cabin finishes: unknown ids, or parts this car cannot colour
  // separately, fall back to matching the cabin.
  const controls = cabinControls(generation.surfaceModel ?? generation.id);
  for (const [field, part] of [['seatTrim', 'seats'], ['wheelTrim', 'wheel'], ['trimAccent', 'accent'],
    ['doorInsert', 'insert']] as const) {
    if (!controls.includes(part) || !getCabinFinish(part, next[field])) next[field] = '';
  }

  const wheels = wheelOptionsFor(generation);
  if (!wheels.some((w) => w.id === next.wheelStyle)) next.wheelStyle = generation.defaultWheel;
  if (!materialsData.wheelSheens.some((sheen) => sheen.id === next.wheelSheen)) next.wheelSheen = '';

  if (!generation.wheelDiameters.includes(next.wheelDiameter)) {
    next.wheelDiameter = generation.defaultWheelDiameter;
  }

  for (const slot of AERO_SLOTS) {
    const options = aeroOptionsFor(generation, slot);
    if (!options.some((o) => o.id === next[slot])) {
      next[slot] = options[0].id;
    }
  }

  if (!carData.cameraPresets.some((c) => c.id === next.cameraPreset)) {
    next.cameraPreset = carData.cameraPresets[0].id;
  }

  // Drop extras this generation has no asset for, the same way a dangling aero
  // id gets dropped — a hand-edited URL or a generation switch must not leave
  // one pointing at nothing.
  const offered = new Map(optionalMods(generation.id).map((mod) => [mod.id, mod]));
  const extras = [...new Set(next.extraMods ?? [])].flatMap((id) => {
    const mod = offered.get(id);
    return mod ? [mod] : [];
  });
  next.extraMods = resolveModConflicts(extras).map((mod) => mod.id);

  next.paint = getPaintColor(next.paint).id;
  next.rideHeight = clamp(next.rideHeight, ...RANGES.rideHeight);
  next.camber = clamp(next.camber, ...RANGES.camber);
  next.trackOffset = clamp(next.trackOffset, ...RANGES.trackOffset);
  next.windowTint = clamp(next.windowTint, ...RANGES.windowTint);
  next.exposure = clamp(next.exposure, ...RANGES.exposure);
  next.flakeIntensity = clamp(next.flakeIntensity, ...RANGES.flakeIntensity);
  next.clearcoat = clamp(next.clearcoat, ...RANGES.clearcoat);
  next.groundReflection = clamp(next.groundReflection, ...RANGES.groundReflection);

  return next;
}

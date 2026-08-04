import type { CarConfig } from './types';
import {
  aeroOptionsFor,
  carData,
  getGeneration,
  getPaintColor,
  roofOptionsFor,
  wheelOptionsFor,
  type AeroSlotId,
} from '../data/schema';

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
  roofState: 'down',
  roofFabric: 'black',

  paint: 'soul_red',
  paintCustomHex: '#ff2d55',
  paintFinishOverride: '',
  flakeIntensity: 0.7,
  clearcoat: 1.0,
  caliperColor: 'brembo_red',

  wheelStyle: 'oem_17_design',
  wheelFinish: 'gunmetal',
  wheelDiameter: 17,
  rideHeight: -30,
  camber: -1.6,
  trackOffset: 8,

  frontLip: 'stock',
  sideSkirts: 'stock',
  rearDiffuser: 'stock',
  rearWing: 'oem_ducktail',
  hood: 'stock',
  exhaust: 'oem_dual',
  rollBar: 'none',
  smokedIndicators: false,
  tintedHeadlights: false,

  interiorTrim: 'black_leather',
  windowTint: 0.28,

  environment: 'studio',
  headlights: true,
  taillights: true,
  drl: true,
  exposure: 1.0,
  bloom: true,
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

  const wheels = wheelOptionsFor(generation);
  if (!wheels.some((w) => w.id === next.wheelStyle)) next.wheelStyle = generation.defaultWheel;

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

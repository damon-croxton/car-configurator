/**
 * Typed access layer over the data-driven JSON catalogues.
 *
 * Everything the configurator renders — generations, roofs, wheels, aero parts,
 * paints, environments — is described in `carData.json` / `materialsData.json`.
 * Nothing in `src/three` or `src/components` hard-codes an option id, so adding
 * a new wheel or colour is a JSON edit plus (optionally) a procedural mesh recipe.
 */
import carDataRaw from './carData.json';
import materialsDataRaw from './materialsData.json';

/* ------------------------------------------------------------------ */
/* Car catalogue                                                       */
/* ------------------------------------------------------------------ */

export type GenerationId = 'na' | 'nb' | 'nc' | 'nd';
export type RoofTypeId = 'st' | 'rf';
export type RoofState = 'up' | 'down';

export interface GenerationSpecs {
  engine: string;
  power: number;
  torque: number;
  weight: number;
  layout: string;
  balance: string;
  gearbox: string;
  redline: number;
}

export interface GenerationDimensions {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  trackFront: number;
  trackRear: number;
}

export interface AeroSlots {
  frontLip: string[];
  sideSkirts: string[];
  rearDiffuser: string[];
  rearWing: string[];
  hood: string[];
  exhaust: string[];
  rollBar: string[];
}

export type AeroSlotId = keyof AeroSlots;

export interface Generation {
  id: GenerationId;
  code: string;
  name: string;
  years: string;
  available: boolean;
  /** Path to this generation's glTF. Absent for generations with no model yet. */
  assetUrl?: string;
  /** Key into `surfaceClasses.json` → `models`. Absent means no classification. */
  surfaceModel?: string;
  /** Yaw in degrees to turn the asset so its nose points +Z, matching the camera presets. */
  modelYawDeg?: number;
  tagline: string;
  specs: GenerationSpecs;
  dimensions: GenerationDimensions;
  roofTypes: RoofTypeId[];
  defaultRoofType: RoofTypeId;
  wheels: string[];
  defaultWheel: string;
  wheelDiameters: number[];
  defaultWheelDiameter: number;
  aero: AeroSlots;
}

export interface RoofTypeDef {
  id: RoofTypeId;
  name: string;
  shortName: string;
  description: string;
  nodes: { up: string; down: string };
  supportsFabricColor: boolean;
  weightDelta: number;
}

export type SpokeType =
  | 'twin_five'
  | 'mesh_ten'
  | 'six_spoke'
  | 'split_five'
  | 'mesh_cross'
  | 'eight_spoke';

export interface WheelStyleDef {
  id: string;
  name: string;
  brand: string;
  spokeType: SpokeType;
  spokeCount: number;
  lipDepth: number;
  weightPerCorner: number;
  oem: boolean;
  description: string;
}

export interface AeroPartDef {
  id: string;
  name: string;
  node: string;
  material: 'paint' | 'carbon' | 'trim' | 'chrome' | 'titanium' | 'metal' | 'none';
  downforce: number;
  weight: number;
  power?: number;
}

export interface StancePreset {
  id: string;
  name: string;
  drop: number;
  camber: number;
  spacer: number;
  description: string;
}

export interface InteriorTrimDef {
  id: string;
  name: string;
  seatHex: string;
  trimHex: string;
  stitchHex: string;
  roughness: number;
  weight: number;
}

export interface CameraPresetDef {
  id: string;
  name: string;
  hint: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  minDistance: number;
  maxDistance: number;
}

export interface CarCatalogue {
  version: number;
  defaultGeneration: GenerationId;
  generations: Generation[];
  roofTypes: RoofTypeDef[];
  wheelStyles: WheelStyleDef[];
  aeroParts: Record<AeroSlotId, AeroPartDef[]>;
  stancePresets: StancePreset[];
  interiorTrims: InteriorTrimDef[];
  cameraPresets: CameraPresetDef[];
}

/* ------------------------------------------------------------------ */
/* Material catalogue                                                  */
/* ------------------------------------------------------------------ */

export type PaintFinishId = 'solid' | 'metallic' | 'pearl' | 'matte' | 'chrome';

export interface PaintFinishDef {
  id: PaintFinishId;
  name: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  flake: number;
  sheen: number;
  iridescence: number;
  envIntensity: number;
}

export interface PaintColorDef {
  id: string;
  name: string;
  hex: string;
  finish: PaintFinishId;
  flakeHex?: string;
  code?: string;
  premium: number;
  userColor?: boolean;
}

export interface WheelFinishDef {
  id: string;
  name: string;
  hex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  /** Dynamic finish: hex/metalness/roughness/clearcoat are placeholders,
   *  overridden at apply time with the car's current body paint. */
  matchBody?: boolean;
}

export interface CaliperColorDef {
  id: string;
  name: string;
  hex: string;
  metalness?: number;
  roughness?: number;
}

export interface SimpleColorDef {
  id: string;
  name: string;
  hex: string;
}

export interface GlassDef {
  transmission: number;
  ior: number;
  roughness: number;
  thickness: number;
  baseTintHex: string;
  darkTintHex: string;
  tintLevels: { id: string; name: string; value: number }[];
}

export interface LightModsDef {
  headlightHousingClear: string;
  headlightHousingTinted: string;
  indicatorClear: string;
  indicatorSmoked: string;
  headlightEmissive: string;
  drlEmissive: string;
  taillightEmissive: string;
  taillightOff: string;
}

export interface EnvPanelDef {
  color: string;
  intensity: number;
  position: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number];
}

export interface EnvLightDef {
  color: string;
  intensity: number;
  position: [number, number, number];
}

export interface EnvironmentDef {
  id: string;
  name: string;
  hint: string;
  hdri: string;
  exposure: number;
  envIntensity: number;
  backgroundMode: 'gradient' | 'environment' | 'color';
  backgroundTop: string;
  backgroundBottom: string;
  backgroundBlur: number;
  fogColor: string;
  fogDensity: number;
  groundHex: string;
  groundRoughness: number;
  groundMetalness: number;
  gridHex: string;
  shadowOpacity: number;
  /**
   * Multiplier applied to the key/fill/rim lights when a real HDRI supplies the
   * IBL. Those intensities were calibrated against the deliberately weak
   * procedural environment, so an HDRI would otherwise double-light the car.
   * The procedural path always runs at 1.0.
   */
  practicalScale: number;
  procedural: {
    skyTop: string;
    skyHorizon: string;
    skyBottom: string;
    panels: EnvPanelDef[];
  };
  key: EnvLightDef;
  fill: EnvLightDef;
  rim: EnvLightDef;
}

export interface MaterialCatalogue {
  version: number;
  paintFinishes: PaintFinishDef[];
  oemColors: PaintColorDef[];
  wrapColors: PaintColorDef[];
  wheelFinishes: WheelFinishDef[];
  caliperColors: CaliperColorDef[];
  roofFabricColors: SimpleColorDef[];
  glass: GlassDef;
  lightMods: LightModsDef;
  environments: EnvironmentDef[];
}

/* ------------------------------------------------------------------ */
/* Loaded catalogues                                                   */
/* ------------------------------------------------------------------ */

export const carData = carDataRaw as unknown as CarCatalogue;
export const materialsData = materialsDataRaw as unknown as MaterialCatalogue;

export const allPaintColors: PaintColorDef[] = [
  ...materialsData.oemColors,
  ...materialsData.wrapColors,
];

/* ------------------------------------------------------------------ */
/* Lookup helpers — every one falls back to the first entry rather than */
/* returning undefined, so a stale URL can never blank out the scene.   */
/* ------------------------------------------------------------------ */

function pick<T extends { id: string }>(list: T[], id: string | undefined): T {
  return list.find((entry) => entry.id === id) ?? list[0];
}

export const getGeneration = (id: string | undefined): Generation =>
  carData.generations.find((g) => g.id === id && g.available) ??
  carData.generations.find((g) => g.id === carData.defaultGeneration) ??
  carData.generations[0];

export const getRoofType = (id: string | undefined): RoofTypeDef =>
  pick(carData.roofTypes, id);

export const getWheelStyle = (id: string | undefined): WheelStyleDef =>
  pick(carData.wheelStyles, id);

export const getAeroPart = (slot: AeroSlotId, id: string | undefined): AeroPartDef =>
  pick(carData.aeroParts[slot], id);

export const getStancePreset = (id: string | undefined): StancePreset =>
  pick(carData.stancePresets, id);

export const getInteriorTrim = (id: string | undefined): InteriorTrimDef =>
  pick(carData.interiorTrims, id);

export const getCameraPreset = (id: string | undefined): CameraPresetDef =>
  pick(carData.cameraPresets, id);

export const getPaintColor = (id: string | undefined): PaintColorDef =>
  pick(allPaintColors, id);

export const getPaintFinish = (id: string | undefined): PaintFinishDef =>
  pick(materialsData.paintFinishes, id);

export const getWheelFinish = (id: string | undefined): WheelFinishDef =>
  pick(materialsData.wheelFinishes, id);

export const getCaliperColor = (id: string | undefined): CaliperColorDef =>
  pick(materialsData.caliperColors, id);

export const getRoofFabric = (id: string | undefined): SimpleColorDef =>
  pick(materialsData.roofFabricColors, id);

export const getEnvironment = (id: string | undefined): EnvironmentDef =>
  pick(materialsData.environments, id);

/** Aero options actually offered by a generation, in catalogue order. */
export function aeroOptionsFor(generation: Generation, slot: AeroSlotId): AeroPartDef[] {
  const allowed = generation.aero[slot];
  return carData.aeroParts[slot].filter((part) => allowed.includes(part.id));
}

/** Wheel styles actually offered by a generation, in catalogue order. */
export function wheelOptionsFor(generation: Generation): WheelStyleDef[] {
  return carData.wheelStyles.filter((w) => generation.wheels.includes(w.id));
}

/** Roof types actually offered by a generation, in catalogue order. */
export function roofOptionsFor(generation: Generation): RoofTypeDef[] {
  return carData.roofTypes.filter((r) => generation.roofTypes.includes(r.id));
}

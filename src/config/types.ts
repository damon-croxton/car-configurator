import type { GenerationId, RoofState, RoofTypeId } from '../data/schema';

/**
 * The complete serialisable state of a build. Everything the 3D scene renders is
 * derived from this object — it is the single source of truth shared by the UI,
 * the URL, the spec sheet and the renderer.
 */
export interface CarConfig {
  /* Model & trim */
  generation: GenerationId;
  roofType: RoofTypeId;
  roofState: RoofState;
  roofFabric: string;

  /* Paint & exterior finishes */
  paint: string;
  /** Overrides the catalogue hex when the chosen paint is a user colour. */
  paintCustomHex: string;
  /** Overrides the catalogue finish; `''` means "use the colour's own finish". */
  paintFinishOverride: '' | string;
  flakeIntensity: number;
  clearcoat: number;
  caliperColor: string;

  /* Wheels & stance */
  wheelStyle: string;
  wheelFinish: string;
  wheelDiameter: number;
  /** Ride-height delta in millimetres (0 = stock, negative = lowered). */
  rideHeight: number;
  /** Static negative camber in degrees. */
  camber: number;
  /** Per-corner spacer / track width offset in millimetres. */
  trackOffset: number;
  /** Every wheel mod ships a disc and caliper; off by default because they
   *  currently sit proud of the wheel face rather than tucked behind it. */
  wheelBrakes: boolean;

  /**
   * Additive mods with no catalogue slot of their own — bonnet pins, a tow
   * hook, canards. Held as a list of mod ids rather than a field each, so a new
   * one is a catalogue entry and needs no schema change. See `data/mods.ts`.
   */
  extraMods: string[];

  /* Aero & bodykit */
  frontLip: string;
  sideSkirts: string;
  rearDiffuser: string;
  rearWing: string;
  hood: string;
  exhaust: string;
  rollBar: string;
  smokedIndicators: boolean;
  tintedHeadlights: boolean;

  /* Interior & glass */
  interiorTrim: string;
  windowTint: number;

  /* Lighting & atmosphere */
  environment: string;
  headlights: boolean;
  taillights: boolean;
  drl: boolean;
  exposure: number;
  bloom: boolean;
  ssao: boolean;
  contactShadow: boolean;
  groundReflection: number;

  /* Viewport-only state (still serialised so a shared link looks identical) */
  wheelSpin: boolean;
  turntable: boolean;
  cameraPreset: string;
}

export interface PresetBuild {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  description: string;
  config: Partial<CarConfig>;
}

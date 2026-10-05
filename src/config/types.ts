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
  /** materialsData.wheelSheens id layered over wheelFinish; '' keeps the colour's own finish. */
  wheelSheen: string;
  /** materialsData.accentColors id for accent parts (stripes, roundels...); 'body' follows the paint. */
  accentColor: string;
  /** Light rim-only colour cast for the 30-wheel pack, '' = none. A
   *  materialsData.wheelFinishes id, same catalogue as wheelFinish — those
   *  wheels' baked texture can't take the real wheel-finish tint (see
   *  CarModel.setWheelPackTint), so this is a separate, gentler control. */
  wheelPackTint: string;
  wheelDiameter: number;
  /** Ride-height delta in millimetres (0 = stock, negative = lowered). */
  rideHeight: number;
  /** Static negative camber in degrees. */
  camber: number;
  /** Per-corner spacer / track width offset in millimetres. */
  trackOffset: number;
  /** Show the brake hardware supplied with a fitted wheel mod. */
  wheelBrakes: boolean;
  /** Tyre thickness multiplier, 1 = as modelled. A visual approximation —
   *  scales the tyre mesh along its own axial direction, not a real tyre
   *  size code. */
  tyreWidth: number;
  /** Tyre sidewall-height multiplier, 1 = as modelled. Another
   *  approximation: reshapes the tyre radially outward from its bead (the
   *  rim-mounting radius, held fixed) rather than computing a real aspect
   *  ratio from width and rim diameter. */
  tyreSidewall: number;
  /** Debug aid: hide the tyre mesh to inspect the rim underneath. */
  tyreVisible: boolean;

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
  /* Per-part cabin finishes from materialsData.cabinFinishes; '' = match the
   * cabin theme. Which parts a car offers: surfaceClasses cabinParts. */
  seatTrim: string;
  wheelTrim: string;
  trimAccent: string;
  doorInsert: string;
  windowTint: number;

  /* Lighting & atmosphere */
  environment: string;
  headlights: boolean;
  taillights: boolean;
  /** Not rendered and not offered: the ND's DRLs share the headlight lens.
   *  Kept so older share links still decode. */
  drl: boolean;
  exposure: number;
  bloom: boolean;
  ssao: boolean;
  contactShadow: boolean;
  groundReflection: number;

  /* Viewport-only state (still serialised so a shared link looks identical) */
  /** Not rendered and not offered yet — the wheel pivots sit at the contact
   *  patch, not the hub. Kept so older share links still decode. */
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

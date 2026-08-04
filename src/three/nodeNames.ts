/**
 * Scene-graph naming convention.
 *
 * Both the procedural fallback model and any authored GLTF/GLB must expose
 * these node names. `CarModel` only ever addresses the scene through these
 * constants, so swapping a placeholder mesh for a real scan is a matter of
 * matching names in the DCC tool — no code changes.
 */
export const NODE = {
  ROOT: 'MX5_Root',
  SUSPENSION: 'Suspension_Node',

  BODY_MAIN: 'Body_Main',
  BODY_TRIM: 'Body_Trim',

  ROOF_ST_UP: 'Roof_ST_Up',
  ROOF_ST_DOWN: 'Roof_ST_Down',
  ROOF_RF_UP: 'Roof_RF_Up',
  ROOF_RF_DOWN: 'Roof_RF_Down',

  GLASS_WINDSHIELD: 'Glass_Windshield',
  GLASS_WINDOWS: 'Glass_Windows',

  WHEEL_FL: 'Wheel_FL',
  WHEEL_FR: 'Wheel_FR',
  WHEEL_RL: 'Wheel_RL',
  WHEEL_RR: 'Wheel_RR',

  /** Children of each `Wheel_*` node. */
  RIM: 'Rim',
  TIRE: 'Tire',
  BRAKE_CALIPER: 'Brake_Caliper',
  BRAKE_DISC: 'Brake_Disc',

  INTERIOR_MAIN: 'Interior_Main',
  INTERIOR_SEATS: 'Interior_Seats',
  INTERIOR_STEERING: 'Interior_SteeringWheel',

  AERO_FRONT_LIP: 'Aerodynamics_FrontLip',
  AERO_SIDE_SKIRTS: 'Aerodynamics_SideSkirts',
  AERO_REAR_DIFFUSER: 'Aerodynamics_RearDiffuser',
  AERO_REAR_WING: 'Aerodynamics_RearWing',
  AERO_HOOD: 'Aerodynamics_Hood',
  AERO_EXHAUST: 'Aerodynamics_Exhaust',
  AERO_ROLL_BAR: 'Aerodynamics_RollBar',

  LIGHTS_HEAD: 'Lights_Head',
  LIGHTS_DRL: 'Lights_DRL',
  LIGHTS_TAIL: 'Lights_Tail',
  LIGHTS_INDICATOR: 'Lights_Indicator',
  LIGHTS_HEAD_HOUSING: 'Lights_HeadHousing',
} as const;

/** Wheel corners in a stable order: FL, FR, RL, RR. */
export const WHEEL_NODES = [NODE.WHEEL_FL, NODE.WHEEL_FR, NODE.WHEEL_RL, NODE.WHEEL_RR] as const;

/** Aero slot id -> the container node that holds its variant children. */
export const AERO_SLOT_NODE = {
  frontLip: NODE.AERO_FRONT_LIP,
  sideSkirts: NODE.AERO_SIDE_SKIRTS,
  rearDiffuser: NODE.AERO_REAR_DIFFUSER,
  rearWing: NODE.AERO_REAR_WING,
  hood: NODE.AERO_HOOD,
  exhaust: NODE.AERO_EXHAUST,
  rollBar: NODE.AERO_ROLL_BAR,
} as const;

/** Roof type + state -> node name, matching `carData.json`'s `roofTypes[].nodes`. */
export function roofNodeName(roofType: 'st' | 'rf', state: 'up' | 'down'): string {
  if (roofType === 'rf') return state === 'up' ? NODE.ROOF_RF_UP : NODE.ROOF_RF_DOWN;
  return state === 'up' ? NODE.ROOF_ST_UP : NODE.ROOF_ST_DOWN;
}

export const ALL_ROOF_NODES = [
  NODE.ROOF_ST_UP,
  NODE.ROOF_ST_DOWN,
  NODE.ROOF_RF_UP,
  NODE.ROOF_RF_DOWN,
] as const;

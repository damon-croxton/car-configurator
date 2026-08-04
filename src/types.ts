export type PaintFinish = 'gloss' | 'metallic' | 'pearl' | 'matte' | 'chrome';

export interface PaintColor {
  id: string;
  name: string;
  hex: string;
  type: PaintFinish;
  flakeColor?: string;
  isOem?: boolean;
}

export type RoofType = 'softtop_closed' | 'softtop_open' | 'rf_hardtop';

export type RoofColor = 'black' | 'tan' | 'cherry' | 'body_color';

export type WheelStyle = 'oem_17' | 'volk_te37' | 'enkei_rpf1' | 'bbs_rs' | 'work_s1' | 'rotiform_lasr';

export type WheelFinish = 'satin_black' | 'bronze' | 'hyper_silver' | 'gunmetal' | 'chrome' | 'custom';

export type FrontLipStyle = 'stock' | 'mazdaspeed' | 'apr_carbon' | 'leg_motorsport';

export type SideSkirtStyle = 'stock' | 'oem_extensions' | 'carbon_extenders';

export type RearDiffuserStyle = 'stock' | 'oem_diffuser' | 'track_diffuser';

export type ExhaustStyle = 'stock_single' | 'oem_dual' | 'titanium_quad' | 'tomei_single_big';

export type SpoilerStyle = 'none' | 'oem_ducktail' | 'carbon_lip' | 'voltex_gt_wing';

export type HoodStyle = 'stock' | 'carbon_vented' | 'painted_carbon';

export type InteriorColor = 'black_leather' | 'tan_nappa' | 'red_alcantara' | 'recaro_bucket';

export type StudioEnvironment = 
  | 'dark_studio' 
  | 'golden_hour' 
  | 'clean_white' 
  | 'cyber_neon' 
  | 'tokyo_night' 
  | 'sunset_coast' 
  | 'industrial_warehouse' 
  | 'desert_salt_flats' 
  | 'alpine_pass';

export type CameraPreset = 'hero_34' | 'side' | 'rear_34' | 'front' | 'top' | 'low_stance' | 'cockpit';

export interface CarConfig {
  // Paint
  paintColor: string;
  paintName: string;
  paintFinish: PaintFinish;
  clearcoatGloss: number; // 0 to 1
  flakeIntensity: number; // 0 to 1
  
  // Roof
  roofType: RoofType;
  roofColor: RoofColor;
  
  // Wheels & Stance
  wheelStyle: WheelStyle;
  wheelFinish: WheelFinish;
  customWheelColor: string;
  wheelSizeRatio: number; // 0.95 to 1.1 (16" to 18")
  suspensionDrop: number; // 0 to 1 (0 = Stock, 1 = Slammed Air)
  camberAngle: number; // 0 to -5 degrees
  wheelSpacerOffset: number; // 0 to 1 (tuck to flush/poke)
  caliperColor: string;
  
  // Bodykits & Aero
  frontLip: FrontLipStyle;
  sideSkirts: SideSkirtStyle;
  rearDiffuser: RearDiffuserStyle;
  exhaustStyle: ExhaustStyle;
  spoilerStyle: SpoilerStyle;
  hoodStyle: HoodStyle;
  
  // Interior & Glass
  interiorColor: InteriorColor;
  windowTint: number; // 0 (clear) to 0.85 (dark tint)
  licensePlateText: string;
  licensePlateStyle: 'jdm' | 'california' | 'euro' | 'black_gold';
  
  // Lighting & Effects
  headlightsOn: boolean;
  taillightsOn: boolean;
  drlGlow: boolean;
  wheelsRotating: boolean;
  
  // Studio Setup
  environment: StudioEnvironment;
  groundShadow: boolean;
  floorReflection: number; // 0 to 1
  studioExposure: number; // 0.5 to 1.5
}

export interface PresetBuild {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  config: Partial<CarConfig>;
}

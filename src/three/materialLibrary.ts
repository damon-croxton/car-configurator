import * as THREE from 'three';
import type { CarConfig } from '../config/types';
import {
  getCaliperColor,
  getInteriorTrim,
  getPaintColor,
  getPaintFinish,
  getRoofFabric,
  getWheelFinish,
  materialsData,
  type PaintColorDef,
  type PaintFinishDef,
} from '../data/schema';
import { TextureFactory } from './textures';

/**
 * The single owner of every material in the scene.
 *
 * Materials are created once and mutated in place when the configuration
 * changes. That keeps draw calls and shader recompiles low (all body panels
 * share one paint material) and means swapping colours never allocates.
 */
export class MaterialLibrary {
  readonly textures = new TextureFactory();

  /** Body paint, shared by every painted panel. */
  readonly paint: THREE.MeshPhysicalMaterial;
  /** Painted roof / hardtop panel — tracks paint but can be forced to black. */
  readonly paintRoof: THREE.MeshPhysicalMaterial;
  readonly carbon: THREE.MeshPhysicalMaterial;
  readonly trim: THREE.MeshStandardMaterial;
  readonly rubber: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshPhysicalMaterial;
  readonly mirrorGlass: THREE.MeshStandardMaterial;
  readonly rim: THREE.MeshPhysicalMaterial;
  readonly rimAccent: THREE.MeshPhysicalMaterial;
  readonly caliper: THREE.MeshStandardMaterial;
  readonly brakeDisc: THREE.MeshStandardMaterial;
  readonly fabric: THREE.MeshStandardMaterial;
  readonly chrome: THREE.MeshStandardMaterial;
  readonly titanium: THREE.MeshStandardMaterial;
  readonly metal: THREE.MeshStandardMaterial;
  readonly seat: THREE.MeshStandardMaterial;
  readonly interiorTrim: THREE.MeshStandardMaterial;
  readonly stitching: THREE.MeshStandardMaterial;
  readonly headlightHousing: THREE.MeshPhysicalMaterial;
  readonly headlightLens: THREE.MeshStandardMaterial;
  readonly drl: THREE.MeshStandardMaterial;
  readonly taillight: THREE.MeshStandardMaterial;
  readonly indicator: THREE.MeshStandardMaterial;
  readonly plate: THREE.MeshStandardMaterial;

  private readonly all: THREE.Material[] = [];
  private paintFeatureSignature = '';
  private glassFeatureSignature = '';
  private envIntensity = 1;

  constructor() {
    const flakeNormal = this.textures.flakeNormal();
    const orangePeel = this.textures.orangePeelNormal();
    const carbonWeave = this.textures.carbonWeave();
    const fabricBump = this.textures.fabricBump();
    const brushed = this.textures.brushedMetal();

    this.paint = this.track(
      new THREE.MeshPhysicalMaterial({
        name: 'CarPaint',
        color: '#a1000c',
        metalness: 0.7,
        roughness: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        clearcoatNormalMap: orangePeel,
        clearcoatNormalScale: new THREE.Vector2(0.14, 0.14),
        normalMap: flakeNormal,
        normalScale: new THREE.Vector2(0.09, 0.09),
        envMapIntensity: 1.15,
      }),
    );

    this.paintRoof = this.track(this.paint.clone());
    this.paintRoof.name = 'CarPaintRoof';

    this.carbon = this.track(
      new THREE.MeshPhysicalMaterial({
        name: 'CarbonFibre',
        map: carbonWeave,
        color: '#ffffff',
        metalness: 0.35,
        roughness: 0.24,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.1,
      }),
    );

    this.trim = this.track(
      new THREE.MeshStandardMaterial({ name: 'Trim', color: '#101115', roughness: 0.62, metalness: 0.15 }),
    );

    this.rubber = this.track(
      new THREE.MeshStandardMaterial({ name: 'Tire', color: '#0d0d0f', roughness: 0.92, metalness: 0.0 }),
    );

    this.glass = this.track(
      new THREE.MeshPhysicalMaterial({
        name: 'Glass',
        color: materialsData.glass.baseTintHex,
        metalness: 0,
        roughness: materialsData.glass.roughness,
        transmission: materialsData.glass.transmission,
        thickness: materialsData.glass.thickness,
        ior: materialsData.glass.ior,
        transparent: true,
        side: THREE.DoubleSide,
        envMapIntensity: 1.4,
      }),
    );

    this.mirrorGlass = this.track(
      new THREE.MeshStandardMaterial({ name: 'MirrorGlass', color: '#dfe6ea', metalness: 1, roughness: 0.04 }),
    );

    this.rim = this.track(
      new THREE.MeshPhysicalMaterial({
        name: 'Rim',
        color: '#4a5058',
        metalness: 0.9,
        roughness: 0.26,
        roughnessMap: brushed,
        clearcoat: 0.3,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.25,
      }),
    );

    this.rimAccent = this.track(this.rim.clone());
    this.rimAccent.name = 'RimAccent';

    this.caliper = this.track(
      new THREE.MeshStandardMaterial({ name: 'Caliper', color: '#b21215', metalness: 0.25, roughness: 0.34 }),
    );

    this.brakeDisc = this.track(
      new THREE.MeshStandardMaterial({ name: 'BrakeDisc', color: '#6f767d', metalness: 0.92, roughness: 0.42 }),
    );

    this.fabric = this.track(
      new THREE.MeshStandardMaterial({
        name: 'RoofFabric',
        color: '#141416',
        roughness: 0.85,
        metalness: 0.02,
        bumpMap: fabricBump,
        bumpScale: 0.9,
      }),
    );

    this.chrome = this.track(
      new THREE.MeshStandardMaterial({ name: 'Chrome', color: '#e8ecef', metalness: 1, roughness: 0.06, envMapIntensity: 1.4 }),
    );

    this.titanium = this.track(
      new THREE.MeshStandardMaterial({ name: 'Titanium', color: '#8fa3b5', metalness: 0.95, roughness: 0.22, envMapIntensity: 1.3 }),
    );

    this.metal = this.track(
      new THREE.MeshStandardMaterial({ name: 'Metal', color: '#8d959d', metalness: 0.88, roughness: 0.28 }),
    );

    this.seat = this.track(
      new THREE.MeshStandardMaterial({ name: 'Seat', color: '#17171a', roughness: 0.62, metalness: 0.04 }),
    );

    this.interiorTrim = this.track(
      new THREE.MeshStandardMaterial({ name: 'InteriorTrim', color: '#0e0e11', roughness: 0.7, metalness: 0.06 }),
    );

    this.stitching = this.track(
      new THREE.MeshStandardMaterial({ name: 'Stitching', color: '#3a3a40', roughness: 0.8, metalness: 0 }),
    );

    this.headlightHousing = this.track(
      new THREE.MeshPhysicalMaterial({
        name: 'HeadlightHousing',
        color: materialsData.lightMods.headlightHousingClear,
        metalness: 0,
        roughness: 0.06,
        transmission: 0.75,
        thickness: 0.02,
        ior: 1.45,
        transparent: true,
        envMapIntensity: 1.3,
      }),
    );

    this.headlightLens = this.track(
      new THREE.MeshStandardMaterial({
        name: 'HeadlightLens',
        color: '#20242b',
        emissive: materialsData.lightMods.headlightEmissive,
        emissiveIntensity: 0,
        roughness: 0.12,
        metalness: 0.1,
      }),
    );

    this.drl = this.track(
      new THREE.MeshStandardMaterial({
        name: 'DRL',
        color: '#1a1f26',
        emissive: materialsData.lightMods.drlEmissive,
        emissiveIntensity: 0,
        roughness: 0.2,
      }),
    );

    this.taillight = this.track(
      new THREE.MeshStandardMaterial({
        name: 'Taillight',
        color: materialsData.lightMods.taillightOff,
        emissive: materialsData.lightMods.taillightEmissive,
        emissiveIntensity: 0,
        roughness: 0.16,
        metalness: 0.1,
      }),
    );

    this.indicator = this.track(
      new THREE.MeshStandardMaterial({
        name: 'Indicator',
        color: materialsData.lightMods.indicatorClear,
        roughness: 0.18,
        metalness: 0.1,
      }),
    );

    this.plate = this.track(
      new THREE.MeshStandardMaterial({ name: 'Plate', color: '#e9ecee', roughness: 0.5, metalness: 0.05 }),
    );
  }

  private track<T extends THREE.Material>(material: T): T {
    this.all.push(material);
    return material;
  }

  /** Every material this library owns — anything else in the graph is the
   *  asset's own and must be disposed when that asset is swapped out. */
  get owned(): ReadonlySet<THREE.Material> {
    return new Set(this.all);
  }

  /** Resolve the effective paint colour/finish, honouring custom-colour overrides. */
  resolvePaint(config: CarConfig): { color: PaintColorDef; finish: PaintFinishDef; hex: string } {
    const color = getPaintColor(config.paint);
    const finish = getPaintFinish(config.paintFinishOverride || color.finish);
    const hex = color.userColor ? config.paintCustomHex : color.hex;
    return { color, finish, hex };
  }

  /** Push every configuration-driven property onto the shared materials. */
  applyConfig(config: CarConfig): void {
    this.applyPaint(config);
    this.applyGlass(config);
    this.applyWheels(config);
    this.applyInterior(config);
    this.applyLights(config);
    this.applyRoofFabric(config);
  }

  private applyPaint(config: CarConfig): void {
    const { color, finish, hex } = this.resolvePaint(config);

    this.paint.color.set(hex).convertSRGBToLinear();
    this.paint.metalness = finish.metalness;
    this.paint.roughness = finish.roughness;
    this.paint.clearcoat = finish.clearcoat * config.clearcoat;
    this.paint.clearcoatRoughness = finish.clearcoatRoughness;
    this.paint.envMapIntensity = finish.envIntensity * this.envIntensity;

    // Flake sparkle: finish defines the ceiling, the slider scales within it.
    const flake = finish.flake * config.flakeIntensity;
    this.paint.normalScale.set(flake * 0.05, flake * 0.05);
    this.paint.clearcoatNormalScale.set(0.06 + config.clearcoat * 0.12, 0.06 + config.clearcoat * 0.12);

    this.paint.sheen = finish.sheen;
    if (finish.sheen > 0) {
      this.paint.sheenColor.set(color.flakeHex ?? '#ffffff').convertSRGBToLinear();
      this.paint.sheenRoughness = 0.4;
    }
    this.paint.iridescence = finish.iridescence;
    this.paint.iridescenceIOR = 1.6;
    this.paint.iridescenceThicknessRange = [120, 420];

    // Enabling/disabling a physical feature flips a shader define, so the
    // program must be rebuilt — but only when the feature actually crosses.
    const signature = [
      this.paint.clearcoat > 0,
      this.paint.sheen > 0,
      this.paint.iridescence > 0,
      flake > 0,
    ].join('|');
    if (signature !== this.paintFeatureSignature) {
      this.paintFeatureSignature = signature;
      this.paint.needsUpdate = true;
      this.paintRoof.needsUpdate = true;
    }

    this.paintRoof.copy(this.paint);
    this.paintRoof.name = 'CarPaintRoof';
  }

  private applyGlass(config: CarConfig): void {
    const glass = materialsData.glass;
    const tint = config.windowTint;

    this.glass.color
      .set(glass.baseTintHex)
      .convertSRGBToLinear()
      .lerp(new THREE.Color(glass.darkTintHex).convertSRGBToLinear(), tint);
    this.glass.transmission = glass.transmission * (1 - tint * 0.72);
    this.glass.opacity = 1;
    this.glass.roughness = glass.roughness + tint * 0.03;
    this.glass.envMapIntensity = (1.4 - tint * 0.5) * this.envIntensity;

    const signature = String(this.glass.transmission > 0);
    if (signature !== this.glassFeatureSignature) {
      this.glassFeatureSignature = signature;
      this.glass.needsUpdate = true;
    }
  }

  private applyWheels(config: CarConfig): void {
    const finish = getWheelFinish(config.wheelFinish);
    this.rim.color.set(finish.hex).convertSRGBToLinear();
    this.rim.metalness = finish.metalness;
    this.rim.roughness = finish.roughness;
    this.rim.clearcoat = finish.clearcoat;
    this.rim.envMapIntensity = 1.25 * this.envIntensity;

    // Polished lip / centre cap: same hue, mirror-polished.
    this.rimAccent.color.copy(this.rim.color);
    this.rimAccent.metalness = Math.min(1, finish.metalness + 0.08);
    this.rimAccent.roughness = Math.max(0.02, finish.roughness * 0.35);
    this.rimAccent.clearcoat = 1;
    this.rimAccent.envMapIntensity = 1.5 * this.envIntensity;

    const caliper = getCaliperColor(config.caliperColor);
    this.caliper.color.set(caliper.hex).convertSRGBToLinear();
    this.caliper.metalness = caliper.metalness ?? 0.25;
    this.caliper.roughness = caliper.roughness ?? 0.34;
  }

  private applyInterior(config: CarConfig): void {
    const trim = getInteriorTrim(config.interiorTrim);
    this.seat.color.set(trim.seatHex).convertSRGBToLinear();
    this.seat.roughness = trim.roughness;
    this.interiorTrim.color.set(trim.trimHex).convertSRGBToLinear();
    this.stitching.color.set(trim.stitchHex).convertSRGBToLinear();
  }

  private applyLights(config: CarConfig): void {
    const mods = materialsData.lightMods;

    this.headlightHousing.color
      .set(config.tintedHeadlights ? mods.headlightHousingTinted : mods.headlightHousingClear)
      .convertSRGBToLinear();
    this.headlightHousing.transmission = config.tintedHeadlights ? 0.25 : 0.75;
    this.headlightHousing.roughness = config.tintedHeadlights ? 0.22 : 0.06;

    this.headlightLens.emissiveIntensity = config.headlights ? 9 : 0;
    this.headlightLens.color.set(config.headlights ? '#f2f8ff' : '#20242b').convertSRGBToLinear();

    this.drl.emissiveIntensity = config.drl ? 6 : 0;
    this.drl.color.set(config.drl ? '#dcefff' : '#1a1f26').convertSRGBToLinear();

    this.taillight.emissiveIntensity = config.taillights ? 5.5 : 0;
    this.taillight.color
      .set(config.taillights ? '#8c0f0f' : mods.taillightOff)
      .convertSRGBToLinear();

    this.indicator.color
      .set(config.smokedIndicators ? mods.indicatorSmoked : mods.indicatorClear)
      .convertSRGBToLinear();
    this.indicator.roughness = config.smokedIndicators ? 0.42 : 0.18;
  }

  private applyRoofFabric(config: CarConfig): void {
    const fabric = getRoofFabric(config.roofFabric);
    this.fabric.color.set(fabric.hex).convertSRGBToLinear();
  }

  /**
   * Per-material reflectivity multipliers, relative to the environment's own
   * intensity. Chrome and glass want more punch than matte trim.
   */
  private envMultiplier(material: THREE.Material): number {
    switch (material) {
      case this.chrome:
      case this.glass:
        return 1.4;
      case this.rimAccent:
        return 1.5;
      case this.titanium:
        return 1.3;
      case this.rim:
        return 1.25;
      case this.paint:
      case this.paintRoof:
      case this.carbon:
        return 1.15;
      case this.rubber:
      case this.fabric:
      case this.seat:
        return 0.6;
      default:
        return 1;
    }
  }

  /** Scale every env-map-driven material when the environment changes. */
  setEnvironmentIntensity(intensity: number): void {
    this.envIntensity = intensity;
    for (const material of this.all) {
      const standard = material as THREE.MeshStandardMaterial;
      if ('envMapIntensity' in standard) {
        standard.envMapIntensity = intensity * this.envMultiplier(material);
      }
    }
  }

  dispose(): void {
    for (const material of this.all) material.dispose();
    this.all.length = 0;
    this.textures.dispose();
  }
}

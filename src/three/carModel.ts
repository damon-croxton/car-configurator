import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { CarConfig } from '../config/types';
import { AERO_SLOTS } from '../config/defaults';
import {
  getAeroPart,
  getGeneration,
  getWheelStyle,
  type AeroSlotId,
  type Generation,
} from '../data/schema';
import { disposeObject3D } from './disposal';
import type { MaterialLibrary } from './materialLibrary';
import { ALL_ROOF_NODES, AERO_SLOT_NODE, NODE, WHEEL_NODES, roofNodeName } from './nodeNames';
import { buildProceduralMx5 } from './proceduralMx5';
import { WHEEL_REF_RADIUS, WHEEL_REF_RIM_FRACTION, fitmentFor } from './proceduralWheel';

const DEG2RAD = Math.PI / 180;

/**
 * Contract nodes an authored asset is allowed to take over, each swapped as a
 * unit. Anything absent from the GLB keeps its procedural counterpart — which
 * is how a scanned body can coexist with parametric aero and roof variants.
 *
 * Deliberately excludes the `Aerodynamics_*` containers: those hold one child
 * per catalogue variant and are far more valuable generated than authored.
 */
const ADOPTABLE_NODES: readonly string[] = [
  NODE.BODY_MAIN,
  NODE.BODY_TRIM,
  NODE.GLASS_WINDSHIELD,
  NODE.GLASS_WINDOWS,
  NODE.INTERIOR_MAIN,
  NODE.INTERIOR_SEATS,
  NODE.INTERIOR_STEERING,
  NODE.LIGHTS_HEAD,
  NODE.LIGHTS_HEAD_HOUSING,
  NODE.LIGHTS_DRL,
  NODE.LIGHTS_TAIL,
  NODE.LIGHTS_INDICATOR,
  ...ALL_ROOF_NODES,
  ...WHEEL_NODES,
];

/**
 * Owns the car in the scene: loading it, applying configuration to it, and
 * disposing it.
 *
 * Loading strategy — the procedural car is *always* built, because it is the
 * only thing that guarantees the full node contract every configurator toggle
 * drives. An authored GLB is then composed on top, replacing whichever contract
 * nodes it actually supplies. A first-pass third-party asset realistically
 * covers the body, glass and wheels and nothing else; composing rather than
 * choosing means adopting it costs no functionality.
 */
export class CarModel {
  readonly group = new THREE.Group();

  private generation: Generation;
  private suspension: THREE.Group | null = null;
  private wheels: THREE.Group[] = [];
  private headlightSpots: THREE.SpotLight[] = [];
  private nodes = new Map<string, THREE.Object3D>();
  private adopted: string[] = [];
  private lastConfig: CarConfig | null = null;

  constructor(
    private readonly materials: MaterialLibrary,
    private readonly loadingManager: THREE.LoadingManager,
  ) {
    this.group.name = 'Car';
    this.generation = getGeneration(undefined);
  }

  /** True when nothing authored was adopted — the car is entirely generated. */
  get usingFallback(): boolean {
    return this.adopted.length === 0;
  }

  /** Contract node names currently supplied by an authored asset. */
  get adoptedNodes(): readonly string[] {
    return this.adopted;
  }

  get generationId(): string {
    return this.generation.id;
  }

  /** Load (or rebuild) the car for a generation. Safe to call repeatedly. */
  async load(generationId: string): Promise<void> {
    const generation = getGeneration(generationId);
    this.generation = generation;
    this.clear();

    // Always build procedurally first — it is the only source that guarantees
    // every node the configurator drives.
    const built = buildProceduralMx5(generation, this.materials);
    this.group.add(built.root);
    this.suspension = built.suspension;
    this.headlightSpots = built.headlightSpots;

    const gltfScene = await this.tryLoadGltf(generation);
    if (gltfScene) this.adopted = this.composeAuthored(gltfScene);

    this.indexNodes();
    if (this.lastConfig) this.applyConfig(this.lastConfig);
  }

  private async tryLoadGltf(generation: Generation): Promise<THREE.Group | null> {
    if (!generation.assetUrl) return null;
    try {
      // A HEAD probe keeps the LoadingManager's progress bar honest: a dev
      // server that answers 404 with an HTML page would otherwise register as
      // a "successful" asset and then blow up in the parser.
      const probe = await fetch(generation.assetUrl, { method: 'HEAD' });
      if (!probe.ok) return null;

      const loader = new GLTFLoader(this.loadingManager);
      // Meshopt is the compression the asset build script targets. Its decoder
      // is a plain JS module, so unlike Draco/KTX2 it needs no wasm copied into
      // `public/` — which matters on a static `base: './'` deploy.
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(generation.assetUrl);
      return gltf.scene;
    } catch (error) {
      // A missing asset is the normal case and stays quiet (the HEAD probe
      // above returns early). Reaching here means the file exists but could not
      // be parsed, which is worth surfacing — silently falling back makes a
      // broken asset look like an absent one.
      console.warn(`[CarModel] ${generation.assetUrl} failed to parse, using procedural mesh:`, error);
      return null;
    }
  }

  /**
   * Splice authored nodes into the procedural graph, one contract name at a
   * time. Each authored node takes the exact parent and sibling slot of the
   * procedural node it replaces, so it inherits the same transform chain — the
   * reason the Blender conform step must produce assets at our real-world
   * dimensions rather than arbitrary ones.
   */
  private composeAuthored(scene: THREE.Group): string[] {
    const adopted: string[] = [];

    for (const name of ADOPTABLE_NODES) {
      const authored = scene.getObjectByName(name);
      if (!authored) continue;

      const existing = this.findInProcedural(name);
      if (!existing?.parent) continue;

      const parent = existing.parent;
      const index = parent.children.indexOf(existing);

      existing.removeFromParent();
      disposeObject3D(existing, { shared: this.materials.owned });

      authored.removeFromParent();
      parent.add(authored);
      // Preserve draw order / sibling position rather than always appending.
      if (index >= 0 && index < parent.children.length - 1) {
        parent.children.splice(parent.children.indexOf(authored), 1);
        parent.children.splice(index, 0, authored);
      }

      adopted.push(name);
    }

    this.applyAuthoredMaterials(adopted);
    return adopted;
  }

  /** Locate a contract node inside the procedural graph currently in `group`. */
  private findInProcedural(name: string): THREE.Object3D | undefined {
    return this.group.getObjectByName(name);
  }

  /**
   * Authored assets ship their own materials. Re-point the ones the
   * configurator drives at the shared library so paint, glass and finish
   * changes keep working; leave anything else the asset provides alone.
   */
  private applyAuthoredMaterials(adopted: string[]): void {
    const overrides: Record<string, THREE.Material> = {
      [NODE.BODY_MAIN]: this.materials.paint,
      [NODE.GLASS_WINDSHIELD]: this.materials.glass,
      [NODE.GLASS_WINDOWS]: this.materials.glass,
      [NODE.INTERIOR_SEATS]: this.materials.seat,
      [NODE.INTERIOR_MAIN]: this.materials.interiorTrim,
      [NODE.INTERIOR_STEERING]: this.materials.interiorTrim,
      [NODE.BODY_TRIM]: this.materials.trim,
      [NODE.LIGHTS_TAIL]: this.materials.taillight,
      [NODE.LIGHTS_HEAD]: this.materials.headlightLens,
      [NODE.LIGHTS_DRL]: this.materials.drl,
      [NODE.LIGHTS_INDICATOR]: this.materials.indicator,
    };

    const assign = (root: THREE.Object3D, material: THREE.Material) =>
      root.traverse((child) => {
        const asMesh = child as THREE.Mesh;
        if (asMesh.isMesh) asMesh.material = material;
      });

    for (const name of adopted) {
      const node = this.group.getObjectByName(name);
      if (!node) continue;

      const override = overrides[name];
      if (override) assign(node, override);

      if ((WHEEL_NODES as readonly string[]).includes(name)) {
        const rim = node.getObjectByName(NODE.RIM);
        if (rim) assign(rim, this.materials.rim);
        const tire = node.getObjectByName(NODE.TIRE);
        if (tire) assign(tire, this.materials.rubber);
        const caliper = node.getObjectByName(NODE.BRAKE_CALIPER);
        if (caliper) assign(caliper, this.materials.caliper);
        const disc = node.getObjectByName(NODE.BRAKE_DISC);
        if (disc) assign(disc, this.materials.brakeDisc);
      }

      node.traverse((child) => {
        const asMesh = child as THREE.Mesh;
        if (asMesh.isMesh) {
          asMesh.castShadow = true;
          asMesh.receiveShadow = true;
        }
      });
    }
  }

  private indexNodes(): void {
    this.nodes.clear();
    this.group.traverse((child) => {
      if (child.name && !this.nodes.has(child.name)) this.nodes.set(child.name, child);
    });
    this.wheels = WHEEL_NODES.map((name) => this.nodes.get(name)).filter(
      (node): node is THREE.Group => Boolean(node),
    );
  }

  private node(name: string): THREE.Object3D | undefined {
    return this.nodes.get(name);
  }

  private setVisible(name: string, visible: boolean): void {
    const node = this.node(name);
    if (node) node.visible = visible;
  }

  /** Show exactly one named child of a container, hide its siblings. */
  private selectVariant(containerName: string, activeChildName: string): void {
    const container = this.node(containerName);
    if (!container) return;
    // If the asset does not ship this variant, leave the container untouched
    // rather than hiding everything in it.
    if (!container.children.some((child) => child.name === activeChildName)) return;
    for (const child of container.children) {
      child.visible = child.name === activeChildName;
    }
  }

  applyConfig(config: CarConfig): void {
    this.lastConfig = config;
    if (!this.suspension) return;

    this.applyRoof(config);
    this.applyAero(config);
    this.applyStance(config);
    this.applyWheels(config);
    this.applyLights(config);
  }

  private applyRoof(config: CarConfig): void {
    const active = roofNodeName(config.roofType, config.roofState);
    for (const name of ALL_ROOF_NODES) this.setVisible(name, name === active);
    // Side glass only makes sense with the roof up.
    this.setVisible(NODE.GLASS_WINDOWS, config.roofState === 'up');
  }

  private applyAero(config: CarConfig): void {
    for (const slot of AERO_SLOTS as AeroSlotId[]) {
      const part = getAeroPart(slot, config[slot] as string);
      this.selectVariant(AERO_SLOT_NODE[slot], part.node);
    }
  }

  private applyStance(config: CarConfig): void {
    if (!this.suspension) return;
    // rideHeight is millimetres of drop relative to stock.
    this.suspension.position.y = config.rideHeight / 1000;
  }

  private applyWheels(config: CarConfig): void {
    const style = getWheelStyle(config.wheelStyle);
    const fitment = fitmentFor(config.wheelDiameter);
    const scale = fitment.radius / WHEEL_REF_RADIUS;
    const rimScale = fitment.rimFraction / WHEEL_REF_RIM_FRACTION;

    const halfTrackFront = this.generation.dimensions.trackFront / 2;
    const halfTrackRear = this.generation.dimensions.trackRear / 2;
    const halfBase = this.generation.dimensions.wheelbase / 2;
    const spacer = config.trackOffset / 1000;
    const camber = config.camber * DEG2RAD;

    this.wheels.forEach((wheel, index) => {
      const isLeft = index % 2 === 0;
      const isFront = index < 2;
      const halfTrack = isFront ? halfTrackFront : halfTrackRear;
      const side = isLeft ? -1 : 1;

      wheel.position.set(side * (halfTrack + spacer), fitment.radius, isFront ? halfBase : -halfBase);
      wheel.scale.setScalar(scale);
      // Negative camber tilts the top of the wheel inboard on both sides.
      wheel.rotation.z = side * -camber;

      const rim = wheel.getObjectByName(NODE.RIM);
      if (rim) {
        rim.scale.set(rim.scale.x < 0 ? -rimScale : rimScale, rimScale, rimScale);
        // Only drive variant visibility when the asset actually ships variants —
        // an authored GLB with a single rim keeps its one child visible.
        if (rim.children.some((child) => child.name === style.id)) {
          for (const child of rim.children) child.visible = child.name === style.id;
        }
      }
    });
  }

  private applyLights(config: CarConfig): void {
    for (const spot of this.headlightSpots) {
      spot.intensity = config.headlights ? 18 : 0;
      spot.visible = config.headlights;
    }
    this.setVisible(NODE.LIGHTS_DRL, config.drl);
  }

  /** Advance the wheel spin animation. */
  spinWheels(deltaSeconds: number, speed: number): void {
    for (const wheel of this.wheels) {
      const rim = wheel.getObjectByName(NODE.RIM);
      const tire = wheel.getObjectByName(NODE.TIRE);
      const disc = wheel.getObjectByName(NODE.BRAKE_DISC);
      for (const part of [rim, tire, disc]) {
        if (part) part.rotation.x -= deltaSeconds * speed;
      }
    }
  }

  /** World-space bounding box, useful for framing the camera and shadows. */
  getBounds(target = new THREE.Box3()): THREE.Box3 {
    return target.setFromObject(this.group);
  }

  private clear(): void {
    // Geometry is always ours to release; materials from MaterialLibrary are
    // shared and stay alive, while an authored asset's own materials do not.
    const shared = this.materials.owned;
    for (const child of [...this.group.children]) {
      child.removeFromParent();
      disposeObject3D(child, { shared });
    }
    this.wheels = [];
    this.headlightSpots = [];
    this.suspension = null;
    this.adopted = [];
    this.nodes.clear();
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { classOf, tableFor, type SurfaceTable } from '../data/surfaces';
import type { ModEntry } from '../data/mods';
import { ModLoader } from './modLoader';
import {
  geometryFromIsland,
  islandKey,
  partitionGeometry,
  splitIntoIslands,
  type Island,
} from './islands';

const DEG2RAD = Math.PI / 180;

/** Surface classes that mean "this mesh belongs to a wheel, not to the body". */
const WHEEL_CLASSES = new Set(['rim', 'rim_badge', 'tyre']);

/** Every wheel mod script names its disc/caliper meshes with this suffix. */
const isBrakeNode = (name: string) => name.endsWith('_disc') || name.endsWith('_caliper');

/**
 * Everything the body paint needs, already resolved from the catalogue.
 *
 * `SceneManager` folds the colour, the finish, the flake slider and the
 * clearcoat slider into one of these, so the renderer applies a finished
 * description rather than re-deriving it from four config fields.
 */
export interface PaintSpec {
  hex: string;
  /** Secondary tint the metallic flake sparkles toward. */
  flakeHex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  iridescence: number;
  envIntensity: number;
}

/** Colour + surface properties for the rims. Mirrors `wheelFinishes` in materialsData. */
export interface WheelFinish {
  hex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
}

/** Cabin colours. Mirrors `interiorTrims` in carData. */
export interface InteriorTrim {
  seatHex: string;
  trimHex: string;
  roughness: number;
}

/** Properties a tint may push onto a material. All optional. */
interface Tint {
  hex?: string;
  metalness?: number;
  roughness?: number;
  clearcoat?: number;
}

export interface Stance {
  /** Rim diameter in inches. */
  wheelDiameter: number;
  /** Millimetres relative to stock; negative lowers the body. */
  rideHeight: number;
  /** Degrees; negative tilts the tops of the wheels inboard. */
  camber: number;
  /** Millimetres of spacer per side; positive pushes the wheels outboard. */
  trackOffset: number;
}

/** Everything CarModel needs to know about which car it is showing. */
export interface ModelSpec {
  /** Generation id, used to detect a switch. */
  id: string;
  /** Path to the glTF. */
  url: string;
  /** Real-world length in metres — the model is scaled to this. */
  length: number;
  /** Rim diameter the asset was authored at; wheel scaling is relative to it. */
  nativeWheelInches: number;
  /** Key into the per-model surface tables. */
  surfaceModel: string;
  /** Yaw in degrees needed to point this asset's nose at +Z. */
  yawDeg: number;
}

/** Result of the island debug pass: what got coloured, and how many exist. */
export interface IslandDebugResult {
  shown: IslandReport[];
  total: number;
}

/** One candidate loose part found inside the roof volume. */
export interface IslandReport {
  index: number;
  /** Stable identity, independent of ordering — see islandKey(). */
  key: string;
  colour: string;
  /** True when this part is currently in the roof-lining set. */
  hidden?: boolean;
  triangles: number;
  /** World-space size, metres. */
  size: [number, number, number];
  /** World-space centre, metres. */
  centre: [number, number, number];
}

/**
 * An endless supply of distinguishable colours.
 *
 * Stepping the hue by the golden angle keeps consecutive entries far apart on
 * the wheel however many there are, and alternating lightness separates hues
 * that eventually wrap round near each other.
 */
function islandColour(i: number): string {
  const hue = (i * 137.508) % 360;
  const lightness = i % 3 === 0 ? 62 : i % 3 === 1 ? 48 : 74;
  return `hsl(${hue.toFixed(1)}, 90%, ${lightness}%)`;
}

interface CabinMesh {
  mesh: THREE.Mesh;
  /** Every triangle, before any lining was split out. */
  original: THREE.BufferGeometry;
  islands: Island[];
  /** Parallel to `islands`: does this part sit inside the roof volume? */
  candidate: boolean[];
  /** Parallel to `islands`: world-space centre height of each triangle. */
  triangleHeights: Float32Array[];
}

interface Wheel {
  pivot: THREE.Group;
  /** Contact patch in car-group space, before spacers are applied. */
  base: THREE.Vector3;
  /** Outer (tyre) radius at native size, in car-group units. */
  radius: number;
  /** +1 on the right-hand side of the car, -1 on the left. */
  side: 1 | -1;
  /** The asset's own wheel meshes, so a wheel mod can hide exactly these. */
  oem: THREE.Mesh[];
}

/**
 * Loads the car and drives the few things that can be driven without altering
 * the asset: body colour, rim finish, wheel size, ride height, camber and track.
 *
 * The model's geometry and textures are exactly what the artist shipped —
 * nothing is split, hidden or re-materialled. Two things happen on load:
 *
 * 1. The whole model is scaled, yawed and placed so it stands at real-world
 *    size on the ground plane facing the camera presets.
 * 2. The wheel meshes are re-parented onto four pivots placed at their **ground
 *    contact patches**, which leaves the body as everything still under the
 *    model root. Scaling a wheel about its contact patch keeps it planted on
 *    the tarmac and raises its hub, exactly as fitting a bigger wheel does.
 *
 * That re-parenting is a scene-graph rearrangement, not an edit: no vertex
 * moves, and the asset file is untouched. It exists because the model's wheel
 * nodes have their origins on the car's centreline rather than in the wheels,
 * so scaling them in place would drag the wheels into the sills.
 */
export class CarModel {
  readonly group = new THREE.Group();

  /** The spec currently loaded, so a repeat call for the same car is a no-op. */
  private spec: ModelSpec | null = null;
  private table: SurfaceTable = tableFor('');
  /** Everything that is not a wheel — the model root, once the wheels are out. */
  private body: THREE.Object3D | null = null;
  /** Body height set by `frame()`, before stance is applied. */
  private bodyBaseY = 0;
  private wheels: Wheel[] = [];

  /** Distinct material instances, bucketed by surface class — see `data/surfaces.ts`. */
  private readonly byClass = new Map<string, THREE.Material[]>();
  /** The whole roof part: canvas, stitching decal, rear window and frame. */
  private roofPart: THREE.Object3D | null = null;
  /** Overlay meshes created by the island debug view, so they can be removed. */
  private islandOverlays: THREE.Mesh[] = [];
  /**
   * Cabin meshes decomposed into loose parts once per load. Holding the
   * original geometry matters: once the lining is split out, `mesh.geometry`
   * no longer contains every triangle, and island numbering would drift.
   */
  private cabin: CabinMesh[] = [];
  /** Meshes carrying the roof-lining triangles; hidden along with the roof. */
  private liningMeshes: THREE.Mesh[] = [];
  private liningKeys = new Set<string>();
  private liningCutY: number | null = null;

  // Held so values set before the model finished loading are not lost.
  private paint: PaintSpec | null = null;
  /**
   * Standard→physical upgrades, keyed by the original material's uuid.
   *
   * Cached so the same source material always maps to the same upgrade: mod
   * instances are clones sharing their template's materials, and minting a new
   * one per re-fit would leak a material per mod change.
   */
  private readonly physical = new Map<string, THREE.MeshPhysicalMaterial>();
  private wheelFinish: WheelFinish | null = null;
  private roofFabric: string | null = null;
  private interior: InteriorTrim | null = null;
  private roofUp = true;
  private stance: Stance | null = null;

  /* ---- mods ---------------------------------------------------------- */

  /**
   * Body-mounted mods. A sibling of the model root, not a child of it: the root
   * carries a uniform scale (0.578 on the NA) and an offset, so a mod parented
   * under it would be scaled by that factor. Here it drops in at identity and
   * lands exactly where it was modelled.
   */
  private readonly bodyMods = new THREE.Group();
  private readonly modLoader = new ModLoader(this.loadingManager);
  private modInstances: THREE.Object3D[] = [];
  /** Base-asset nodes a mod switched off, so they can be switched back on. */
  private hiddenByMods: THREE.Object3D[] = [];
  /** Which mods are fitted, so an unchanged selection is a no-op. */
  private modKey = '';
  /**
   * Brake discs and calipers baked into every wheel mod's own geometry — not a
   * mod in their own right, just a part every wheel-mod script happens to
   * build (see `mx5_lib.py` naming: every mesh named `..._disc`/`..._caliper`).
   * They currently sit proud of the wheel face rather than tucked behind the
   * spokes, so they default to hidden until that's fixed, with one toggle to
   * see them anyway.
   */
  private readonly brakeNodes: THREE.Object3D[] = [];
  private wheelBrakesVisible = false;
  /** The last request, held so a selection made before the car finished
   *  loading is not lost — the same pattern as paint, finish and stance. */
  private modRequest: { mods: ModEntry[]; generationId: string } | null = null;

  constructor(private readonly loadingManager: THREE.LoadingManager) {
    this.group.name = 'Car';
    this.bodyMods.name = 'BodyMods';
    this.group.add(this.bodyMods);
  }

  /** Load a car, replacing whatever was loaded before. Idempotent per spec. */
  async load(spec: ModelSpec): Promise<void> {
    if (this.spec?.id === spec.id) return;
    this.clear();
    this.spec = spec;
    this.table = tableFor(spec.surfaceModel);

    const loader = new GLTFLoader(this.loadingManager);
    const gltf = await loader.loadAsync(spec.url);
    const model = gltf.scene;
    model.name = `MX5_${spec.id.toUpperCase()}_Body`;

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    this.group.add(model);
    this.frame(model, spec.length, spec.yawDeg);

    this.body = model;
    this.bodyBaseY = model.position.y;
    this.extractWheels();
    this.indexMaterials();
    this.indexRoof();
    this.indexCabin();
    // Seed from the catalogue; the debug view can override it at runtime.
    this.liningKeys = new Set(this.table.roofLining?.hideWithRoof ?? []);
    this.liningCutY = this.table.roofLining?.cutAboveY ?? null;
    this.rebuildLining();

    if (this.paint) this.setPaint(this.paint);
    if (this.wheelFinish) this.setWheelFinish(this.wheelFinish);
    if (this.roofFabric) this.setRoofFabric(this.roofFabric);
    if (this.interior) this.setInterior(this.interior);
    this.setRoofUp(this.roofUp);
    if (this.stance) this.setStance(this.stance);
    if (this.modRequest) {
      await this.setMods(this.modRequest.mods, this.modRequest.generationId);
    }
  }

  /** Tear the current car down so another can take its place. */
  private clear(): void {
    this.clearMods();
    for (const child of [...this.group.children]) {
      // The mod group outlives the car it was hanging on; only its contents go.
      if (child === this.bodyMods) continue;
      child.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          m?.dispose();
        }
      });
      child.removeFromParent();
    }
    this.byClass.clear();
    this.physical.clear();
    this.cabin = [];
    this.liningMeshes = [];
    this.islandOverlays = [];
    this.wheels = [];
    this.roofPart = null;
    this.body = null;
    this.spec = null;
    // The next car has to be re-fitted from scratch, so forget what was on the
    // last one — otherwise the key matches and setMods() no-ops on a live car.
    this.modKey = '';
  }

  /**
   * Scale the model to real-world size and stand it on the ground, centred at
   * the origin — applied to the model root only, so its internal layout is
   * untouched.
   */
  private frame(model: THREE.Object3D, targetLength: number, yawDeg: number): void {
    // Every camera preset in carData.json is built around a car facing +Z
    // (hero three-quarter at z = +5, rear view at z = -4.4). Assets disagree
    // about which way is forward — the ND's nose points -Z and needs turning,
    // the NA's already points +Z — so the yaw comes from the catalogue.
    model.rotation.y = yawDeg * DEG2RAD;
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    // Longest horizontal axis is the car's length, whichever way it faces.
    const length = Math.max(size.x, size.z);
    if (length > 0) {
      model.scale.multiplyScalar(targetLength / length);
      model.updateWorldMatrix(true, true);
      bounds.setFromObject(model);
    }

    const centre = bounds.getCenter(new THREE.Vector3());
    model.position.x -= centre.x;
    model.position.z -= centre.z;
    model.position.y -= bounds.min.y;
  }

  /* ---------------------------------------------------------------- */
  /* Wheels                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Move every wheel mesh onto a pivot at its ground contact patch.
   *
   * Wheels are found by material class, not by node name — the asset's wheel
   * nodes are called things like `Armature.023_192`, and all four are labelled
   * "WheelFL" internally, so names say nothing useful. Each mesh is bucketed
   * into one of four quadrants by position, which is what actually identifies
   * a wheel.
   *
   * `attach()` preserves world transforms, so nothing visibly moves here. It
   * also sidesteps the asset's per-part helper armatures (0.01 scale, mirrored
   * right-hand side) by baking their contribution into each mesh's new local
   * transform.
   */
  private extractWheels(): void {
    this.group.updateWorldMatrix(true, true);

    const quadrants = new Map<string, THREE.Mesh[]>();
    const centre = new THREE.Vector3();
    const box = new THREE.Box3();

    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const isWheel = materials.some((m) => {
        const cls = m && classOf(this.table, m.name);
        return Boolean(cls && WHEEL_CLASSES.has(cls));
      });
      if (!isWheel) return;

      box.setFromObject(mesh).getCenter(centre);
      const key = `${centre.x > 0 ? 'R' : 'L'}${centre.z > 0 ? 'F' : 'R'}`;
      const bucket = quadrants.get(key);
      if (bucket) bucket.push(mesh);
      else quadrants.set(key, [mesh]);
    });

    for (const meshes of quadrants.values()) {
      const union = new THREE.Box3();
      for (const mesh of meshes) union.union(box.setFromObject(mesh));

      union.getCenter(centre);
      // Contact patch: under the hub, at the bottom of the tyre.
      const base = new THREE.Vector3(centre.x, union.min.y, centre.z);

      const pivot = new THREE.Group();
      pivot.name = `Wheel_${centre.x > 0 ? 'R' : 'L'}${centre.z > 0 ? 'F' : 'R'}`;
      pivot.position.copy(base);
      this.group.add(pivot);
      // attach() keeps each mesh exactly where it already is on screen.
      for (const mesh of meshes) pivot.attach(mesh);

      this.wheels.push({
        pivot,
        base,
        radius: (union.max.y - union.min.y) / 2,
        side: centre.x > 0 ? 1 : -1,
        // Captured now, before any mod is fitted, so hiding "the OEM wheel"
        // later cannot accidentally catch a mod's own rim or tyre — which share
        // the same surface classes by design.
        oem: meshes,
      });
    }

    // Only a model whose table declares wheel classes is expected to have any.
    const declaresWheels = Object.values(this.table.materials).some((c) => WHEEL_CLASSES.has(c));
    if (declaresWheels && this.wheels.length !== 4) {
      console.warn(`[CarModel] ${this.spec?.id}: expected 4 wheels, found ${this.wheels.length}`);
    }
  }

  /**
   * Apply wheel size, ride height, camber and track.
   *
   * Order matters and is handled by three.js composing translate → rotate →
   * scale: the wheel scales about its contact patch (so it stays on the
   * ground), then tilts about that same point (so camber does not lift it),
   * then slides outboard for spacers.
   *
   * The body's height carries both effects: a bigger wheel raises the hubs and
   * therefore the car, and the ride-height slider lowers it from there.
   */
  setStance(stance: Stance): void {
    this.stance = stance;
    if (this.wheels.length === 0) return;

    const scale = stance.wheelDiameter / (this.spec?.nativeWheelInches ?? stance.wheelDiameter);
    const spacer = stance.trackOffset / 1000;
    // Negative camber (a negative config value) tilts the wheel tops inboard.
    const camber = -stance.camber * DEG2RAD;

    for (const wheel of this.wheels) {
      wheel.pivot.scale.setScalar(scale);
      wheel.pivot.position.set(wheel.base.x + wheel.side * spacer, wheel.base.y, wheel.base.z);
      wheel.pivot.rotation.z = wheel.side * camber;
    }

    if (this.body) {
      const hubRise = this.wheels[0].radius * (scale - 1);
      this.body.position.y = this.bodyBaseY + hubRise + stance.rideHeight / 1000;
      // Body mods were modelled against the car at its base height, so they
      // have to carry the same delta. Without this a lowered car leaves its
      // splitter and wing hanging in the air.
      this.bodyMods.position.y = this.body.position.y - this.bodyBaseY;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Mods                                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Fit exactly this set of mods, replacing whatever was fitted before.
   *
   * Nothing here edits the car. A "replace" mod adds its own geometry and
   * switches off the base nodes it stands in for, which is the only way to do
   * it when the asset may not be cut up — see CONFORM_POSTMORTEM.md.
   */
  async setMods(mods: ModEntry[], generationId: string): Promise<void> {
    this.modRequest = { mods, generationId };
    // Nothing to bolt onto yet. `load()` re-applies the held request, so a
    // selection made while the car is still downloading is not silently lost.
    if (!this.body) return;

    const key = mods.map((m) => m.id).sort().join(',');
    if (key === this.modKey) return;
    this.modKey = key;
    this.clearMods();

    for (const mod of mods) {
      let instance: THREE.Group;
      try {
        instance = await this.modLoader.instance(mod, generationId);
      } catch (error) {
        console.warn(`[CarModel] could not load mod ${mod.id}:`, error);
        continue;
      }

      if (mod.attachTo === 'wheel') {
        for (const wheel of this.wheels) {
          const copy = wheel === this.wheels[0] ? instance : instance.clone(true);
          // Modelled for one side only. The other side is half a turn about the
          // vertical, which is rigid — mirroring with a negative scale would
          // invert the winding and light the wheel inside out.
          copy.rotation.y = wheel.side === 1 ? 0 : Math.PI;
          wheel.pivot.add(copy);
          this.modInstances.push(copy);
          for (const mesh of wheel.oem) this.hide(mesh);

          copy.traverse((node) => {
            if (isBrakeNode(node.name)) {
              node.visible = this.wheelBrakesVisible;
              this.brakeNodes.push(node);
            }
          });
        }
      } else {
        this.bodyMods.add(instance);
        this.modInstances.push(instance);
      }

      for (const name of mod.hides?.[generationId] ?? []) this.hideNode(name);
    }

    // Mod materials are in the shared table, so re-bucketing picks them up and
    // the existing pickers colour them with no special case.
    this.indexMaterials();
    if (this.paint) this.setPaint(this.paint);
    if (this.wheelFinish) this.setWheelFinish(this.wheelFinish);
    if (this.stance) this.setStance(this.stance);
  }

  /** Detach every mod instance and switch the base parts back on. */
  private clearMods(): void {
    for (const instance of this.modInstances) instance.removeFromParent();
    this.modInstances = [];
    for (const node of this.hiddenByMods) node.visible = true;
    this.hiddenByMods = [];
    this.brakeNodes.length = 0;
  }

  /** Show or hide the brake discs/calipers baked into every wheel mod. */
  setWheelBrakes(visible: boolean): void {
    this.wheelBrakesVisible = visible;
    for (const node of this.brakeNodes) node.visible = visible;
  }

  private hide(node: THREE.Object3D): void {
    if (!node.visible) return;
    node.visible = false;
    this.hiddenByMods.push(node);
  }

  /**
   * Switch off a base-asset node by its glTF name.
   *
   * GLTFLoader runs every name through `PropertyBinding.sanitizeNodeName`, so
   * `Boot 6.001_157` in the file arrives as `Boot_6001_157` on the object and
   * the original is kept on `userData.name`. Matching only what the catalogue
   * says would silently hide nothing at all, and a "replacement" panel would
   * sit inside the part it replaces.
   */
  private hideNode(name: string): void {
    const sanitised = THREE.PropertyBinding.sanitizeNodeName(name);
    let found = false;
    this.body?.traverse((node) => {
      if (node.userData?.name === name || node.name === name || node.name === sanitised) {
        this.hide(node);
        found = true;
      }
    });
    if (!found) console.warn(`[CarModel] mod wants to hide "${name}", which is not in the asset`);
  }

  /* ---------------------------------------------------------------- */
  /* Materials                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Bucket every distinct material instance by its surface class.
   *
   * All 18 painted meshes share one glTF material, and each wheel has its own
   * copy of the rim material — but three.js will clone a material when meshes
   * need different shader variants, so collect distinct instances rather than
   * assuming a count.
   */
  private indexMaterials(): void {
    const seen = new Map<string, Set<THREE.Material>>();
    const unclassified = new Set<string>();

    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!material) continue;
        const cls = classOf(this.table, material.name);
        if (!cls) {
          unclassified.add(material.name);
          continue;
        }
        const bucket = seen.get(cls);
        if (bucket) bucket.add(material);
        else seen.set(cls, new Set([material]));
      }
    });

    this.byClass.clear();
    for (const [cls, materials] of seen) this.byClass.set(cls, [...materials]);

    if (unclassified.size > 0 && this.table.complete) {
      // Not fatal — an unclassified surface simply never gets touched. Worth
      // saying out loud, because it means the asset and the table have drifted.
      console.warn(
        `[CarModel] ${this.spec?.id}: ${unclassified.size} material(s) missing from surfaceClasses.json:`,
        [...unclassified].join(', '),
      );
    }
  }

  /**
   * Push colour and/or surface properties onto every material of a class.
   * A class the asset does not use is simply a no-op.
   */
  private tint(surfaceClass: string, tint: Tint): void {
    const materials = this.byClass.get(surfaceClass);
    if (!materials) return;
    for (const material of materials) {
      const pbr = material as THREE.Material & {
        color?: THREE.Color;
        metalness?: number;
        roughness?: number;
        clearcoat?: number;
      };
      if (tint.hex !== undefined) pbr.color?.set(tint.hex);
      if (tint.metalness !== undefined && typeof pbr.metalness === 'number') {
        pbr.metalness = tint.metalness;
      }
      if (tint.roughness !== undefined && typeof pbr.roughness === 'number') {
        pbr.roughness = tint.roughness;
      }
      if (tint.clearcoat !== undefined && typeof pbr.clearcoat === 'number') {
        pbr.clearcoat = tint.clearcoat;
      }
      material.needsUpdate = true;
    }
  }

  /**
   * Set the body colour. Affects only materials classified `body_paint`;
   * trim, glass, lenses, badges, rims and interior are untouched because they
   * are simply not in that class.
   */
  setPaint(spec: PaintSpec): void {
    this.paint = spec;
    this.upgradePaintMaterials();

    const materials = this.byClass.get(this.table.paintableClass);
    if (!materials) return;

    for (const material of materials) {
      const pbr = material as THREE.MeshPhysicalMaterial;
      pbr.color?.set(spec.hex);
      if (typeof pbr.metalness === 'number') pbr.metalness = spec.metalness;
      if (typeof pbr.roughness === 'number') pbr.roughness = spec.roughness;

      // Only MeshPhysicalMaterial carries these. Everything paintable is
      // upgraded above, so in practice they all do — but a mod that shipped a
      // plain standard material must degrade to colour and gloss, not throw.
      if (pbr.isMeshPhysicalMaterial) {
        pbr.clearcoat = spec.clearcoat;
        pbr.clearcoatRoughness = spec.clearcoatRoughness;
        pbr.sheen = spec.sheen;
        pbr.sheenColor?.set(spec.flakeHex);
        pbr.iridescence = spec.iridescence;
      }
      pbr.envMapIntensity = spec.envIntensity;

      // clearcoat, sheen and iridescence are compiled in behind defines, so a
      // value crossing zero changes the shader, not just a uniform. Without
      // this, switching gloss→matte leaves the old program in place.
      material.needsUpdate = true;
    }
  }

  /**
   * Replace paintable MeshStandardMaterials with MeshPhysicalMaterial.
   *
   * The ND's own paint already ships as physical, but a mod exported from
   * Blender without a coat weight comes through as standard, where clearcoat
   * and sheen simply do not exist. Left alone, a matte body would sit next to a
   * glossy carbon-bonnet-shaped hole in the finish.
   */
  private upgradePaintMaterials(): void {
    const paintable = this.table.paintableClass;
    let changed = false;

    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      const next = list.map((material) => {
        if (!material || classOf(this.table, material.name) !== paintable) return material;
        if ((material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return material;

        const cached = this.physical.get(material.uuid);
        if (cached) return cached;

        const from = material as THREE.MeshStandardMaterial;
        // Constructed field by field rather than via copy(): MeshPhysicalMaterial's
        // own copy() reads clearcoat/sheen off the source, which a standard
        // material does not have, and writes undefined into them.
        const upgraded = new THREE.MeshPhysicalMaterial({
          name: from.name,
          color: from.color,
          map: from.map,
          metalness: from.metalness,
          roughness: from.roughness,
          metalnessMap: from.metalnessMap,
          roughnessMap: from.roughnessMap,
          normalMap: from.normalMap,
          normalScale: from.normalScale,
          aoMap: from.aoMap,
          aoMapIntensity: from.aoMapIntensity,
          emissive: from.emissive,
          emissiveMap: from.emissiveMap,
          envMapIntensity: from.envMapIntensity,
          side: from.side,
          transparent: from.transparent,
          opacity: from.opacity,
          alphaTest: from.alphaTest,
        });
        this.physical.set(material.uuid, upgraded);
        changed = true;
        return upgraded;
      });

      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });

    // The bucket holds the materials we just replaced, so rebuild it.
    if (changed) this.indexMaterials();
  }

  /**
   * Set the rim finish. Unlike body paint this drives metalness/roughness as
   * well as colour, because that is what separates matte black from chrome.
   * Tyres and centre-cap badges are other classes and never change.
   */
  setWheelFinish(finish: WheelFinish): void {
    this.wheelFinish = finish;
    this.tint('rim', {
      hex: finish.hex,
      metalness: finish.metalness,
      roughness: finish.roughness,
      clearcoat: finish.clearcoat,
    });
  }

  /** Colour the soft top. The stitching decal follows the canvas. */
  setRoofFabric(hex: string): void {
    this.roofFabric = hex;
    this.tint('soft_top', { hex });
  }

  /**
   * Colour the cabin. `seatHex` lands on the whole interior tub, because seats,
   * dashboard, steering wheel and door cards are one mesh sharing one material
   * — they cannot be separated without cutting geometry. `trimHex` lands on the
   * door tops and dash rail, which are a distinct material.
   */
  setInterior(trim: InteriorTrim): void {
    this.interior = trim;
    this.tint('interior_main', { hex: trim.seatHex, roughness: trim.roughness });
    this.tint('interior_trim', { hex: trim.trimHex });
  }

  /**
   * Raise or lower the roof. The model ships one roof state and no folded
   * stack, so "down" hides the roof part outright — canvas, stitching, rear
   * window and frame together, so nothing is left floating.
   */
  setRoofUp(up: boolean): void {
    this.roofUp = up;
    if (this.roofPart) this.roofPart.visible = up;
    for (const lining of this.liningMeshes) lining.visible = up;
  }

  /**
   * Find the top-level part containing the soft top.
   *
   * The asset nests every part under a single-child chain
   * (`Sketchfab_model → root → GLTF_SceneRootNode`) before branching into 44
   * parts, so walking down to the branch point and back up from the canvas
   * mesh lands on the whole roof assembly rather than just the canvas.
   */
  private indexRoof(): void {
    let partsRoot: THREE.Object3D | null = this.body;
    while (partsRoot && partsRoot.children.length === 1) partsRoot = partsRoot.children[0];
    if (!partsRoot) return;

    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || this.roofPart) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!materials.some((m) => m && classOf(this.table, m.name) === 'soft_top')) return;

      let node: THREE.Object3D = mesh;
      while (node.parent && node.parent !== partsRoot) node = node.parent;
      if (node.parent === partsRoot) this.roofPart = node;
    });

    // Only warn when this model claims to have a soft top at all.
    const declaresRoof = Object.values(this.table.materials).includes('soft_top');
    if (declaresRoof && !this.roofPart) {
      console.warn(`[CarModel] ${this.spec?.id}: roof part not found — roof-down will do nothing`);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Island debug view                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Colour each loose part of the cabin mesh that sits inside the roof volume.
   *
   * The ND's interior mesh is a bag of ~768 disconnected islands, and some of
   * them are roof lining rather than cabin trim — which is why hiding the roof
   * part alone leaves an inner shell behind. Bounding boxes cannot tell lining
   * from trim reliably, so this paints the candidates in distinct colours and
   * lets a human say which is which.
   *
   * Returns one entry per candidate, in the same order as the legend.
   */
  showIslandDebug(enabled: boolean): IslandDebugResult {
    for (const overlay of this.islandOverlays) {
      overlay.removeFromParent();
      overlay.geometry.dispose();
      (overlay.material as THREE.Material).dispose();
    }
    this.islandOverlays = [];
    if (!enabled) return { shown: [], total: 0 };

    const candidates = this.roofCandidates();
    if (candidates.length === 0) return { shown: [], total: 0 };

    // Biggest first, so the parts most likely to matter get the low numbers.
    candidates.sort((a, b) => b.island.triangleCount - a.island.triangleCount);

    const shown: IslandReport[] = [];
    for (const { entry, island, box } of candidates) {
      const mesh = entry.mesh;
      const colour = islandColour(shown.length);
      const overlay = new THREE.Mesh(
        // Built from the ORIGINAL geometry: once lining is split out the live
        // geometry is missing triangles, and the overlay would have holes.
        geometryFromIsland(entry.original, island),
        new THREE.MeshBasicMaterial({
          color: colour,
          side: THREE.DoubleSide,
          depthTest: true,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      overlay.name = `IslandDebug_${shown.length}`;
      // Child of the source mesh, so the island's local coordinates line up.
      mesh.add(overlay);
      this.islandOverlays.push(overlay);

      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      shown.push({
        index: shown.length,
        key: islandKey(island),
        colour,
        triangles: island.triangleCount,
        size: [size.x, size.y, size.z],
        centre: [centre.x, centre.y, centre.z],
        hidden: this.liningKeys.has(islandKey(island)),
      });
    }
    return { shown, total: candidates.length };
  }

  /**
   * Cabin loose parts that sit inside the roof volume, from the cached
   * decomposition. Cheap to call repeatedly — the expensive island split
   * happens once per load.
   */
  private roofCandidates(): { entry: CabinMesh; island: Island; box: THREE.Box3 }[] {
    const out: { entry: CabinMesh; island: Island; box: THREE.Box3 }[] = [];
    const worldBox = new THREE.Box3();
    for (const entry of this.cabin) {
      entry.islands.forEach((island, i) => {
        if (!entry.candidate[i]) return;
        worldBox.copy(island.box).applyMatrix4(entry.mesh.matrixWorld);
        out.push({ entry, island, box: worldBox.clone() });
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Roof lining                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Decompose the cabin meshes once, and mark which loose parts sit inside the
   * roof volume. Everything downstream — the debug view and the lining split —
   * reads this cache rather than re-splitting.
   */
  private indexCabin(): void {
    this.cabin = [];
    if (!this.roofPart) return;

    // The roof's own volume defines "inside the roof", measured not guessed.
    const wasVisible = this.roofPart.visible;
    this.roofPart.visible = true;
    const roofBox = new THREE.Box3().setFromObject(this.roofPart);
    this.roofPart.visible = wasVisible;
    roofBox.expandByScalar(0.04);

    const worldBox = new THREE.Box3();
    const a = new THREE.Vector3();
    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const inCabin = materials.some((m) => {
        const cls = m && classOf(this.table, m.name);
        return cls === 'interior_main' || cls === 'interior_trim';
      });
      if (!inCabin) return;

      const original = mesh.geometry;
      const islands = splitIntoIslands(original);
      const position = original.getAttribute('position');
      const index = original.getIndex();
      const at = (i: number) => (index ? index.getX(i) : i);

      const candidate: boolean[] = [];
      const triangleHeights: Float32Array[] = [];
      for (const island of islands) {
        worldBox.copy(island.box).applyMatrix4(mesh.matrixWorld);
        // Merely *reaching* the roof is not enough — the cabin tub is 1.8 m
        // tall and touches it. A roof-lining part lives entirely up there.
        const isCandidate =
          roofBox.intersectsBox(worldBox) &&
          worldBox.min.y >= roofBox.min.y - 0.02 &&
          island.triangleCount >= 8;
        candidate.push(isCandidate);

        // Per-triangle world height, so the cut slider is a lookup not a re-solve.
        const heights = new Float32Array(isCandidate ? island.triangles.length : 0);
        if (isCandidate) {
          island.triangles.forEach((offset, t) => {
            let sum = 0;
            for (let k = 0; k < 3; k++) {
              a.fromBufferAttribute(position, at(offset + k)).applyMatrix4(mesh.matrixWorld);
              sum += a.y;
            }
            heights[t] = sum / 3;
          });
        }
        triangleHeights.push(heights);
      }
      this.cabin.push({ mesh, original, islands, candidate, triangleHeights });
    });
  }

  /**
   * Split the nominated lining triangles out of the cabin meshes into their own
   * meshes, which then follow the roof's visibility.
   *
   * Two ways a triangle becomes lining: it belongs to a part listed in
   * `liningKeys` (hidden whole), or — for parts inside the roof volume only —
   * it sits above `liningCutY`. The height cut exists because some parts are
   * lining at the top and A-pillar trim further down, so no whole-part rule
   * can separate them.
   */
  private rebuildLining(): void {
    for (const mesh of this.liningMeshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.liningMeshes = [];

    for (const entry of this.cabin) {
      const hide = new Set<number>();
      entry.islands.forEach((island, i) => {
        if (this.liningKeys.has(islandKey(island))) {
          for (const offset of island.triangles) hide.add(offset);
          return;
        }
        if (this.liningCutY === null || !entry.candidate[i]) return;
        const heights = entry.triangleHeights[i];
        island.triangles.forEach((offset, t) => {
          if (heights[t] > this.liningCutY!) hide.add(offset);
        });
      });

      if (hide.size === 0) {
        entry.mesh.geometry = entry.original;
        continue;
      }

      const { keep, hidden } = partitionGeometry(entry.original, hide);
      entry.mesh.geometry = keep;

      const lining = new THREE.Mesh(hidden, entry.mesh.material);
      lining.name = 'RoofLining';
      lining.castShadow = true;
      lining.receiveShadow = true;
      lining.visible = this.roofUp;
      // Child of the source mesh, so the split geometry's local space lines up.
      entry.mesh.add(lining);
      this.liningMeshes.push(lining);
    }
  }

  /** Hide these loose parts (by stable key) whenever the roof is down. */
  setRoofLining(keys: string[], cutY: number | null): void {
    this.liningKeys = new Set(keys);
    this.liningCutY = cutY;
    this.rebuildLining();
  }

  /** Current height cut, and a sensible range for a slider, in world metres. */
  roofCutRange(): { min: number; max: number; value: number | null } | null {
    if (!this.roofPart) return null;
    const wasVisible = this.roofPart.visible;
    this.roofPart.visible = true;
    const box = new THREE.Box3().setFromObject(this.roofPart);
    this.roofPart.visible = wasVisible;
    return { min: box.min.y, max: box.max.y, value: this.liningCutY };
  }

  /** The overlay meshes, so the scene can raycast against them. */
  get islandMeshes(): THREE.Mesh[] {
    return this.islandOverlays;
  }

  /**
   * Emphasise one island and fade the rest, so a single part can be read out
   * of a crowded pile. Pass `null` to show them all equally.
   */
  highlightIsland(index: number | null): void {
    this.islandOverlays.forEach((overlay, i) => {
      const material = overlay.material as THREE.MeshBasicMaterial;
      const selected = index === null || i === index;
      material.opacity = selected ? 1 : 0.12;
      material.transparent = !selected;
      material.depthWrite = selected;
      overlay.renderOrder = selected && index !== null ? 1 : 0;
    });
  }

  /* ---------------------------------------------------------------- */

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}

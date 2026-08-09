import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { classOf, isPaintable } from '../data/surfaces';

/**
 * The Sketchfab source model, copied in verbatim (glTF + .bin + textures).
 * See `public/assets/models/README.md`.
 */
const MODEL_URL = 'assets/models/mx5_sketchfab/scene.gltf';

/** Real-world length of an ND MX-5, in metres — the scale the scene is built around. */
const TARGET_LENGTH = 3.915;

/** Rim diameter the model was authored at. Wheel scaling is relative to this. */
const NATIVE_WHEEL_INCHES = 17;

const DEG2RAD = Math.PI / 180;

/** Surface classes that mean "this mesh belongs to a wheel, not to the body". */
const WHEEL_CLASSES = new Set(['rim', 'rim_badge', 'tyre']);

/** Colour + surface properties for the rims. Mirrors `wheelFinishes` in materialsData. */
export interface WheelFinish {
  hex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
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

interface Wheel {
  pivot: THREE.Group;
  /** Contact patch in car-group space, before spacers are applied. */
  base: THREE.Vector3;
  /** Outer (tyre) radius at native size, in car-group units. */
  radius: number;
  /** +1 on the right-hand side of the car, -1 on the left. */
  side: 1 | -1;
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

  private loaded = false;
  /** Everything that is not a wheel — the model root, once the wheels are out. */
  private body: THREE.Object3D | null = null;
  /** Body height set by `frame()`, before stance is applied. */
  private bodyBaseY = 0;
  private wheels: Wheel[] = [];

  /** Distinct material instances carrying body colour — see `data/surfaces.ts`. */
  private paintMaterials: THREE.Material[] = [];
  /** Rim materials (one per wheel in this asset). Excludes tyres and centre caps. */
  private rimMaterials: THREE.Material[] = [];

  // Held so values set before the model finished loading are not lost.
  private paintColor: string | null = null;
  private wheelFinish: WheelFinish | null = null;
  private stance: Stance | null = null;

  constructor(private readonly loadingManager: THREE.LoadingManager) {
    this.group.name = 'Car';
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    const loader = new GLTFLoader(this.loadingManager);
    const gltf = await loader.loadAsync(MODEL_URL);
    const model = gltf.scene;
    model.name = 'MX5_Body';

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    this.group.add(model);
    this.frame(model);

    this.body = model;
    this.bodyBaseY = model.position.y;
    this.extractWheels();
    this.indexMaterials();

    if (this.paintColor) this.setPaintColor(this.paintColor);
    if (this.wheelFinish) this.setWheelFinish(this.wheelFinish);
    if (this.stance) this.setStance(this.stance);

    this.loaded = true;
  }

  /**
   * Scale the model to real-world size and stand it on the ground, centred at
   * the origin — applied to the model root only, so its internal layout is
   * untouched.
   */
  private frame(model: THREE.Object3D): void {
    // The source model's nose points down -Z; every camera preset in
    // carData.json is built around a car facing +Z (hero three-quarter at
    // z = +5, rear view at z = -4.4). Turn the whole model to suit.
    model.rotation.y = Math.PI;
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    // Longest horizontal axis is the car's length, whichever way it faces.
    const length = Math.max(size.x, size.z);
    if (length > 0) {
      model.scale.multiplyScalar(TARGET_LENGTH / length);
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
        const cls = m && classOf(m.name);
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
      });
    }

    if (this.wheels.length !== 4) {
      console.warn(`[CarModel] expected 4 wheels, found ${this.wheels.length}`);
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

    const scale = stance.wheelDiameter / NATIVE_WHEEL_INCHES;
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
    }
  }

  /* ---------------------------------------------------------------- */
  /* Materials                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Collect the material instances the configurator is allowed to touch.
   *
   * All 18 painted meshes share one glTF material, and each wheel has its own
   * copy of the rim material — but three.js will clone a material when meshes
   * need different shader variants, so collect distinct instances rather than
   * assuming a count.
   */
  private indexMaterials(): void {
    const paint = new Set<THREE.Material>();
    const rim = new Set<THREE.Material>();
    const unclassified = new Set<string>();

    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!material) continue;
        const cls = classOf(material.name);
        if (isPaintable(material.name)) paint.add(material);
        // Rims only. Tyres stay black and the centre cap keeps its badge.
        else if (cls === 'rim') rim.add(material);
        else if (!cls) unclassified.add(material.name);
      }
    });

    this.paintMaterials = [...paint];
    this.rimMaterials = [...rim];

    if (unclassified.size > 0) {
      // Not fatal — an unclassified surface simply never gets touched. Worth
      // saying out loud, because it means the asset and the table have drifted.
      console.warn(
        `[CarModel] ${unclassified.size} material(s) missing from surfaceClasses.json:`,
        [...unclassified].join(', '),
      );
    }
  }

  /**
   * Set the body colour. Affects only materials classified `body_paint`;
   * trim, glass, lenses, badges, rims and interior are untouched because they
   * are simply not in this set.
   */
  setPaintColor(hex: string): void {
    this.paintColor = hex;
    for (const material of this.paintMaterials) {
      const colored = material as THREE.Material & { color?: THREE.Color };
      colored.color?.set(hex);
    }
  }

  /**
   * Set the rim finish. Unlike body paint this drives metalness/roughness as
   * well as colour, because that is what separates matte black from chrome.
   * Tyres and centre-cap badges are not in `rimMaterials` and never change.
   */
  setWheelFinish(finish: WheelFinish): void {
    this.wheelFinish = finish;
    for (const material of this.rimMaterials) {
      const pbr = material as THREE.Material & {
        color?: THREE.Color;
        metalness?: number;
        roughness?: number;
        clearcoat?: number;
      };
      pbr.color?.set(finish.hex);
      if (typeof pbr.metalness === 'number') pbr.metalness = finish.metalness;
      if (typeof pbr.roughness === 'number') pbr.roughness = finish.roughness;
      if (typeof pbr.clearcoat === 'number') pbr.clearcoat = finish.clearcoat;
      material.needsUpdate = true;
    }
  }

  /* ---------------------------------------------------------------- */

  dispose(): void {
    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        material?.dispose();
      }
    });
    this.group.clear();
    this.group.removeFromParent();
    this.wheels = [];
  }
}

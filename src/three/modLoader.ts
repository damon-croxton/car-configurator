import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModEntry } from '../data/mods';

/**
 * Loads mod `.glb` files and hands out instances of them.
 *
 * Each file is fetched once and kept as a template; every instance is a clone
 * that shares the template's geometry and materials. Sharing the materials is
 * deliberate rather than merely cheap — `CarModel` recolours by walking the
 * scene and bucketing distinct material instances by surface class, so four
 * wheels that share one rim material get painted together, exactly as the
 * asset's own wheels do.
 *
 * Only the templates own GPU resources, so removing an instance is free and
 * disposal happens once, when the car is torn down.
 */
export class ModLoader {
  private readonly loader: GLTFLoader;
  private readonly templates = new Map<string, Promise<THREE.Group>>();

  constructor(manager?: THREE.LoadingManager) {
    this.loader = new GLTFLoader(manager);
  }

  /** The template for a file path, loading it if this is the first ask. */
  private template(url: string): Promise<THREE.Group> {
    const cached = this.templates.get(url);
    if (cached) return cached;

    const pending = this.loader.loadAsync(url).then((gltf) => {
      const root = gltf.scene;
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      return root;
    });

    this.templates.set(url, pending);
    return pending;
  }

  /** An instance of `mod` for this generation, ready to be parented. */
  async instance(mod: ModEntry, generationId: string): Promise<THREE.Group> {
    const url = mod.file[generationId];
    if (!url) throw new Error(`[ModLoader] ${mod.id} has no file for ${generationId}`);

    const template = await this.template(url);
    const clone = template.clone(true);
    clone.name = `Mod_${mod.id}`;
    return clone;
  }

  /** Drop every template's GPU resources. Instances must already be detached. */
  dispose(): void {
    for (const pending of this.templates.values()) {
      pending
        .then((root) => {
          root.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry?.dispose();
            for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
              m?.dispose();
            }
          });
        })
        .catch(() => {
          /* a template that never loaded has nothing to free */
        });
    }
    this.templates.clear();
  }
}

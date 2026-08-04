import * as THREE from 'three';

/**
 * WebGL memory hygiene. Every geometry, material and texture created for a car
 * or an environment is released here when the object is swapped out — without
 * this, cycling generations or environments leaks GPU memory until the context
 * is lost.
 */

export function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

export interface DisposeOptions {
  /** Skip material disposal entirely (they are owned elsewhere). */
  keepMaterials?: boolean;
  /** Materials owned by a shared library — disposed by that library instead. */
  shared?: ReadonlySet<THREE.Material>;
}

/** Recursively dispose every geometry/material/texture below `root`. */
export function disposeObject3D(root: THREE.Object3D, options: DisposeOptions = {}): void {
  const seenMaterials = new Set<THREE.Material>();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    if (options.keepMaterials) return;
    const material = mesh.material;
    if (!material) return;

    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      if (!entry || seenMaterials.has(entry) || options.shared?.has(entry)) continue;
      seenMaterials.add(entry);
      disposeMaterial(entry);
    }
  });
}

/** Detach `child` from its parent and dispose everything it owns. */
export function removeAndDispose(child: THREE.Object3D | null, options?: DisposeOptions): void {
  if (!child) return;
  child.removeFromParent();
  disposeObject3D(child, options);
}

/**
 * Tracks disposables created outside the scene graph (render targets, PMREM
 * textures, standalone materials) so a manager can clean up in one call.
 */
export class DisposalBin {
  private readonly items: { dispose(): void }[] = [];

  add<T extends { dispose(): void }>(item: T): T {
    this.items.push(item);
    return item;
  }

  flush(): void {
    while (this.items.length) {
      try {
        this.items.pop()?.dispose();
      } catch {
        // A double-dispose must never break teardown.
      }
    }
  }
}

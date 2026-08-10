import * as THREE from 'three';

/**
 * Split a geometry into connected components ("loose parts").
 *
 * Connectivity is judged by **welded position**, not by vertex index. glTF
 * duplicates vertices at UV and normal seams, so two triangles that visibly
 * share an edge often have different indices for the same corner. Welding
 * first is what makes the island count match what Blender reports.
 */
export interface Island {
  /** Offsets into the source index buffer, one per triangle (step of 3). */
  triangles: number[];
  box: THREE.Box3;
  triangleCount: number;
}

export function splitIntoIslands(geometry: THREE.BufferGeometry, weld = 0): Island[] {
  const position = geometry.getAttribute('position');
  if (!position) return [];

  const index = geometry.getIndex();
  const triangleCount = (index ? index.count : position.count) / 3;
  const at = (i: number) => (index ? index.getX(i) : i);

  // Connectivity is topological by default — shared vertex indices, exactly
  // what Blender's "loose parts" means. Welding by position is available but
  // OFF, because parts that merely touch (a trim panel resting on the tub)
  // would fuse into one island and hide the very split we are looking for.
  const canonical = new Int32Array(position.count);
  for (let v = 0; v < position.count; v++) canonical[v] = v;
  if (weld > 0) {
    const byCell = new Map<string, number>();
    for (let v = 0; v < position.count; v++) {
      const key =
        `${Math.round(position.getX(v) / weld)},` +
        `${Math.round(position.getY(v) / weld)},` +
        `${Math.round(position.getZ(v) / weld)}`;
      const seen = byCell.get(key);
      if (seen === undefined) byCell.set(key, v);
      else canonical[v] = seen;
    }
  }

  // Union-find over the welded corners.
  const parent = new Int32Array(position.count);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (a: number): number => {
    let root = a;
    while (parent[root] !== root) root = parent[root];
    while (parent[a] !== root) {
      const next = parent[a];
      parent[a] = root;
      a = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let t = 0; t < triangleCount; t++) {
    const a = canonical[at(t * 3)];
    const b = canonical[at(t * 3 + 1)];
    const c = canonical[at(t * 3 + 2)];
    union(a, b);
    union(b, c);
  }

  // Group triangles by the root of their first corner.
  const groups = new Map<number, number[]>();
  for (let t = 0; t < triangleCount; t++) {
    const root = find(canonical[at(t * 3)]);
    const bucket = groups.get(root);
    if (bucket) bucket.push(t * 3);
    else groups.set(root, [t * 3]);
  }

  const vertex = new THREE.Vector3();
  const islands: Island[] = [];
  for (const triangles of groups.values()) {
    const box = new THREE.Box3();
    for (const offset of triangles) {
      for (let k = 0; k < 3; k++) {
        vertex.fromBufferAttribute(position, at(offset + k));
        box.expandByPoint(vertex);
      }
    }
    islands.push({ triangles, box, triangleCount: triangles.length });
  }

  islands.sort((a, b) => b.triangleCount - a.triangleCount);
  return islands;
}

/**
 * A stable name for an island, independent of discovery or sort order.
 *
 * Indices shift the moment a filter changes, so anything persisted to a data
 * file keys off this instead: triangle count plus local-space centre, which
 * only change if the asset itself changes.
 */
export function islandKey(island: Island): string {
  const c = island.box.getCenter(new THREE.Vector3());
  return `${island.triangleCount}@${c.x.toFixed(3)},${c.y.toFixed(3)},${c.z.toFixed(3)}`;
}

/**
 * Partition a geometry's triangles into two geometries, carrying **every**
 * attribute across — UVs, normals, tangents, the lot. The debug overlay can
 * get away with positions alone; a geometry that has to render for real
 * cannot, or the interior loses its texture mapping.
 *
 * Returns non-indexed geometries, which costs some vertices and buys
 * simplicity. Either side may come back empty.
 */
export function partitionGeometry(
  source: THREE.BufferGeometry,
  hiddenOffsets: ReadonlySet<number>,
): { keep: THREE.BufferGeometry; hidden: THREE.BufferGeometry } {
  const index = source.getIndex();
  const position = source.getAttribute('position');
  const triangleCount = (index ? index.count : position.count) / 3;
  const at = (i: number) => (index ? index.getX(i) : i);

  const keepOffsets: number[] = [];
  const hideOffsets: number[] = [];
  for (let t = 0; t < triangleCount; t++) {
    (hiddenOffsets.has(t * 3) ? hideOffsets : keepOffsets).push(t * 3);
  }

  const build = (offsets: number[]): THREE.BufferGeometry => {
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(source.attributes)) {
      const src = source.getAttribute(name) as THREE.BufferAttribute;
      const itemSize = src.itemSize;
      const data = new Float32Array(offsets.length * 3 * itemSize);
      let w = 0;
      for (const offset of offsets) {
        for (let k = 0; k < 3; k++) {
          const v = at(offset + k);
          for (let c = 0; c < itemSize; c++) data[w++] = src.getComponent(v, c);
        }
      }
      out.setAttribute(name, new THREE.BufferAttribute(data, itemSize, src.normalized));
    }
    return out;
  };

  return { keep: build(keepOffsets), hidden: build(hideOffsets) };
}

/** Build a standalone geometry containing only the given island's triangles. */
export function geometryFromIsland(source: THREE.BufferGeometry, island: Island): THREE.BufferGeometry {
  const position = source.getAttribute('position');
  const index = source.getIndex();
  const at = (i: number) => (index ? index.getX(i) : i);

  const out = new Float32Array(island.triangles.length * 3 * 3);
  let w = 0;
  for (const offset of island.triangles) {
    for (let k = 0; k < 3; k++) {
      const v = at(offset + k);
      out[w++] = position.getX(v);
      out[w++] = position.getY(v);
      out[w++] = position.getZ(v);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geometry.computeVertexNormals();
  return geometry;
}

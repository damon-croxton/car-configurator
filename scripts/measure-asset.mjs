#!/usr/bin/env node
/**
 * Measure a car asset in the app's own world space.
 *
 * The mod pipeline needs anchor coordinates, and the only coordinate system
 * that matters is the one the running app puts the car in — not the one the
 * artist authored in. `CarModel.frame()` yaws the asset so its nose points +Z,
 * scales it so its longest horizontal axis equals `dimensions.length`, centres
 * it on X/Z and stands it on Y=0. This script replays exactly that transform
 * and reports where things actually are afterwards.
 *
 * Everything downstream — anchor empties in Blender, mod bounding boxes, the
 * "does it float" check — is derived from this output rather than from a
 * nominal number typed into a document.
 *
 *   node scripts/measure-asset.mjs            # both generations, summary
 *   node scripts/measure-asset.mjs na --json  # machine-readable
 *   node scripts/measure-asset.mjs nd --nodes # per-node bounding boxes too
 *
 * Output units are millimetres, because that is what the modelling brief and
 * Blender work in. Axes are the app's: +X vehicle LEFT, +Y up, +Z forward
 * (nose). See mx5-mod-modelling-brief.md §1.
 */
import { NodeIO } from '@gltf-transform/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const carData = JSON.parse(readFileSync(resolve(ROOT, 'src/data/carData.json'), 'utf8'));
const surfaceClasses = JSON.parse(
  readFileSync(resolve(ROOT, 'src/data/surfaceClasses.json'), 'utf8'),
);

/** Mirrors `surfaces.ts` — strip a `.001`-style duplicate suffix, keep a bare dot. */
const normalise = (name) => name.replace(/\.\d{3}$/, '');
const WHEEL_CLASSES = new Set(['rim', 'rim_badge', 'tyre']);

/* ------------------------------------------------------------------ */
/* Minimal 4x4 maths — column-major, same convention as glTF/three.js  */
/* ------------------------------------------------------------------ */

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

function applyPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Node local matrix from TRS (glTF nodes are TRS or an explicit matrix). */
function localMatrix(node) {
  const [tx, ty, tz] = node.getTranslation();
  const [qx, qy, qz, qw] = node.getRotation();
  const [sx, sy, sz] = node.getScale();

  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function yawMatrix(deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

const scaleMatrix = (k) => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1];
const translateMatrix = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

/* ------------------------------------------------------------------ */
/* Boxes                                                               */
/* ------------------------------------------------------------------ */

const emptyBox = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const isEmpty = (b) => b.min[0] > b.max[0];

function expand(box, p) {
  for (let i = 0; i < 3; i++) {
    if (p[i] < box.min[i]) box.min[i] = p[i];
    if (p[i] > box.max[i]) box.max[i] = p[i];
  }
}

function union(into, other) {
  if (isEmpty(other)) return into;
  expand(into, other.min);
  expand(into, other.max);
  return into;
}

/** Transform a box by taking its 8 corners. Conservative but exact for axis-aligned rotations. */
function transformBox(box, m) {
  const out = emptyBox();
  if (isEmpty(box)) return out;
  for (let i = 0; i < 8; i++) {
    expand(out, applyPoint(m, [
      i & 1 ? box.max[0] : box.min[0],
      i & 2 ? box.max[1] : box.min[1],
      i & 4 ? box.max[2] : box.min[2],
    ]));
  }
  return out;
}

const mm = (v) => Math.round(v * 1000);
const boxMm = (b) => ({ min: b.min.map(mm), max: b.max.map(mm) });
const sizeMm = (b) => [0, 1, 2].map((i) => mm(b.max[i] - b.min[i]));
const centreMm = (b) => [0, 1, 2].map((i) => mm((b.max[i] + b.min[i]) / 2));

/* ------------------------------------------------------------------ */
/* Walk                                                                */
/* ------------------------------------------------------------------ */

/** Anonymous wrappers the exporters insert; never useful as an identity. */
const ANONYMOUS = /^(Object_\d+|GLTF_SceneRootNode|RootNode|root|Sketchfab_model|Armature[_.]?\d*|.*\.fbx)$/;

/** The deepest ancestor name that actually identifies a part, else the leaf. */
function namedAncestor(trail) {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (!ANONYMOUS.test(trail[i])) return trail[i];
  }
  return trail[trail.length - 1] ?? '(unnamed)';
}

/**
 * Every mesh primitive in the scene, with its world matrix and its local-space
 * bounding box read from the POSITION accessor's min/max (glTF requires them).
 */
function collectPrimitives(doc) {
  const out = [];
  const walk = (node, parent, ancestry) => {
    const world = multiply(parent, localMatrix(node));
    const name = node.getName();
    const trail = name ? [...ancestry, name] : ancestry;
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION');
        if (!position) continue;
        const box = emptyBox();
        expand(box, position.getMin([0, 0, 0]));
        expand(box, position.getMax([0, 0, 0]));
        out.push({
          // The mesh-holding node is usually an anonymous `Object_N`; the name a
          // hide-list needs (`Hood 6.001_120`) is on its parent. Report the
          // nearest ancestor that says something, and keep the raw name too.
          name: namedAncestor(trail),
          leaf: name,
          material: prim.getMaterial()?.getName() ?? '',
          world,
          local: box,
          vertices: position.getCount(),
        });
      }
    }
    for (const child of node.listChildren()) walk(child, world, trail);
  };
  for (const scene of doc.getRoot().listScenes()) {
    for (const node of scene.listChildren()) walk(node, IDENTITY, []);
  }
  return out;
}

/* ------------------------------------------------------------------ */

async function measure(genId, options) {
  const generation = carData.generations.find((g) => g.id === genId);
  if (!generation?.assetUrl) throw new Error(`${genId}: no assetUrl in carData.json`);

  const path = resolve(ROOT, 'public', generation.assetUrl);
  const doc = await new NodeIO().read(path);
  const table = surfaceClasses.models[generation.surfaceModel ?? genId] ?? { materials: {} };
  const classOf = (name) => table.materials[normalise(name)];

  const primitives = collectPrimitives(doc);

  // --- Replay CarModel.frame() -------------------------------------
  // 1. yaw so the nose points +Z
  let frame = yawMatrix(generation.modelYawDeg ?? 0);
  let bounds = primitives.reduce(
    (acc, p) => union(acc, transformBox(p.local, multiply(frame, p.world))),
    emptyBox(),
  );

  // 2. uniform scale so the longest horizontal axis is the catalogue length
  const measured = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
  const scale = generation.dimensions.length / measured;
  frame = multiply(scaleMatrix(scale), frame);
  bounds = primitives.reduce(
    (acc, p) => union(acc, transformBox(p.local, multiply(frame, p.world))),
    emptyBox(),
  );

  // 3. centre on X/Z, stand on Y=0
  const offset = [
    -(bounds.min[0] + bounds.max[0]) / 2,
    -bounds.min[1],
    -(bounds.min[2] + bounds.max[2]) / 2,
  ];
  frame = multiply(translateMatrix(...offset), frame);

  const worldBox = (p) => transformBox(p.local, multiply(frame, p.world));
  bounds = primitives.reduce((acc, p) => union(acc, worldBox(p)), emptyBox());

  // --- Wheels, found the way CarModel finds them --------------------
  const quadrants = new Map();
  const body = emptyBox();
  const unclassified = new Map();

  for (const prim of primitives) {
    const box = worldBox(prim);
    const cls = classOf(prim.material);
    if (!cls) unclassified.set(prim.material, (unclassified.get(prim.material) ?? 0) + 1);
    if (cls && WHEEL_CLASSES.has(cls)) {
      const cx = (box.min[0] + box.max[0]) / 2;
      const cz = (box.min[2] + box.max[2]) / 2;
      const key = `${cx > 0 ? 'L' : 'R'}${cz > 0 ? 'F' : 'R'}`;
      if (!quadrants.has(key)) quadrants.set(key, emptyBox());
      union(quadrants.get(key), box);
    } else {
      union(body, box);
    }
  }

  const wheels = [...quadrants.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, box]) => ({
      corner: key,
      /** Contact patch — where CarModel puts the pivot, and where a wheel mod's origin goes. */
      contactPatch: [centreMm(box)[0], mm(box.min[1]), centreMm(box)[2]],
      hubCentre: centreMm(box),
      /** Outer tyre diameter as modelled, before any diameter scaling. */
      diameter: sizeMm(box)[1],
      width: sizeMm(box)[0],
      bbox: boxMm(box),
    }));

  const front = wheels.filter((w) => w.corner[1] === 'F');
  const rear = wheels.filter((w) => w.corner[1] === 'R');
  const avg = (list, f) => (list.length ? Math.round(list.reduce((s, w) => s + f(w), 0) / list.length) : null);

  const derived = {
    frontAxleZ: avg(front, (w) => w.contactPatch[2]),
    rearAxleZ: avg(rear, (w) => w.contactPatch[2]),
    hubHeight: avg(wheels, (w) => w.hubCentre[1]),
    trackFront: front.length === 2 ? Math.abs(front[0].contactPatch[0] - front[1].contactPatch[0]) : null,
    trackRear: rear.length === 2 ? Math.abs(rear[0].contactPatch[0] - rear[1].contactPatch[0]) : null,
    noseZ: mm(bounds.max[2]),
    tailZ: mm(bounds.min[2]),
    bodyFloorY: mm(body.min[1]),
    roofY: mm(bounds.max[1]),
  };
  derived.wheelbase =
    derived.frontAxleZ !== null && derived.rearAxleZ !== null
      ? derived.frontAxleZ - derived.rearAxleZ
      : null;

  // --- Per-node boxes, largest first --------------------------------
  const nodes = new Map();
  for (const prim of primitives) {
    if (!nodes.has(prim.name)) nodes.set(prim.name, { box: emptyBox(), vertices: 0, materials: new Set() });
    const entry = nodes.get(prim.name);
    union(entry.box, worldBox(prim));
    entry.vertices += prim.vertices;
    entry.materials.add(prim.material);
  }

  const nodeList = [...nodes.entries()]
    .map(([name, e]) => ({
      name,
      vertices: e.vertices,
      materials: [...e.materials],
      classes: [...new Set([...e.materials].map(classOf).filter(Boolean))],
      bbox: boxMm(e.box),
      size: sizeMm(e.box),
      centre: centreMm(e.box),
    }))
    .sort((a, b) => b.vertices - a.vertices);

  return {
    generation: genId,
    asset: generation.assetUrl,
    frame: {
      yawDeg: generation.modelYawDeg ?? 0,
      scale: Number(scale.toFixed(6)),
      offsetMm: offset.map(mm),
      $comment: 'Applied by CarModel.frame() to the model root, in this order: yaw, scale, translate.',
    },
    bbox: boxMm(bounds),
    size: sizeMm(bounds),
    catalogueDimensionsMm: {
      length: mm(generation.dimensions.length),
      width: mm(generation.dimensions.width),
      height: mm(generation.dimensions.height),
      wheelbase: mm(generation.dimensions.wheelbase),
      trackFront: mm(generation.dimensions.trackFront),
      trackRear: mm(generation.dimensions.trackRear),
    },
    wheels,
    derived,
    unclassifiedMaterials: [...unclassified.keys()].sort(),
    nodes: options.nodes ? nodeList : nodeList.slice(0, 20),
  };
}

/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outPath = outFlag >= 0 ? args[outFlag + 1] : null;
const options = {
  json: args.includes('--json'),
  // --out implies the full node list: the Blender side needs every name it
  // might have to hide, not just the twenty biggest.
  nodes: args.includes('--nodes') || Boolean(outPath),
};
const wanted = args.filter((a, i) => !a.startsWith('--') && i !== outFlag + 1);
const targets = wanted.length
  ? wanted
  : carData.generations.filter((g) => g.available && g.assetUrl).map((g) => g.id);

const results = [];
for (const id of targets) results.push(await measure(id, options));

if (outPath) {
  // The Blender side reads this to place its reference car and its anchors, so
  // both ends of the pipeline agree on where the car is by construction.
  const payload = { $generated: 'node scripts/measure-asset.mjs --out', generations: {} };
  for (const r of results) payload.generations[r.generation] = r;
  writeFileSync(resolve(ROOT, outPath), `${JSON.stringify(payload, null, 2)}\n`);
  console.error(`measure-asset: wrote ${outPath} (${results.map((r) => r.generation).join(', ')})`);
} else if (options.json) {
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
} else {
  for (const r of results) {
    console.log(`\n=== ${r.generation.toUpperCase()} — ${r.asset}`);
    console.log(`frame:  yaw ${r.frame.yawDeg}°  scale ${r.frame.scale}  offset ${r.frame.offsetMm.join(', ')} mm`);
    console.log(`bbox:   ${JSON.stringify(r.bbox.min)} .. ${JSON.stringify(r.bbox.max)}  (${r.size.join(' x ')} mm)`);
    console.log(`spec:   ${r.catalogueDimensionsMm.length} x ${r.catalogueDimensionsMm.width} x ${r.catalogueDimensionsMm.height} mm, wheelbase ${r.catalogueDimensionsMm.wheelbase}`);
    console.log('derived:');
    for (const [k, v] of Object.entries(r.derived)) console.log(`  ${k.padEnd(12)} ${v}`);
    console.log('wheels (contact patch = where CarModel puts the pivot):');
    for (const w of r.wheels) {
      console.log(`  ${w.corner}  patch ${JSON.stringify(w.contactPatch)}  hub ${JSON.stringify(w.hubCentre)}  ⌀${w.diameter} w${w.width}`);
    }
    if (r.unclassifiedMaterials.length) {
      console.log(`unclassified materials (${r.unclassifiedMaterials.length}): ${r.unclassifiedMaterials.slice(0, 12).join(', ')}${r.unclassifiedMaterials.length > 12 ? ' …' : ''}`);
    }
    console.log(`largest nodes (${options.nodes ? 'all' : 'top 20'}):`);
    for (const n of r.nodes) {
      console.log(`  ${n.name.padEnd(34)} ${String(n.vertices).padStart(7)}v  ${n.size.join('x').padEnd(18)} @ ${n.centre.join(',')}  [${n.classes.join(',')}]`);
    }
  }
}

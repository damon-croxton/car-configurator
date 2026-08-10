#!/usr/bin/env node
/**
 * Validate an exported mod .glb against its `modsData.json` entry.
 *
 * This is the machine-checkable half of the per-mod checklist in
 * `mx5-mod-modelling-brief.md` §9. It exists so the build loop does not need a
 * human between every mod: everything here is a hard pass/fail, and what it
 * cannot see (flipped normals, a 4mm gap under a lip, whether the thing looks
 * like a wheel) is listed at the end of the run so it stays visible rather than
 * being quietly assumed.
 *
 *   node scripts/validate-mod.mjs            # every mod in the catalogue
 *   node scripts/validate-mod.mjs RA02       # one mod, all its generations
 *   node scripts/validate-mod.mjs RA02 nd    # one mod, one generation
 *
 * Exit code is the number of failures, so it can gate a commit.
 */
import { NodeIO } from '@gltf-transform/core';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const modsData = read('src/data/modsData.json');
const surfaceClasses = read('src/data/surfaceClasses.json');

const ANCHORS_PATH = 'blender/anchors.json';
if (!existsSync(resolve(ROOT, ANCHORS_PATH))) {
  console.error(`No ${ANCHORS_PATH}. Run: node scripts/measure-asset.mjs --out ${ANCHORS_PATH}`);
  process.exit(1);
}
const anchors = read(ANCHORS_PATH);

/** The §3 material contract. A mod may use these names and no others. */
const MATERIAL_CONTRACT = [
  'MOD_BodyPaint', 'MOD_AccentPaint', 'MOD_Rim', 'MOD_Tyre', 'MOD_CaliperPaint',
  'MOD_CarbonWeave', 'MOD_GlossBlack', 'MOD_SatinBlack', 'MOD_Rubber', 'MOD_Alloy',
  'MOD_Chrome', 'MOD_Titanium', 'MOD_Glass', 'MOD_MirrorGlass', 'MOD_Mesh',
];

const MAX_BYTES = 2 * 1024 * 1024;
const BUDGET_TOLERANCE = 1.2;
const BBOX_TOLERANCE = 0.05;

/** Names that mean somebody forgot to name something. */
const LAZY_NAME = /(^|[^A-Za-z])(Cube|Sphere|Cylinder|Plane|Circle|Cone|Torus|Icosphere|Suzanne|Empty|Material)(\.\d+)?$/;
const DUPLICATE_SUFFIX = /\.\d{3}$/;

/* ------------------------------------------------------------------ */

const normalise = (name) => name.replace(/\.\d{3}$/, '');

/** Every surface class any of the tables knows, plus the shared `mods` table. */
function knownClasses() {
  const out = new Map();
  for (const table of Object.values(surfaceClasses.models ?? {})) {
    for (const [material, cls] of Object.entries(table.materials ?? {})) out.set(material, cls);
  }
  for (const [material, cls] of Object.entries(surfaceClasses.mods?.materials ?? {})) {
    out.set(material, cls);
  }
  return out;
}

const CLASSES = knownClasses();

/* --- geometry ----------------------------------------------------- */

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

const emptyBox = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const isEmpty = (b) => b.min[0] > b.max[0];

function expand(box, p) {
  for (let i = 0; i < 3; i++) {
    if (p[i] < box.min[i]) box.min[i] = p[i];
    if (p[i] > box.max[i]) box.max[i] = p[i];
  }
}

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

/** Gap between two boxes per axis; 0 where they overlap. */
function boxGap(a, b) {
  return [0, 1, 2].map((i) => Math.max(0, a.min[i] - b.max[i], b.min[i] - a.max[i]));
}

const mm = (v) => Math.round(v * 1000);

/* ------------------------------------------------------------------ */

async function inspect(path) {
  const doc = await new NodeIO().read(path);
  const root = doc.getRoot();

  const parts = [];
  const rootNodeTransforms = [];
  const box = emptyBox();
  let triangles = 0;
  let missingUv = 0;
  let missingNormal = 0;

  const walk = (node, parent, depth) => {
    const local = localMatrix(node);
    const world = multiply(parent, local);
    if (depth === 0) rootNodeTransforms.push({ name: node.getName(), local });

    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION');
        if (!position) continue;
        const local3 = emptyBox();
        expand(local3, position.getMin([0, 0, 0]));
        expand(local3, position.getMax([0, 0, 0]));
        const worldBox = transformBox(local3, world);
        expand(box, worldBox.min);
        expand(box, worldBox.max);

        const indices = prim.getIndices();
        triangles += Math.floor((indices ? indices.getCount() : position.getCount()) / 3);
        if (!prim.getAttribute('TEXCOORD_0')) missingUv++;
        if (!prim.getAttribute('NORMAL')) missingNormal++;

        parts.push({
          node: node.getName(),
          mesh: mesh.getName(),
          material: prim.getMaterial()?.getName() ?? '',
        });
      }
    }
    for (const child of node.listChildren()) walk(child, world, depth + 1);
  };

  for (const scene of root.listScenes()) {
    for (const node of scene.listChildren()) walk(node, IDENTITY, 0);
  }

  return {
    parts,
    rootNodeTransforms,
    box,
    triangles,
    missingUv,
    missingNormal,
    materials: root.listMaterials().map((m) => m.getName()),
    nodeNames: root.listNodes().map((n) => n.getName()).filter(Boolean),
    meshNames: root.listMeshes().map((m) => m.getName()).filter(Boolean),
  };
}

/* ------------------------------------------------------------------ */

async function validate(mod, gen) {
  const label = `${mod.id}/${gen}`;
  const failures = [];
  const notes = [];
  const fail = (msg) => failures.push(msg);

  const rel = mod.file?.[gen];
  if (!rel) return { label, failures: [`no file declared for ${gen}`], notes };

  const path = resolve(ROOT, 'public', rel);
  if (!existsSync(path)) return { label, failures: [`missing: ${rel}`], notes };

  const bytes = statSync(path).size;
  if (bytes > MAX_BYTES) fail(`${(bytes / 1048576).toFixed(2)} MB exceeds the 2 MB budget`);

  let glb;
  try {
    glb = await inspect(path);
  } catch (error) {
    return { label, failures: [`will not open: ${error.message}`], notes };
  }

  // --- naming ------------------------------------------------------
  const expected = new RegExp(`^MOD_${gen.toUpperCase()}_${mod.id}_[A-Za-z0-9_]+$`);
  for (const name of [...new Set([...glb.nodeNames, ...glb.meshNames])]) {
    if (LAZY_NAME.test(name)) fail(`unnamed primitive left in: "${name}"`);
    else if (DUPLICATE_SUFFIX.test(name)) fail(`duplicate-suffix name: "${name}"`);
    else if (!expected.test(name)) fail(`name off-contract: "${name}" (want MOD_${gen.toUpperCase()}_${mod.id}_<part>)`);
  }

  // --- materials ---------------------------------------------------
  for (const name of glb.materials) {
    const base = normalise(name);
    if (!MATERIAL_CONTRACT.includes(base)) {
      fail(`material "${name}" is not in the §3 contract`);
    } else if (!CLASSES.has(base)) {
      fail(`material "${base}" has no surfaceClasses.json entry — the app will never touch it`);
    }
  }
  const declared = new Set(mod.materials ?? []);
  for (const name of new Set(glb.materials.map(normalise))) {
    if (!declared.has(name)) fail(`material "${name}" is in the .glb but not in modsData.json`);
  }

  // --- geometry hygiene --------------------------------------------
  if (glb.missingUv) fail(`${glb.missingUv} primitive(s) have no UV map`);
  if (glb.missingNormal) fail(`${glb.missingNormal} primitive(s) have no normals`);
  if (glb.parts.length === 0) fail('no geometry at all');

  for (const { name, local } of glb.rootNodeTransforms) {
    const off = local.some((v, i) => Math.abs(v - IDENTITY[i]) > 1e-4);
    if (off) fail(`root node "${name}" has an unapplied transform — apply it before export`);
  }

  // --- budget ------------------------------------------------------
  const budget = mod.triangleBudget ?? Infinity;
  if (glb.triangles > budget * BUDGET_TOLERANCE) {
    fail(`${glb.triangles} tris exceeds budget ${budget} +${Math.round((BUDGET_TOLERANCE - 1) * 100)}%`);
  }

  // --- bounding box ------------------------------------------------
  const actual = { min: glb.box.min.map(mm), max: glb.box.max.map(mm) };
  const want = mod.bboxMm?.[gen];
  if (!want) {
    notes.push(`no declared bboxMm for ${gen} — measured ${JSON.stringify(actual)}`);
  } else {
    for (const edge of ['min', 'max']) {
      for (let i = 0; i < 3; i++) {
        const span = Math.max(1, want.max[i] - want.min[i]);
        if (Math.abs(actual[edge][i] - want[edge][i]) > span * BBOX_TOLERANCE) {
          fail(`bbox.${edge}[${'xyz'[i]}] is ${actual[edge][i]} mm, declared ${want[edge][i]} mm`);
        }
      }
    }
  }

  // --- anchors: the "nothing floats" check -------------------------
  const tolerance = (modsData.anchorToleranceMm ?? 25) / 1000;
  const table = anchors.generations?.[gen];
  for (const anchorName of mod.anchors?.[gen] ?? []) {
    const node = table?.nodes?.find((n) => n.name === anchorName);
    if (!node) {
      fail(`anchor "${anchorName}" is not a node in the ${gen} asset — check blender/anchors.json`);
      continue;
    }
    const anchorBox = {
      min: node.bbox.min.map((v) => v / 1000),
      max: node.bbox.max.map((v) => v / 1000),
    };
    const gap = boxGap(glb.box, anchorBox);
    const worst = Math.max(...gap);
    if (worst > tolerance) {
      fail(
        `floats: ${Math.round(worst * 1000)} mm clear of anchor "${anchorName}" ` +
        `(gap x/y/z = ${gap.map((g) => Math.round(g * 1000)).join('/')} mm, tolerance ${Math.round(tolerance * 1000)})`,
      );
    }
  }

  // --- hides exist -------------------------------------------------
  for (const nodeName of mod.hides?.[gen] ?? []) {
    if (!table?.nodes?.some((n) => n.name === nodeName)) {
      fail(`hides "${nodeName}", which is not a node in the ${gen} asset`);
    }
  }

  // --- shipping preconditions --------------------------------------
  if (mod.slot === null) notes.push('slot is null — no CarConfig field yet, so this cannot ship (brief §7.1)');
  if (mod.derivedFromBaseMesh) notes.push('derivedFromBaseMesh — ATTRIBUTION.md must record the modification (brief §4)');

  notes.push(
    `${glb.triangles} tris, ${(bytes / 1024).toFixed(0)} kB, ` +
    `${glb.parts.length} primitives, materials: ${[...new Set(glb.materials)].join(', ') || 'none'}`,
  );

  return { label, failures, notes };
}

/* ------------------------------------------------------------------ */

const [wantedId, wantedGen] = process.argv.slice(2);
const selected = modsData.mods.filter((m) => !wantedId || m.id === wantedId);

if (selected.length === 0) {
  console.error(`No mod "${wantedId}" in src/data/modsData.json`);
  process.exit(1);
}

let failed = 0;
for (const mod of selected) {
  for (const gen of mod.gen.filter((g) => !wantedGen || g === wantedGen)) {
    const { label, failures, notes } = await validate(mod, gen);
    if (failures.length === 0) {
      console.log(`PASS  ${label}`);
    } else {
      failed += failures.length;
      console.log(`FAIL  ${label}`);
      for (const f of failures) console.log(`        ✗ ${f}`);
    }
    for (const n of notes) console.log(`        · ${n}`);
  }
}

console.log(
  `\nStill needs a human eye: loose verts / non-manifold edges / flipped normals (stats() in Blender),` +
  `\n0.5-1 mm proud vs coplanar vs gapped (wireframe side view against the reference car),` +
  `\nand silhouette and proportion (3 viewport renders + 1 screenshot from the running app).`,
);

process.exit(Math.min(failed, 250));

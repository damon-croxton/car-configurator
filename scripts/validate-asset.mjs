#!/usr/bin/env node
/**
 * Acceptance gate for authored car assets.
 *
 * `CarModel` composes an authored GLB on top of the procedural car by matching
 * node names, so "does this asset satisfy the contract?" is the only question
 * that matters before wiring one in. This answers it without a browser.
 *
 *   node scripts/validate-asset.mjs public/assets/models/mx5_nd.glb
 *
 * Exits non-zero if the asset supplies nothing adoptable, or if its bounds are
 * wildly off — both mean the Blender conform step needs another pass.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';

/* Kept in sync with src/three/nodeNames.ts. Duplicated rather than imported
   because this runs in plain Node against a .ts source tree. */
const REQUIRED = ['Body_Main'];
const ADOPTABLE = [
  'Body_Main',
  'Body_Trim',
  'Glass_Windshield',
  'Glass_Windows',
  'Interior_Main',
  'Interior_Seats',
  'Interior_SteeringWheel',
  'Lights_Head',
  'Lights_HeadHousing',
  'Lights_DRL',
  'Lights_Tail',
  'Lights_Indicator',
  'Roof_ST_Up',
  'Roof_ST_Down',
  'Roof_RF_Up',
  'Roof_RF_Down',
  'Wheel_FL',
  'Wheel_FR',
  'Wheel_RL',
  'Wheel_RR',
];
const WHEEL_CHILDREN = ['Rim', 'Tire', 'Brake_Caliper', 'Brake_Disc'];

/** ND reference dimensions in metres, from carData.json. */
const EXPECTED = { length: 3.915, width: 1.735, height: 1.23, tolerance: 0.25 };

const path = process.argv[2] ?? 'public/assets/models/mx5_nd.glb';
const absolute = resolve(process.cwd(), path);

let document;
try {
  document = await new NodeIO().readBinary(new Uint8Array(await readFile(absolute)));
} catch (error) {
  console.error(`Cannot read ${path}: ${error.message}`);
  console.error('Nothing to validate — the app will run on the procedural fallback.');
  process.exit(1);
}

const root = document.getRoot();
const nodes = root.listNodes();
const byName = new Map(nodes.map((node) => [node.getName(), node]));

/* -------------------------------------------------------------- */
/* Contract coverage                                               */
/* -------------------------------------------------------------- */

const present = ADOPTABLE.filter((name) => byName.has(name));
const missing = ADOPTABLE.filter((name) => !byName.has(name));
const missingRequired = REQUIRED.filter((name) => !byName.has(name));

console.log(`\n${path}\n${'='.repeat(path.length)}`);
console.log(`\nContract coverage — ${present.length}/${ADOPTABLE.length} adoptable nodes\n`);
for (const name of ADOPTABLE) {
  console.log(`  ${byName.has(name) ? '✓' : '·'} ${name}`);
}
if (missing.length) {
  console.log(`\n  ${missing.length} absent — those keep their procedural counterpart.`);
}

/* Wheels need their inner structure or finish swapping cannot work. */
const wheelNames = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'].filter((n) => byName.has(n));
if (wheelNames.length) {
  console.log('\nWheel structure');
  for (const name of wheelNames) {
    const children = byName.get(name).listChildren().map((c) => c.getName());
    const found = WHEEL_CHILDREN.filter((c) => children.includes(c));
    console.log(`  ${name}: ${found.length ? found.join(', ') : '(no named children — finishes will not apply)'}`);
  }
}

/* -------------------------------------------------------------- */
/* Budget                                                          */
/* -------------------------------------------------------------- */

let triangles = 0;
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const indices = primitive.getIndices();
    const position = primitive.getAttribute('POSITION');
    triangles += Math.floor((indices ? indices.getCount() : (position?.getCount() ?? 0)) / 3);
  }
}

const textures = root.listTextures();
console.log('\nBudget');
console.log(`  triangles  ${triangles.toLocaleString()}`);
console.log(`  meshes     ${root.listMeshes().length}`);
console.log(`  materials  ${root.listMaterials().length}`);
console.log(`  textures   ${textures.length}`);
for (const texture of textures) {
  const size = texture.getSize();
  console.log(`    · ${texture.getName() || '(unnamed)'} ${size ? `${size[0]}×${size[1]}` : '?'} ${texture.getMimeType()}`);
}

/* -------------------------------------------------------------- */
/* Bounds — the conform step's real output check                   */
/* -------------------------------------------------------------- */

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION');
    if (!position) continue;
    const pMin = position.getMin([0, 0, 0]);
    const pMax = position.getMax([0, 0, 0]);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], pMin[axis]);
      max[axis] = Math.max(max[axis], pMax[axis]);
    }
  }
}

// Note: these are mesh-local extents. Node transforms are not composed here, so
// treat a mismatch as "look at it in Blender", not as proof of a bug.
const size = { width: max[0] - min[0], height: max[1] - min[1], length: max[2] - min[2] };
const off = (actual, expected) => Math.abs(actual - expected) > EXPECTED.tolerance;

console.log('\nBounds (mesh-local, metres)');
console.log(`  width  X  ${size.width.toFixed(3)}  expected ~${EXPECTED.width}${off(size.width, EXPECTED.width) ? '  ← off' : ''}`);
console.log(`  height Y  ${size.height.toFixed(3)}  expected ~${EXPECTED.height}${off(size.height, EXPECTED.height) ? '  ← off' : ''}`);
console.log(`  length Z  ${size.length.toFixed(3)}  expected ~${EXPECTED.length}${off(size.length, EXPECTED.length) ? '  ← off' : ''}`);
console.log(`  ground Y  ${min[1].toFixed(3)}  expected ~0 (tyres on the floor)${Math.abs(min[1]) > 0.1 ? '  ← off' : ''}`);

/* -------------------------------------------------------------- */

const problems = [];
if (missingRequired.length) problems.push(`missing required node(s): ${missingRequired.join(', ')}`);
if (present.length === 0) problems.push('no adoptable nodes — nothing would be composed in');
if (off(size.length, EXPECTED.length)) problems.push('length is outside tolerance; re-run the conform step');

if (problems.length) {
  console.log(`\nFAIL\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}

console.log(`\nPASS — ${present.length} node(s) would be adopted, ${missing.length} stay procedural.\n`);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { build } from 'esbuild';

// Load the actual source geometry and production CarModel. Only texture/network
// IO is replaced: topology, node transforms, attributes and roof logic are real.
const { outputFiles } = await build({
  stdin: { contents: `export { CarModel } from './src/three/carModel';
    export { islandKey } from './src/three/islands';
    export * as THREE from 'three';
    export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { CarModel, islandKey, THREE, GLTFLoader } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`
);
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
GLTFLoader.prototype.loadAsync = async function (url) {
  const file = resolve('public', url);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.materials = json.materials.map(m => ({ name: m.name }));
  json.images = []; json.textures = [];
  for (const b of json.buffers) {
    b.uri = `data:application/octet-stream;base64,${readFileSync(resolve(dirname(file), b.uri)).toString('base64')}`;
  }
  return this.parseAsync(JSON.stringify(json), '');
};
const catalogue = JSON.parse(readFileSync('src/data/carData.json', 'utf8'));
const spec = id => {
  const g = catalogue.generations.find(g => g.id === id);
  return { id, url: g.assetUrl, length: g.dimensions.length,
    nativeWheelInches: g.defaultWheelDiameter, surfaceModel: g.surfaceModel, yawDeg: g.modelYawDeg };
};
const car = new CarModel(new THREE.LoadingManager());
await car.load(spec('nd'));
car.group.updateMatrixWorld(true);
const rules = car.table.roofLining;
const count = g => (g.index?.count ?? g.getAttribute('position').count) / 3;
const triangle = (g, offset) => Object.keys(g.attributes).sort().flatMap(name => {
  const attr = g.getAttribute(name);
  return [name, ...[0,1,2].flatMap(k => {
    const v = g.index ? g.index.getX(offset+k) : offset+k;
    return Array.from({length:attr.itemSize}, (_,c) => attr.getComponent(v,c));
  })];
});
const signature = (g, offset) => JSON.stringify(triangle(g, offset));
const fixedFaces = [];
let splitFaces = 0, preservedFaces = 0, totalLining = 0;
const foundKeys = new Set();

for (const entry of car.cabin) {
  const hidden = new Set();
  for (let i = 0; i < entry.islands.length; i++) {
    const island = entry.islands[i], key = islandKey(island);
    const partial = rules.splitWithRoof.find(rule => rule.key === key);
    if (rules.hideWithRoof.includes(key)) {
      assert.ok(!foundKeys.has(key), `Ambiguous whole-island key ${key}`);
      foundKeys.add(key);
      island.triangles.forEach(offset => hidden.add(offset));
      assert.equal(entry.candidate[i], true, 'Nominated tiny fragments must appear in the debug view');
    }
    if (!partial) continue;
    assert.ok(!rules.hideWithRoof.includes(key), 'Shared pillar islands must not be hidden whole');
    assert.ok(!foundKeys.has(key), `Ambiguous shared-island key ${key}`);
    foundKeys.add(key);
    assert.equal(entry.candidate[i], true);
    assert.ok(partial.triangleOffsets.length > 0 && partial.triangleOffsets.length < island.triangleCount);
    for (const offset of partial.triangleOffsets) {
      assert.ok(island.triangles.includes(offset), `Roof face ${offset} drifted out of ${key}`);
      const pos = entry.original.getAttribute('position');
      for (let k = 0; k < 3; k++) {
        const v = entry.original.index.getX(offset+k);
        const point = new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(entry.mesh.matrixWorld);
        assert.ok(point.y > 1.12, 'A lower A-pillar vertex was selected for removal');
      }
      hidden.add(offset); splitFaces++;
    }
    for (const offset of island.triangles) {
      if (!partial.triangleOffsets.includes(offset)) {
        fixedFaces.push(signature(entry.original, offset)); preservedFaces++;
      }
    }
  }
  if (!hidden.size) {
    assert.equal(entry.mesh.geometry, entry.original, 'Unrelated cabin meshes must not change');
    continue;
  }
  const lining = car.liningMeshes.find(m => m.parent === entry.mesh);
  assert.ok(lining);
  assert.equal(lining.material, entry.mesh.material, 'Roof up must use the same textured material');
  assert.equal(count(entry.mesh.geometry) + count(lining.geometry), count(entry.original));
  assert.equal(count(lining.geometry), hidden.size);
  assert.ok(entry.original.hasAttribute('uv'), 'Exercise real texture coordinates');
  let keepIndex = 0, hideIndex = 0;
  for (let t = 0; t < count(entry.original); t++) {
    const removed = hidden.has(t*3);
    const geometry = removed ? lining.geometry : entry.mesh.geometry;
    const offset = (removed ? hideIndex++ : keepIndex++) * 3;
    // Exact equality preserves winding, normals, UVs and every source vertex.
    assert.deepEqual(triangle(geometry, offset), triangle(entry.original, t*3));
  }
  totalLining += hidden.size;
}
assert.equal(foundKeys.size, rules.hideWithRoof.length + rules.splitWithRoof.length, 'Every roof rule must resolve against the source asset');
assert.equal(splitFaces, 15);
assert.equal(preservedFaces, 125, 'Preserve the fixed faces in all four shared islands');
console.log(`PASS source topology: ${splitFaces} shared roof faces split; ${preservedFaces} shared header/pillar faces preserved; ${totalLining} lining faces total`);

const kept = new Set(car.cabin.flatMap(entry => Array.from({length:count(entry.mesh.geometry)}, (_,i) => signature(entry.mesh.geometry, i*3))));
for (const face of fixedFaces) assert.ok(kept.has(face), 'Fixed pillar/header face missing');
// The original bug left a broad upper sheet here. Check the actual remaining
// interior vertices, independently of the catalogue's face selection.
for (const entry of car.cabin) {
  const pos = entry.mesh.geometry.getAttribute('position');
  for (let v = 0; v < pos.count; v++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(entry.mesh.matrixWorld);
    assert.ok(!(p.y > 1.175 && p.z < -0.24), `Roof fragment remains at ${p.toArray()}`);
  }
}
console.log('PASS no upper lining fragments remain over the open cabin');

// The passenger-side remnant sits below the upper-sheet check. Inspect the
// actual front roof-rail region on BOTH sides, independently of island keys.
// One side was already part of a hidden rail; the other was split into two
// tiny source islands and was missed by the original debug size threshold.
const railEntry = car.cabin.find(entry => entry.mesh.name === 'Object_39');
assert.ok(railEntry, 'Expected the source ND interior mesh');
const railFaces = geometry => {
  const pos = geometry.getAttribute('position'), faces = [];
  for (let t = 0; t < count(geometry); t++) {
    const points = [0,1,2].map(k => {
      const v = geometry.index ? geometry.index.getX(t*3+k) : t*3+k;
      return new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(railEntry.mesh.matrixWorld);
    });
    if (points.every(p => p.y > 1.12 && Math.abs(p.x) > .48 && Math.abs(p.x) < .55
      && p.z > -.4 && p.z < -.2)) faces.push(points);
  }
  return faces;
};
const sourceRails = railFaces(railEntry.original);
assert.equal(sourceRails.length, 20, 'Exercise both front rail sections, including their undersides');
const shape = points => points.map(p => [Math.abs(p.x),p.y,p.z].map(n=>n.toFixed(5)).join(',')).sort().join(';');
assert.deepEqual(
  sourceRails.filter(p=>p[0].x>0).map(shape).sort(),
  sourceRails.filter(p=>p[0].x<0).map(shape).sort(),
  'The front roof rails must be symmetric',
);
assert.equal(railFaces(railEntry.mesh.geometry).length, 0, 'A front roof-rail fragment remains');
console.log('PASS both front rail sections clear; passenger-side sliver and end cap follow the roof');

const geometries = car.cabin.map(e => e.mesh.geometry);
for (const up of [false, true, false, true, false]) {
  car.setRoofUp(up);
  assert.equal(car.roofPart.visible, up);
  for (const mesh of car.liningMeshes) assert.equal(mesh.visible, up);
  car.cabin.forEach((e,i) => assert.equal(e.mesh.geometry, geometries[i], 'Roof toggle must not rebuild or damage trim'));
}
car.setStance({wheelDiameter:18, rideHeight:-35, camber:-1.5, trackOffset:5});
car.group.updateMatrixWorld(true);
for (const entry of car.cabin) {
  const lining = car.liningMeshes.find(m => m.parent === entry.mesh);
  if (lining) assert.deepEqual(lining.matrixWorld.elements, entry.mesh.matrixWorld.elements);
}
console.log('PASS repeated roof toggles and lowered stance preserve the split and attachment');

const disposed = [];
for (const entry of car.cabin) {
  if (entry.mesh.geometry === entry.original) continue;
  const event = {keep:0,original:0}; disposed.push(event);
  entry.mesh.geometry.addEventListener('dispose',()=>event.keep++);
  entry.original.addEventListener('dispose',()=>event.original++);
}
car.setRoofLining(rules.hideWithRoof, null);
for (const event of disposed) { assert.equal(event.keep,1); assert.equal(event.original,0); }
await car.load(spec('na'));
for (const event of disposed) assert.equal(event.original,1);
assert.equal(car.cabin.length,0, 'ND split must not affect the NA');
assert.equal(car.liningMeshes.length,0);
await car.load(spec('nd'));
assert.equal(car.roofPart.visible,false, 'Switching generations must restore roof-down state');
for (const mesh of car.liningMeshes) assert.equal(mesh.visible,false);
assert.equal(car.liningMeshes.reduce((n,m)=>n+count(m.geometry),0), totalLining);
car.dispose();
console.log('PASS rebuild disposal, generation switching and restoration of roof-down state');

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { build } from 'esbuild';
const { outputFiles } = await build({
  stdin: { contents: `export { CarModel } from './src/three/carModel';
    export { splitIntoIslands, islandKey } from './src/three/islands';
    export * as THREE from 'three';
    export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'error' });
const { CarModel, splitIntoIslands, islandKey, THREE, GLTFLoader } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
globalThis.ProgressEvent ??= class { constructor(t, i) { Object.assign(this, { type: t }, i); } };
GLTFLoader.prototype.loadAsync = async function (url) {
  const file = resolve('public', url); const json = JSON.parse(readFileSync(file, 'utf8'));
  json.materials = json.materials.map(m => ({ name: m.name })); json.images = []; json.textures = [];
  for (const b of json.buffers) b.uri = `data:application/octet-stream;base64,${readFileSync(resolve(dirname(file), b.uri)).toString('base64')}`;
  return this.parseAsync(JSON.stringify(json), '');
};
const gen = process.argv[2] ?? 'nd';
const cat = JSON.parse(readFileSync('src/data/carData.json','utf8')).generations.find(g=>g.id===gen);
const car = new CarModel(new THREE.LoadingManager());
await car.load({ id: gen, url: cat.assetUrl, length: cat.dimensions.length, yawDeg: cat.modelYawDeg ?? 0, surfaceModel: cat.surfaceModel, nativeWheelInches: cat.defaultWheelDiameter });
car.group.updateWorldMatrix(true, true);
const mm = v => v.toArray().map(n => Math.round(n * 1000));
const ray = new THREE.Raycaster();
const meshes = []; car.group.traverse(o => { if (o.isMesh && o.visible) meshes.push(o); });
for (const [x, y, z, dx, dy, dz] of [[300, 2000, -350, 0, -1, 0], [-300, 2000, -350, 0, -1, 0], [300, 2000, -550, 0, -1, 0],
  [300, 800, 2000, 0, 0, -1], [300, 950, 2000, 0, 0, -1], [-300, 800, 2000, 0, 0, -1], [300, 600, 2000, 0, 0, -1]]) {
  ray.set(new THREE.Vector3(x/1000, y/1000, z/1000), new THREE.Vector3(dx, dy, dz));
  const hits = ray.intersectObjects(meshes, false).slice(0, 4);
  console.log('RAY', [x,y,z].join(','), hits.map(h => `${h.object.name}${h.object.parent ? '<'+h.object.parent.name : ''} @${Math.round(h.point.y*1000)}/${Math.round(h.point.z*1000)} face${h.faceIndex}`).join(' | '));
}
const tub = car.cabin.find(e => e.mesh.name === 'Object_39');
const byTri = new Map(); tub.islands.forEach(i => i.triangles.forEach(o => byTri.set(o / 3, i)));
ray.set(new THREE.Vector3(0.3, 2, -0.35), new THREE.Vector3(0, -1, 0));
const g = tub.original; const tmp = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); tmp.matrixWorld.copy(tub.mesh.matrixWorld); tmp.matrixAutoUpdate = false;
for (const [x, y, z, dx, dy, dz] of [[300,2000,-350,0,-1,0],[-300,2000,-350,0,-1,0],[300,800,2000,0,0,-1],[300,950,2000,0,0,-1],[-300,800,2000,0,0,-1]]) {
  ray.set(new THREE.Vector3(x/1000, y/1000, z/1000), new THREE.Vector3(dx, dy, dz));
  const hits = ray.intersectObject(tmp, false).slice(0, 3);
  for (const h of hits) { const isl = byTri.get(h.faceIndex); const b = isl.box.clone().applyMatrix4(tub.mesh.matrixWorld);
    console.log('  TUB', [x,y,z].join(','), 'hit', Math.round(h.point.y*1000), Math.round(h.point.z*1000), 'island tris', isl.triangleCount, JSON.stringify(b.min.toArray().map(v=>Math.round(v*1000))), JSON.stringify(b.max.toArray().map(v=>Math.round(v*1000)))); }
}
process.exit(0);
for (const entry of car.cabin) {
  const o = entry.mesh;
  console.log('CABIN', o.name, 'islands', entry.islands.length);
  if (process.argv[3] !== 'detail' || !o.name.includes(process.argv[4] ?? '')) continue;
  const rows = entry.islands.map(i => { const b = i.box.clone().applyMatrix4(o.matrixWorld); return { tris: i.triangleCount, min: mm(b.min), max: mm(b.max), key: islandKey(i) }; })
    .sort((a, b) => b.tris - a.tris);
  const inSeat = r => r.min[2] > -760 && r.max[2] < 60 && r.min[1] > 200 && r.max[1] < 1080 && Math.abs((r.min[0]+r.max[0])/2) > 60;
  const pick = rows.filter(inSeat);
  console.log('  seat-region islands', pick.length, 'tris', pick.reduce((a,r)=>a+r.tris,0), 'of', rows.reduce((a,r)=>a+r.tris,0));
  for (const r of pick.slice(0, 45)) console.log('  ', String(r.tris).padStart(5), JSON.stringify(r.min), JSON.stringify(r.max), r.key);
}

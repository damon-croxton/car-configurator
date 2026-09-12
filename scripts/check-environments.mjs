import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the real async lifecycle without requiring a GPU or exposing any
// testing hooks in the app. Only the network and PMREM generation are faked.
const { outputFiles } = await build({
  stdin: { contents: `export { EnvironmentManager } from './src/three/environmentManager';
    export { Scene, Texture, SRGBColorSpace } from 'three';
    export { materialsData } from './src/data/schema';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { EnvironmentManager, Scene, Texture, SRGBColorSpace, materialsData } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`
);
function assets(usingHdri = true) {
  const background = new Texture();
  background.colorSpace = SRGBColorSpace;
  const result = { target: { texture: new Texture(), dispose() { result.targetDisposed++; } },
    background, usingHdri, targetDisposed: 0, backgroundDisposed: 0 };
  background.addEventListener('dispose', () => result.backgroundDisposed++);
  return result;
}
function manager() {
  const m = Object.create(EnvironmentManager.prototype);
  Object.assign(m, { scene: new Scene(), token: 0, current: null, pendingId: null,
    pendingLoad: null, panorama: null, backgroundTexture: null, envTarget: null,
    grid: null, ground: null, lightRig: null, gridVisible: false,
    applyLights() {}, setShadowQuality() {}, pmrem: { dispose() {} } });
  return m;
}
const [studio, sunset, city] = materialsData.environments;
const m = manager(), pending = new Map();
m.buildEnvironmentTexture = def => new Promise(resolve => pending.set(def.id, resolve));
const a = m.apply(studio, .1), b = m.apply(sunset, .2);
const latest = assets(); pending.get(sunset.id)(latest); await b;
const stale = assets(); pending.get(studio.id)(stale); await a;
assert.equal(m.environmentId, sunset.id);
assert.equal(stale.targetDisposed, 1);
assert.equal(stale.backgroundDisposed, 1);
assert.equal(m.scene.environment, latest.target.texture);
assert.equal(m.panorama.material.map, latest.background);
assert.notEqual(m.panorama.material.map, m.scene.environment, 'Visible background must not be the blurred lighting map');
assert.equal(m.panorama.material.toneMapped, false);
assert.equal(m.scene.backgroundBlurriness, 0);
assert.equal(m.ground.visible, false);
m.setBackdropVisible(false); assert.equal(m.panorama.visible, false);
m.setBackdropVisible(true); assert.equal(m.panorama.visible, true);
assert.equal(m.ground.visible, false, 'Shadow bake must not restore the opaque floor');
assert.equal(m.grid.visible, false);

const c = m.apply(city, .3);
const cAgain = m.apply(city, .7);
await m.apply(sunset, .8); // Return to active scene while city is loading.
const cancelled = assets(); pending.get(city.id)(cancelled); await Promise.all([c,cAgain]);
assert.equal(m.environmentId, sunset.id);
assert.equal(cancelled.targetDisposed, 1);
assert.equal(m.reflection, .8);
const d = m.apply(city, .4), dAgain = m.apply(city, .9);
const newest = assets(false); pending.get(city.id)(newest); await Promise.all([d,dAgain]);
assert.equal(m.environmentId, city.id);
assert.equal(m.reflection, .9);
assert.equal(latest.targetDisposed, 1);
assert.equal(latest.backgroundDisposed, 1);
assert.equal(m.usingHdriEnvironment, false);
assert.ok(m.panorama, 'Photographic background remains available without the HDR lighting file');
const duringDisposal = m.apply(studio, 0);
m.dispose();
const disposedLoad = assets(); pending.get(studio.id)(disposedLoad); await duringDisposal;
assert.equal(disposedLoad.targetDisposed, 1);
assert.equal(disposedLoad.backgroundDisposed, 1);
assert.equal(newest.targetDisposed, 1);
assert.equal(newest.backgroundDisposed, 1);
assert.equal(m.scene.environment, null);

// Missing panorama keeps the original HDR, never the filtered PMREM texture.
const fallback = manager(), hdr = new Texture();
let hdrDisposed = 0; hdr.addEventListener('dispose', () => hdrDisposed++);
fallback.tryLoadHdri = async () => hdr;
fallback.tryLoadPanorama = async () => null;
const target = { texture: new Texture() };
fallback.pmrem = { fromEquirectangular: () => target };
const result = await fallback.buildEnvironmentTexture(studio);
assert.equal(result.background, hdr);
assert.equal(result.target, target);
assert.equal(hdrDisposed, 0);
console.log('PASS: sharp background, grounded floor, shadow bake, scene races, cancellation, HDR fallback and resource disposal');

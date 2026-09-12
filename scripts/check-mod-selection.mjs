import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the app's real selection code, including JSON catalogues, for Node.
const { outputFiles } = await build({
  stdin: { contents: `export { activeMods } from './src/data/mods';
    export { DEFAULT_CONFIG, reconcileConfig } from './src/config/defaults';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { activeMods, DEFAULT_CONFIG, reconcileConfig } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`
);
for (const [ids,winner] of [[['DT01','DT02'],'DT02'],[['DT02','DT01'],'DT01']]) {
  const config = reconcileConfig({ ...DEFAULT_CONFIG, extraMods: ['BP04',...ids] });
  assert.deepEqual(config.extraMods, ['BP04',winner]);
  assert.deepEqual(activeMods('nd',config).map((m) => m.id).sort(), ['BP04',winner].sort());
}
const wheels = activeMods('nd',{ ...DEFAULT_CONFIG, wheelStyle:'rays_te37', extraMods:['WS02'] });
assert.deepEqual(wheels.filter((m) => m.attachTo==='wheel').map((m) => m.id),['WS02']);
const forced = activeMods('nd',{ ...DEFAULT_CONFIG, extraMods:['DT01'] },['DT02']);
assert.deepEqual(forced.map((m) => m.id),['DT02']);
assert.deepEqual(activeMods('nd',DEFAULT_CONFIG),[]);
assert.deepEqual(reconcileConfig({ ...DEFAULT_CONFIG, extraMods:['unknown','DT01','DT01'] }).extraMods,['DT01']);
console.log('PASS: antenna conflicts, unrelated extras, sourced wheel override, forced override, stock reset and duplicate/unknown IDs');

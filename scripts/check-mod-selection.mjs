import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const catalogue = JSON.parse(readFileSync('src/data/modsData.json','utf8')).mods;
for (const id of ['FA20','FA21','RA20','RA21','RA22','RA23','RA24','RA25',
  'W10','W11','FA30','RA30','RA31','RA32','EX30','EX31']) {
  const mod = catalogue.find(m => m.id === id);
  const config = reconcileConfig({ ...DEFAULT_CONFIG, [mod.slot]: mod.optionId });
  assert.equal(config[mod.slot], mod.optionId);
  assert.ok(activeMods('nd',config).some(m => m.id === id), `${id} must be selectable`);
}
for (const ids of [['FA05','FA22'],['FA22','FA05']]) {
  const config = reconcileConfig({ ...DEFAULT_CONFIG, extraMods:['RA26',...ids] });
  assert.deepEqual(config.extraMods, ['RA26',ids.at(-1)]);
  assert.equal(activeMods('nd',config).filter(m => ids.includes(m.id)).length, 1);
}
console.log('PASS: all new aero slots, additive rear spats and mutually exclusive canard sets');

for (const ids of [['RA26','DT30'],['DT30','RA26']]) {
  const config = reconcileConfig({ ...DEFAULT_CONFIG, extraMods:['DT31',...ids] });
  assert.deepEqual(config.extraMods, ['DT31',ids.at(-1)]);
  assert.equal(activeMods('nd',config).filter(m => ids.includes(m.id)).length, 1);
}
console.log('PASS: new wheels/exhausts, rear tow eye and mud flap/rear spat conflicts');

// NA: the stock build is the NA's own wheel, every catalogued NA wheel style
// has a mod behind it, and sourced/pack wheels carry over from the ND.
const naStock = reconcileConfig({ ...DEFAULT_CONFIG, generation:'na' });
assert.equal(naStock.wheelStyle, 'oem_na_14');
assert.equal(naStock.wheelDiameter, 14);
assert.deepEqual(activeMods('na', naStock), []);
const carData = JSON.parse(readFileSync('src/data/carData.json','utf8'));
for (const style of carData.generations.find(g => g.id === 'na').wheels.filter(id => id !== 'oem_na_14')) {
  const config = reconcileConfig({ ...naStock, wheelStyle:style });
  assert.equal(config.wheelStyle, style);
  assert.equal(activeMods('na', config).filter(m => m.attachTo === 'wheel').length, 1, `${style} must render on the NA`);
}
const naPack = reconcileConfig({ ...naStock, extraMods:['WP07','WS01'] });
assert.deepEqual(activeMods('na', naPack).map(m => m.id), ['WS01']);
assert.ok(catalogue.filter(m => m.attachTo !== 'wheel').every(m => !m.gen.includes('na') || m.file.na !== m.file.nd),
  'only wheels may reuse the ND file on the NA');
console.log('PASS: NA stock wheel, every NA wheel style modelled, sourced wheels carried over');

// Every non-stock NA aero option is modelled, and the NA's own parts never
// reuse an ND file (only wheels can be fitted across generations).
const naAero = carData.generations.find(g => g.id === 'na').aero;
const stockIds = new Set(['stock', 'stock_single', 'wing_delete', 'none']);
for (const [slot, ids] of Object.entries(naAero)) {
  for (const id of ids.filter(id => !stockIds.has(id))) {
    const config = reconcileConfig({ ...naStock, [slot]: id });
    const fitted = activeMods('na', config).filter(m => m.slot === slot);
    assert.equal(fitted.length, 1, `NA ${slot}=${id} must render`);
    assert.ok(fitted[0].file.na.startsWith('assets/mods/na/'), `${fitted[0].id} must be built for the NA`);
  }
}
console.log('PASS: every NA aero option modelled with NA-built geometry');

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

// Bundle the app's real selection code, including JSON catalogues, for Node.
const { outputFiles } = await build({
  stdin: { contents: `export { activeMods, MOD_GROUP_LABELS } from './src/data/mods';
    export { DEFAULT_CONFIG, reconcileConfig } from './src/config/defaults';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { activeMods, MOD_GROUP_LABELS, DEFAULT_CONFIG, reconcileConfig } = await import(
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
// Exactly one wheel is ever fitted: a pack or sourced wheel overrides every
// wheel style (they used to list the styles by hand and missed new ones).
const wheelStyles = [...new Set(catalogue.filter(m => m.slot === 'wheelStyle').map(m => m.optionId))];
for (const gen of ['nd', 'na']) {
  for (const style of wheelStyles) {
    const fitted = activeMods(gen, { ...DEFAULT_CONFIG, generation: gen, wheelStyle: style, extraMods: ['WP01'] })
      .filter(m => m.attachTo === 'wheel').map(m => m.id);
    assert.deepEqual(fitted, ['WP01'], `${gen}: WP01 must replace ${style}`);
  }
}
console.log(`PASS: a sourced wheel replaces each of ${wheelStyles.length} wheel styles on both cars`);
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

// Every wheel the panel offers has an icon (ControlPanel's WHEEL_ICON):
// a missing file shows as a broken image, locally and on Pages alike.
const wheelIcons = new Set([
  ...carData.generations.flatMap(g => g.wheels ?? []),
  ...catalogue.filter(m => m.attachTo === 'wheel' && m.slot === null).map(m => m.id),
]);
const missingIcons = [...wheelIcons].filter(id => !existsSync(`public/assets/icons/wheels/${id}.png`));
assert.deepEqual(missingIcons, [], 'wheel icons missing; render them with blender/audit_nd_mods.py --icons');
console.log(`PASS: all ${wheelIcons.size} wheel options have icons`);

// ND accessories: all twelve are selectable extras, the aero mirrors replace
// the stock heads, and they cannot be combined with the mirror caps.
const ndExtras = ['DT42','DT43','DT44','DT45','DT46','DT47','DT48','DT49','DT50','DT51','DT52','DT53'];
const allExtras = reconcileConfig({ ...DEFAULT_CONFIG, extraMods: ndExtras });
assert.deepEqual([...allExtras.extraMods].sort(), [...ndExtras].sort());
assert.equal(activeMods('nd', allExtras).length, ndExtras.length);
assert.ok(catalogue.find(m => m.id === 'DT49').hides.nd.length > 0, 'DT49 must hide the stock mirror heads');
for (const [first, last] of [['DT41','DT49'],['DT49','DT41']]) {
  const config = reconcileConfig({ ...DEFAULT_CONFIG, extraMods: [first, last] });
  assert.deepEqual(config.extraMods, [last], `${last} picked after ${first} must win`);
}
console.log('PASS: twelve ND accessories selectable together; aero mirrors and mirror caps are exclusive');

// Every additional part names the panel group it belongs to.
const areas = new Set(['front', 'sides', 'rear', 'top', 'cabin']);
const unplaced = catalogue.filter(m => m.slot === null && m.attachTo === 'body' && m.category !== 'test' && !areas.has(m.area));
assert.deepEqual(unplaced.map(m => m.id), [], 'every additional part needs an area');
console.log('PASS: every additional part is grouped by area');

// Variants in one group (stripe colours, wheels, seats, mirrors) are
// exclusive: the latest pick wins on both cars, and every group has at least
// two members so the grouping means something.
const groups = new Map();
for (const m of catalogue.filter(m => m.group)) groups.set(m.group, [...(groups.get(m.group) ?? []), m]);
for (const [group, members] of groups) {
  assert.ok(members.length >= 2, `group ${group} needs two or more parts`);
  assert.ok(MOD_GROUP_LABELS[group], `group ${group} needs a panel label in MOD_GROUP_LABELS`);
  for (const gen of ['nd', 'na']) {
    const ids = members.filter(m => m.gen.includes(gen)).map(m => m.id);
    if (ids.length < 2) continue;
    const config = reconcileConfig({ ...DEFAULT_CONFIG, generation: gen, extraMods: ids });
    assert.deepEqual(config.extraMods, [ids.at(-1)], `${gen} ${group}: only the last pick survives`);
  }
}
// Replacement interiors hide the stock part they stand in for.
for (const id of ['SW01', 'SW02', 'SW03', 'SW04', 'BS01', 'BS02']) {
  const mod = catalogue.find(m => m.id === id);
  for (const gen of ['nd', 'na']) assert.ok(mod.hides[gen].length > 0, `${id} must hide the stock part on the ${gen}`);
}
// A hardtop wins over a roll bar or wind deflector picked before it.
const hardtop = activeMods('na', reconcileConfig({ ...DEFAULT_CONFIG, generation: 'na', rollBar: 'style_bar', extraMods: ['DT46', 'HT40'] }));
assert.deepEqual(hardtop.map(m => m.id), ['HT40']);
console.log(`PASS: ${groups.size} exclusive part groups, replacement interiors and hardtop conflicts`);

// `requires`: harnesses only survive with the buckets they thread through,
// on both cars, and swapping to the other seats drops them.
for (const gen of ['nd', 'na']) {
  const base = { ...DEFAULT_CONFIG, generation: gen };
  assert.deepEqual(reconcileConfig({ ...base, extraMods: ['HN01'] }).extraMods, [], `${gen}: HN01 needs BS01`);
  assert.deepEqual(reconcileConfig({ ...base, extraMods: ['BS01', 'HN01'] }).extraMods, ['BS01', 'HN01']);
  assert.deepEqual(reconcileConfig({ ...base, extraMods: ['BS01', 'HN01', 'BS02'] }).extraMods, ['BS02'],
    `${gen}: other seats drop the harness`);
}
for (const mod of catalogue.filter(m => m.requires?.length)) {
  for (const id of mod.requires) {
    const needed = catalogue.find(m => m.id === id);
    assert.ok(needed && mod.gen.every(g => needed.gen.includes(g)), `${mod.id} requires ${id} on every car it fits`);
  }
}
// The bonnet wrap sits above where stripes lie, so the later pick wins.
assert.deepEqual(reconcileConfig({ ...DEFAULT_CONFIG, extraMods: ['DT43', 'DT67'] }).extraMods, ['DT67']);
assert.deepEqual(reconcileConfig({ ...DEFAULT_CONFIG, extraMods: ['DT67', 'DT62'] }).extraMods, ['DT62']);
console.log('PASS: harnesses require the buckets; bonnet wrap and stripes are exclusive');

// Wide-body overfenders push the wheels out to fill them, and are one of the
// exclusive flare choices.
for (const id of ['WB01', 'WB02', 'WB03']) {
  const mod = catalogue.find(m => m.id === id);
  assert.ok(mod.flags?.trackWidening?.front > 0 && mod.flags.trackWidening.rear > 0, `${id} must widen the track`);
  assert.equal(mod.group, 'flares');
}
assert.deepEqual(reconcileConfig({ ...DEFAULT_CONFIG, extraMods: ['DT70', 'WB01'] }).extraMods, ['WB01']);
console.log('PASS: wide-body overfenders widen the track and replace other flares');

// Cabin finishes: valid ids survive, unknown ids and parts a car cannot
// colour separately (the NA has no dash accent or door inserts) clear to ''.
const ndCabin = reconcileConfig({ ...DEFAULT_CONFIG, seatTrim: 'red_alcantara', wheelTrim: 'tan_leather',
  trimAccent: 'satin_silver', doorInsert: 'blue' });
assert.deepEqual([ndCabin.seatTrim, ndCabin.wheelTrim, ndCabin.trimAccent, ndCabin.doorInsert],
  ['red_alcantara', 'tan_leather', 'satin_silver', 'blue']);
const naCabin = reconcileConfig({ ...ndCabin, generation: 'na', seatTrim: 'nonsense' });
assert.deepEqual([naCabin.seatTrim, naCabin.wheelTrim, naCabin.trimAccent, naCabin.doorInsert],
  ['', 'tan_leather', '', '']);
console.log('PASS: cabin finishes reconcile per car');

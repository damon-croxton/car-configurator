#!/usr/bin/env node
/**
 * Where the mod build got to.
 *
 * A long unattended run can stop anywhere — tokens run out, Blender drops its
 * bridge, a mod turns out to be harder than it looked. This prints the roadmap
 * against what is actually on disk so the next session gets its bearings in one
 * command instead of re-deriving them, and says plainly what to pick up next.
 *
 *   node scripts/mod-status.mjs
 *
 * `roadmap` in modsData.json is the intent; `mods` is what exists. This joins
 * them. It deliberately does not re-validate — run `validate-mod.mjs` for that.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(resolve(ROOT, 'src/data/modsData.json'), 'utf8'));

const built = new Map(data.mods.map((m) => [m.id, m]));
const roadmap = data.roadmap ?? [];

const rows = roadmap.map((plan) => {
  const mod = built.get(plan.id);
  if (!mod) return { ...plan, state: 'todo' };

  const files = Object.entries(mod.file ?? {});
  const missing = files.filter(([, rel]) => !existsSync(resolve(ROOT, 'public', rel)));
  if (files.length === 0 || missing.length > 0) return { ...plan, state: 'partial', mod };

  const bytes = files.reduce((sum, [, rel]) => sum + statSync(resolve(ROOT, 'public', rel)).size, 0);
  return { ...plan, state: 'built', mod, bytes };
});

const ICON = { built: '✓', partial: '~', todo: ' ' };
let lastCategory = null;

for (const row of rows) {
  if (row.category !== lastCategory) {
    console.log(`\n${row.category}`);
    lastCategory = row.category;
  }
  const detail =
    row.state === 'built'
      ? `${String(row.mod.gen).padEnd(0)} ${(row.bytes / 1024).toFixed(0)} kB`
      : row.state === 'partial'
        ? 'catalogued, file missing'
        : row.note ?? '';
  console.log(`  ${ICON[row.state]} ${row.id.padEnd(6)} ${row.displayName.padEnd(30)} ${detail}`);
}

const done = rows.filter((r) => r.state === 'built').length;
const next = rows.find((r) => r.state !== 'built');

console.log(`\n${done}/${rows.length} built.`);
if (next) {
  console.log(`NEXT: ${next.id} — ${next.displayName}${next.note ? ` (${next.note})` : ''}`);
  console.log('Build it with blender/mods/<ID>_*.py, then: node scripts/validate-mod.mjs ' + next.id);
} else {
  console.log('Roadmap complete. Extend `roadmap` in src/data/modsData.json to go further.');
}

const orphans = data.mods.filter((m) => !roadmap.some((r) => r.id === m.id));
if (orphans.length) {
  console.log(`\nBuilt but not on the roadmap: ${orphans.map((m) => m.id).join(', ')}`);
}

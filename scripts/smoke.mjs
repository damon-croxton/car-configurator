import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) errs.push(m.text()); });

const check = (label, ok, extra='') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`);

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

// 1. URL serialisation reflects UI changes
await page.getByRole('button', { name: 'Paint' }).first().click();
await page.getByRole('button', { name: 'Machine Gray', exact: false }).first().click();
await page.waitForTimeout(600);
check('URL encodes paint choice', page.url().includes('color=machine_gray'), page.url());

await page.getByRole('button', { name: 'Wheels' }).first().click();
await page.getByRole('button', { name: /Rays Volk TE37|Rays Volk|Volk TE37/ }).first().click();
await page.getByRole('button', { name: 'Slammed / Air' }).first().click();
await page.waitForTimeout(800);
check('URL encodes wheels + stance', page.url().includes('wheels=rays_te37') && page.url().includes('stance=-85'), page.url());

// 2. Reload from the shared URL restores state
const shared = page.url();
await page.goto(shared, { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Wheels' }).first().click();
await page.waitForTimeout(300);
const teActive = await page.getByRole('button', { name: /Rays Volk TE37|Rays Volk|Volk TE37/ }).first().evaluate(el => el.className.includes('border-red-500'));
check('Shared URL restores wheel selection', teActive);

// 3. Spec sheet
await page.getByRole('button', { name: /Spec sheet/ }).first().click();
await page.waitForTimeout(600);
const sheet = await page.locator('[role="dialog"]').innerText();
check('Spec sheet lists build', /kerb weight/i.test(sheet) && sheet.includes('Volk TE37'), sheet.split('\n').slice(0,3).join(' / '));
await page.locator('[role="dialog"] button', { hasText: 'Close' }).first().click();
await page.waitForTimeout(400);

// 4. Presets
await page.getByRole('button', { name: /Presets/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Time Attack/ }).first().click();
await page.waitForTimeout(1500);
check('Preset applies to URL', page.url().includes('wing=gt_wing') && page.url().includes('lip=aggressive_splitter'), page.url());

// 5. Snapshot download
const dlPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
await page.getByRole('button', { name: /Snapshot/ }).first().click();
const download = await dlPromise;
if (download) {
  const path = '/tmp/snapshot.png';
  await download.saveAs(path);
  const size = fs.statSync(path).size;
  check('Snapshot downloads a PNG', download.suggestedFilename().endsWith('.png') && size > 40000, `${download.suggestedFilename()} ${size} bytes`);
} else {
  check('Snapshot downloads a PNG', false, 'no download event');
}

// 6. Undo
const beforeUndo = page.url();
await page.getByRole('button', { name: 'Undo' }).first().click();
await page.waitForTimeout(900);
check('Undo reverts the last change', page.url() !== beforeUndo);

// 7. Reset
await page.getByRole('button', { name: 'Reset to factory' }).first().click();
await page.waitForTimeout(1200);
check('Reset clears the query string', new URL(page.url()).search === '', page.url());

// 8. Environment switch + memory sanity across many swaps
await page.getByRole('button', { name: 'Scene' }).first().click();
for (const env of ['Outdoor Sunset','Urban Night','Industrial Warehouse','Salt Flats','Studio']) {
  await page.getByRole('button', { name: new RegExp(env) }).first().click();
  await page.waitForTimeout(900);
}
check('Environment cycling is stable', errs.length === 0, errs.slice(0,3).join(' | '));

const info = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { ctxLost: c ? c.getContext('webgl2')?.isContextLost?.() : null };
});
check('WebGL context still alive', info.ctxLost !== true);

console.log('\nERRORS:', errs.length ? errs.slice(0,8) : 'none');
await browser.close();

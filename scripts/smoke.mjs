import { chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// End-to-end pass over a running build: `npm run build && npm run preview`,
// then `npm run smoke`. Exits non-zero if any check fails, so CI can gate on it.
//
//   TEST_URL         where the app is served (default: vite preview's port)
//   CHROMIUM_PATH    a specific Chromium binary
//   BROWSER_CHANNEL  a Playwright channel such as `chrome`
//
// With neither browser variable set it uses Playwright's own Chromium
// (`npx playwright install chromium`), falling back to an installed Chrome.
const base = process.env.TEST_URL ?? 'http://127.0.0.1:4173/';
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

async function launch() {
  if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args });
  if (process.env.BROWSER_CHANNEL) return chromium.launch({ channel: process.env.BROWSER_CHANNEL, args });
  try {
    return await chromium.launch({ args });
  } catch {
    return chromium.launch({ channel: 'chrome', args });
  }
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`);
};
const tab = (name) => page.getByRole('navigation').getByRole('button', { name }).click();
const open = async (query = '') => {
  await page.goto(new URL(query, base).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
};

await open();

// 1. URL serialisation reflects UI changes
await tab('Paint');
await page.getByRole('button', { name: 'Machine Gray' }).first().click();
await page.waitForTimeout(600);
check('URL encodes paint choice', page.url().includes('color=machine_gray'), page.url());

await tab('Wheels');
await page.getByRole('button', { name: 'Rays Volk TE37' }).first().click();
await page.getByRole('button', { name: /Slammed \/ Air/ }).first().click();
await page.waitForTimeout(800);
check('URL encodes wheels + stance', page.url().includes('wheels=rays_te37') && page.url().includes('stance=-85'), page.url());

// 2. Reload from the shared URL restores state
await open(page.url());
await tab('Wheels');
await page.waitForTimeout(300);
const teActive = await page.getByRole('button', { name: 'Rays Volk TE37' }).first().getAttribute('aria-pressed');
check('Shared URL restores wheel selection', teActive === 'true');

// 3. Spec sheet: lists the build and labels its figures as estimates
await page.getByRole('button', { name: /Spec sheet/ }).first().click();
await page.waitForTimeout(600);
const sheet = await page.locator('[role="dialog"]').innerText();
check('Spec sheet lists build', /kerb weight/i.test(sheet) && sheet.includes('Volk TE37'), sheet.split('\n').slice(0, 3).join(' / '));
check('Spec sheet marks prices as estimates', /estimated/i.test(sheet) && /not quotes/i.test(sheet));
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
  const file = path.join(os.tmpdir(), 'mx5-smoke-snapshot.png');
  await download.saveAs(file);
  const size = fs.statSync(file).size;
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
await tab('Scene');
for (const env of ['Bushveld Sunset', 'Rooftop Twilight', 'Auto Workshop', 'Mountain Road', 'Photo Studio', 'Open Hills']) {
  await page.getByRole('button', { name: new RegExp(env) }).first().click();
  await page.waitForTimeout(900);
}
check('Environment cycling is stable', errs.length === 0, errs.slice(0, 3).join(' | '));

const info = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { ctxLost: c ? c.getContext('webgl2')?.isContextLost?.() : null };
});
check('WebGL context still alive', info.ctxLost !== true);

// 9. Options with no geometry behind them are withheld, even from old links
await open('?roof=rf_up&int=recaro_bucket');
const search = new URL(page.url()).search;
check('Unmodelled RF roof and Recaro seats reconcile away', !search.includes('roof=') && !search.includes('int='), page.url());

// 10. Controls only appear where the model has the surface they drive
await tab('Scene');
const ndLights = await page.getByText('Vehicle lighting').count();
await open('?model=NA');
await tab('Scene');
const naLights = await page.getByText('Vehicle lighting').count();
await tab('Model');
const naRoof = await page.getByText('Roof position').count();
check('Lamp and roof controls follow the model', ndLights === 1 && naLights === 0 && naRoof === 0,
  `ND lights ${ndLights}, NA lights ${naLights}, NA roof ${naRoof}`);

console.log('\nERRORS:', errs.length ? errs.slice(0, 8) : 'none');
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
await browser.close();
process.exitCode = failures ? 1 : 0;

/**
 * Regression check for authored-asset composition.
 *
 * Precondition: a GLB must be present at dist/assets/models/mx5_nd.glb and
 * `vite preview` running on :4173. Verifies that adopting an authored asset
 * does not cost any procedural functionality — every aero, roof and wheel
 * variant must still toggle after the swap.
 *
 *   npm run build && cp <your>.glb dist/assets/models/mx5_nd.glb
 *   npx vite preview --port 4173 --host 127.0.0.1 &
 *   node scripts/check-composition.mjs
 */
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1300, height: 820 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text());
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(7000);

const badges = await page.locator('.pointer-events-none span').allInnerTexts();
console.log('badges:', JSON.stringify(badges));
const adopted = !badges.some((b) => b.includes('PROCEDURAL MESH'));
console.log('adopted authored asset?', adopted);
if (!adopted) {
  console.log('No authored asset was adopted — put a GLB at dist/assets/models/mx5_nd.glb first.');
  await browser.close();
  process.exit(1);
}

// Exact match matters: 'Aero' would otherwise also hit the 'Rear / Aero'
// camera preset, which sits earlier in the DOM.
const clickTab = async (n) => {
  await page.locator('nav').getByRole('button', { name: n, exact: true }).click();
  await page.waitForTimeout(400);
};

// The authored asset supplies no aero/roof, so every variant toggle must survive.
await clickTab('Aero');
for (const part of ['Carbon Splitter', 'GT Wing', 'Track Diffuser', 'Track Roll Hoop']) {
  await page.locator('aside').getByRole('button', { name: new RegExp(part) }).click();
  await page.waitForTimeout(500);
}
// Scope to the panel: 'Up' also matches the 'Wheel Close-Up' camera preset.
const panel = page.locator('aside');
await clickTab('Model');
await panel.getByRole('button', { name: /Retractable Fastback/ }).click();
await page.waitForTimeout(500);
await panel.getByRole('button', { name: 'Up', exact: true }).click();
await page.waitForTimeout(900);
await clickTab('Wheels');
await panel.getByRole('button', { name: /Watanabe RS-8/ }).click();
await page.waitForTimeout(900);

await page.screenshot({ path: '/tmp/shots/compose.png' });
console.log('URL:', page.url());
console.log('ERRORS:', errs.length ? errs.slice(0, 6) : 'none');
console.log(errs.length ? 'FAIL' : 'PASS — authored nodes adopted, procedural variants intact.');
await browser.close();
process.exit(errs.length ? 1 : 0);

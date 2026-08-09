#!/usr/bin/env node
/**
 * Manifest-driven asset fetcher.
 *
 * Fetchable binary assets (HDRIs) are deliberately NOT committed — git keeps
 * every revision of a binary forever. Instead they are declared in
 * `src/data/assetManifest.json` and pulled here, both locally (`npm run
 * assets`) and in CI (before `npm run build`). Manifest entries marked
 * `vendored` are already in the repo and are skipped.
 *
 * Failure is non-fatal by design: a missing HDRI falls back to code-generated
 * lighting, so a flaky CDN shouldn't break the build outright. Pass `--strict`
 * to turn fetch failures into a non-zero exit instead.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = resolve(ROOT, 'src/data/assetManifest.json');
const PUBLIC = resolve(ROOT, 'public');

const strict = process.argv.includes('--strict');
const force = process.argv.includes('--force');
const TIMEOUT_MS = 60_000;

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const human = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

async function alreadyPresent(path, expectedHash) {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size === 0) return false;
    // Without a declared hash, presence is enough — re-downloading every build
    // would waste CI minutes for no benefit.
    if (!expectedHash) return true;
    return sha256(await readFile(path)) === expectedHash;
  } catch {
    return false;
  }
}

async function fetchAsset(asset) {
  const destination = resolve(PUBLIC, asset.dest);

  // Vendored assets already live in public/ — they are listed in the manifest
  // only so their licence and credit are recorded in one place.
  if (asset.vendored || !asset.url) {
    console.log(`  · ${asset.dest} (vendored, in repo)`);
    return { id: asset.id, status: 'cached' };
  }

  if (!force && (await alreadyPresent(destination, asset.sha256))) {
    console.log(`  ✓ ${asset.dest} (cached)`);
    return { id: asset.id, status: 'cached' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(asset.url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new Error('empty response');

    if (asset.sha256 && sha256(bytes) !== asset.sha256) {
      throw new Error(`sha256 mismatch (got ${sha256(bytes)})`);
    }

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    console.log(`  ✓ ${asset.dest} (${human(bytes.length)}${asset.sha256 ? '' : `, sha256 ${sha256(bytes)}`})`);
    return { id: asset.id, status: 'fetched', bytes: bytes.length };
  } catch (error) {
    console.warn(`  ✗ ${asset.dest} — ${error.message}`);
    return { id: asset.id, status: 'failed', error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
console.log(`Fetching ${manifest.assets.length} asset(s) declared in assetManifest.json`);

const results = [];
for (const asset of manifest.assets) {
  results.push(await fetchAsset(asset));
}

const failed = results.filter((r) => r.status === 'failed');
const fetched = results.filter((r) => r.status === 'fetched');
const cached = results.filter((r) => r.status === 'cached');

console.log(`\n${fetched.length} fetched, ${cached.length} cached, ${failed.length} failed`);

if (failed.length > 0) {
  console.log('Missing HDRIs fall back to code-generated lighting at runtime.');
  if (strict) {
    console.error('--strict was set, so this is a failure.');
    process.exit(1);
  }
}

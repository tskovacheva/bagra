// scripts/time-boot.mjs — how long the phases of a start take, roughly.
//
// A DEVELOPMENT MEASUREMENT, not a benchmark. It runs under Node with
// fake-indexeddb and a filesystem `fetch`, which is not a browser: there is no
// network, no disk cache, no service worker, and IndexedDB is an in-memory
// shim. The absolute numbers mean nothing outside this script.
//
// What it is for is the SHAPE — which phase dominates, and whether the second
// start of an unchanged library still reads the library. That comparison holds
// even though the numbers do not transfer.
//
//   node scripts/time-boot.mjs

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

let bytes = 0, files = 0;
globalThis.fetch = async (url) => {
  const p = String(url).replace(/^.*\/bagra\//, '');
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  const text = fs.readFileSync(p, 'utf8');
  bytes += Buffer.byteLength(text); files++;
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};
Object.defineProperty(globalThis, 'crypto', {
  value: { subtle: crypto.webcrypto.subtle, randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
  configurable: true,
});

const db = await import('../db.js');
const { ensurePacks } = await import('../seed.js');
const { migratePlantPhotos } = await import('../migrate-photos.js');
const { VOCABULARY, BANDS } = await import('../vocab.js');

const at = () => performance.now();
const phase = async (label, fn) => {
  bytes = 0; files = 0;
  const t = at();
  await fn();
  console.log(`  ${label.padEnd(26)} ${(at() - t).toFixed(0).padStart(6)} ms   `
            + `${String(files).padStart(2)} file(s), ${(bytes / 1024).toFixed(0).padStart(5)} KB`);
};

// Vocabulary seeding, without importing app.js and its DOM.
const seedVocab = async () => {
  const have = new Map((await db.all('vocabulary')).map(v => [v.key, v]));
  for (const v of VOCABULARY) if (!have.has(v.key)) await db.putSystem('vocabulary', { ...v, origin: 'seed' });
  const haveB = new Map((await db.all('bands')).map(b => [b.key, b]));
  for (const b of BANDS) if (!haveB.has(b.key)) await db.putSystem('bands', { ...b, origin: 'seed' });
};

console.log('\nFIRST START — nothing installed');
await phase('open the database', () => db.open());
await phase('vocabulary and bands', seedVocab);
await phase('packs', () => ensurePacks());
await phase('plant photographs', () => migratePlantPhotos());
await phase("all('plants')", () => db.all('plants'));

console.log('\nSECOND START — the library unchanged');
await phase('vocabulary and bands', seedVocab);
await phase('packs', () => ensurePacks());
await phase('plant photographs', () => migratePlantPhotos());
await phase("all('plants')", () => db.all('plants'));

const plants = await db.all('plants');
console.log(`\n  ${plants.length} plants, `
  + `${(JSON.stringify(plants).length / 1024).toFixed(0)} KB as JSON, `
  + `${(fs.statSync('seed/plants.json').size / 1024).toFixed(0)} KB pack on disk`);

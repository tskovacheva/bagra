// scripts/try-boot-and-photos.mjs — is the library still read from the files on
// every start, and does a personal photograph survive losing the shipped one?
//
// Two faults from the rc27 audit, kept in one script because they meet: the
// reason a normal start was heavy was that the plant pack was 3.97 MB, and the
// reason it was 3.97 MB was that 3.49 MB of it were photographs inside the
// records.
//
//   node scripts/try-boot-and-photos.mjs

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

let failed = false;
const ok   = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is   = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want))
  ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

// Every fetch is counted and named. The structural proof this file exists for
// is not a timing: it is that a normal unchanged start does not ask for the
// plant pack at all.
const fetched = [];
globalThis.fetch = async (url) => {
  const p = String(url).replace(/^.*\/bagra\//, '');
  fetched.push(p);
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};
Object.defineProperty(globalThis, 'crypto', {
  value: { subtle: crypto.webcrypto.subtle, randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
  configurable: true,
});

const db = await import('../db.js');
const { ensurePacks, packsWithNewVersion, PACKS } = await import('../seed.js');
await db.open();

const since = () => { const n = fetched.length; return () => fetched.slice(n); };

// ---------------------------------------------------------------- the pack
console.log('\nthe shipped plant pack carries no photographs');

const packText = fs.readFileSync('seed/plants.json', 'utf8');
const pack = JSON.parse(packText);
const withData = pack.plants.filter(p => p.photoData);
withData.length === 0
  ? ok(`no plant record in the pack holds base64 (${(packText.length / 1024).toFixed(0)} KB total)`)
  : fail(`${withData.length} plant record(s) still hold photoData`);

const withSrc = pack.plants.filter(p => p.photoSrc && p.photoHash);
is(withSrc.length, pack.plants.length, 'every plant names a file and records its shipped hash');

const missingFile = withSrc.filter(p => !fs.existsSync(p.photoSrc));
is(missingFile.length, 0, 'every named file exists on disk');

const noCredit = pack.plants.filter(p => p.photoSrc && !p.photoCredit?.author);
is(noCredit.length, 0, 'attribution survived — every photograph still names an author');

// ---------------------------------------------------------------- fresh install
console.log('\na fresh install seeds the packs and writes no base64');

let mark = since();
const first = await ensurePacks();
const firstFetches = mark();

is(first.loaded.sort(), Object.keys(PACKS).sort(), 'every pack was loaded');
is(first.skipped, [], 'and none was skipped');
firstFetches.includes('seed/plants.json')
  ? ok('the plant pack was fetched, as it must be on a fresh install')
  : fail('a fresh install did not fetch the plant pack');

const plants = await db.all('plants');
const heavy = plants.filter(p => (p.photoData || '').length > 1000);
is(heavy.length, 0, 'no seeded plant record in the database holds a multi-KB photograph');

const one = plants.find(p => p.id === 'seed:quercus_robur') || plants[0];
const bytes = JSON.stringify(one).length;
bytes < 8000
  ? ok(`a representative plant record is ${bytes} bytes`)
  : fail(`a plant record is still ${bytes} bytes`);

const payload = JSON.stringify(plants).length;
console.log(`       all('plants') payload: ${(payload / 1024).toFixed(0)} KB for ${plants.length} records`);

// ---------------------------------------------------------------- the gate
console.log('\nan unchanged library is not read from the files again');

mark = since();
const second = await ensurePacks();
const secondFetches = mark();

is(second.loaded, [], 'nothing was loaded the second time');
is(second.skipped.sort(), Object.keys(PACKS).sort(), 'every pack was recognised as installed');
secondFetches.includes('seed/plants.json')
  ? fail('the plant pack was fetched again on an unchanged start')
  : ok('the plant pack was NOT fetched — the structural point of the gate');
is(secondFetches, ['seed/manifest.json'], 'the whole start read one file: the manifest');

// ---------------------------------------------------------------- recovery
console.log('\nand a seeded record deleted by hand still comes back');

await db.remove('plants', 'seed:quercus_robur');
mark = since();
const third = await ensurePacks();
third.loaded.includes('plants')
  ? ok('the gate opened because the set of ids had changed')
  : fail('a deleted seeded record did not reopen the gate — behaviour changed silently');
(await db.get('plants', 'seed:quercus_robur'))
  ? ok('and the record is back')
  : fail('the record did not come back');
// The other packs must not have been dragged along.
is(third.loaded, ['plants'], 'only the pack that needed it was read');

// ---------------------------------------------------------------- new version
console.log('\na newer shipped pack is detectable without opening it');

is(await packsWithNewVersion(), [], 'nothing is new right now');

// Two fields since rc29 (§13cu): what the boot has seeded, and what the owner
// has reviewed. The gate reads the first; „is there something new" reads the
// second, so that booting past an update cannot retire it.
const state = await db.getSetting('packState');
state.plants.seededVersion = '0.0.1-older';
state.plants.appliedVersion = '0.0.1-older';
await db.setSetting('packState', state);
is(await packsWithNewVersion(), ['plants'], 'an older reviewed version is seen from the manifest alone');

mark = since();
const fourth = await ensurePacks();
fourth.loaded.includes('plants')
  ? ok('and the gate opens for it')
  : fail('a version change did not open the gate');

// A version change must NOT be a licence to overwrite. `ensurePacks` may only
// add absent records; revising an existing one goes through the preview (§10).
const edited = await db.get('plants', 'seed:quercus_robur');
edited.nameCommon = { bg: 'моето име', en: 'my name' };
edited.editedByUser = true;
await db.put('plants', edited);
const st2 = await db.getSetting('packState');
st2.plants.seededVersion = '0.0.1-older';
await db.setSetting('packState', st2);
await ensurePacks();
is((await db.get('plants', 'seed:quercus_robur')).nameCommon.bg, 'моето име',
   'an edited seeded record was not overwritten by the gate');

// ---------------------------------------------------------------- migration
console.log('\nan existing installation keeps the photograph she chose');

const { migratePlantPhotos } = await import('../migrate-photos.js');

// Two records standing for the two cases on a real rc27 copy: one holding the
// photograph the pack shipped, one holding hers. The record does not say which
// is which — that is the whole difficulty — so the migration compares against
// the hash the pack recorded.
const table = JSON.parse(fs.readFileSync('seed/plant-photos.json', 'utf8')).photos;
const shippedId = Object.keys(table)[0];
const shippedFile = fs.readFileSync(table[shippedId].src);
const shippedData = 'data:image/jpeg;base64,' + shippedFile.toString('base64');
const shippedHash = crypto.createHash('sha256').update(shippedData).digest('hex');

is(shippedHash, table[shippedId].hash,
   'the recorded hash really is the hash of the file that shipped');

const hers = 'data:image/jpeg;base64,' + Buffer.from('her own photograph').toString('base64');
const otherId = Object.keys(table)[1];

const asRc27 = async (id, data) => {
  const rec = await db.get('plants', id);
  delete rec.photoSrc; delete rec.photoHash;
  rec.photoData = data;
  await db.putRaw('plants', rec);
};
await asRc27(shippedId, shippedData);
await asRc27(otherId, hers);
await db.setSetting('plantPhotoMigration', null);

await migratePlantPhotos();

const moved = await db.get('plants', shippedId);
const kept  = await db.get('plants', otherId);

!moved.photoData && moved.photoSrc === table[shippedId].src
  ? ok('the shipped photograph became a file reference')
  : fail(`shipped photograph not moved: ${JSON.stringify({ d: !!moved.photoData, s: moved.photoSrc })}`);

kept.photoData === hers
  ? ok('HER photograph was left exactly where it was')
  : fail('a personal photograph was replaced by the shipped one');

moved.photoCredit?.author && kept.photoCredit?.author
  ? ok('attribution survived the migration on both')
  : fail('attribution was lost');

kept.editedByUser === false
  ? ok('and the migration did not mark records as user-edited')
  : fail('the migration marked a record as edited, which would break the pack diff');

// Rendering: hers wins, always.
const { photoOf } = await import('../ui.js').catch(() => ({ photoOf: null }));
if (photoOf) {
  is(photoOf(kept), hers, 'photoOf prefers the personal photograph');
  is(photoOf(moved), table[shippedId].src, 'and falls back to the shipped file');
}

// Idempotent: a second run must not touch anything.
const before = JSON.stringify(await db.all('plants'));
await migratePlantPhotos();
before === JSON.stringify(await db.all('plants'))
  ? ok('running it twice changes nothing')
  : fail('a second run of the migration wrote again');

// Without the table nothing may be guessed.
await db.setSetting('plantPhotoMigration', null);
await asRc27(otherId, hers);
const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => String(u).includes('plant-photos')
  ? { ok: false, status: 404, json: async () => ({}) } : realFetch(u);
await migratePlantPhotos();
globalThis.fetch = realFetch;
(await db.get('plants', otherId)).photoData === hers
  ? ok('with no comparison table available, nothing is touched')
  : fail('the migration guessed when it could not compare');

console.log(failed ? '\nBOOT AND PHOTO CHECK FAILED' : '\nall held');
process.exit(failed ? 1 : 0);

// scripts/try-hardening.mjs — three production faults from the third audit.
//
//   1. Every historical repair walked every record on every start, for ever, to
//      establish there was nothing left to do.
//   2. A structural migration stamped `updatedAt`, so tidying up after itself
//      rearranged the order of her work by recency.
//   3. The backup warning counted a store nothing has ever written to, and told
//      a person with two hundred photographs that she had none to lose.
//
//   node scripts/try-hardening.mjs

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

let failed = false;
const ok   = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is   = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want))
  ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

globalThis.fetch = async (url) => {
  const p = String(url).replace(/^.*\/bagra\//, '');
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

const db = await import('../db.js');
const { countUserPhotos } = await import('../photo.js');
const { importBackup, exportAll } = await import('../backup.js');
await db.open();

const OLD = '2024-06-01T09:00:00.000Z';

// ================================================================ 2. writes
console.log('\na write says what kind of write it is');

const rec = (id) => ({ id, origin: 'user', createdAt: OLD, updatedAt: OLD, name: { bg: 'x', en: 'x' } });
const counter = () => db.getSetting('changeCounter', 0);
const stampOf = (r) => r.updatedAt;

const cases = [
  ['put         — she edited it',        db.put,         true,  1],
  ['putSystem   — a pack revised it',    db.putSystem,   true,  0],
  ['putMigration— a structure changed',  db.putMigration, false, 0],
  ['putRaw      — restored from a file', db.putRaw,      false, 0],
];
for (const [label, fn, stamps, counts] of cases) {
  const before = await counter();
  await fn('techniques', rec('w-' + label.length + fn.name));
  const saved = await db.get('techniques', 'w-' + label.length + fn.name);
  const moved = stampOf(saved) !== OLD;
  const delta = (await counter()) - before;
  (moved === stamps && delta === counts)
    ? ok(`${label} — ${stamps ? 'stamps' : 'preserves'}, ${counts ? 'counts' : 'does not count'}`)
    : fail(`${label} — stamped ${moved} (want ${stamps}), counted ${delta} (want ${counts})`);
}

// The point of the split, stated as the thing a person would notice: a
// structural conversion must not reorder her work.
console.log('\na structural conversion does not reorder her work');

await db.putRaw('fabrics', { id: 'cloth-old', origin: 'user', createdAt: OLD, updatedAt: OLD,
  stateEvents: [{ trialId: 't1', date: '2024-06-01', stateCode: 'dyed' },
                { trialId: 't1', date: '2024-07-01', stateCode: 'dyed' }] });
await db.putRaw('fabrics', { id: 'cloth-new', origin: 'user', createdAt: OLD,
  updatedAt: '2026-08-20T09:00:00.000Z', actions: [] });

const order = async () => (await db.all('fabrics'))
  .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  .map(f => f.id);

is(await order(), ['cloth-new', 'cloth-old'], 'newest first, before anything runs');

const { healDoubleStateEvents, migrateFabricActions, runMigrations } = await import('../migrations.js');
await healDoubleStateEvents();

is(await order(), ['cloth-new', 'cloth-old'],
   'and still newest first after the repair converted the older one');
is((await db.get('fabrics', 'cloth-old')).updatedAt, OLD,
   'the converted piece kept the date it was last actually touched');

// ================================================================ 1. markers
console.log('\na repair runs once for a database, not at every start');

let runs = 0;
const marker = () => db.getSetting('migrations', null);

await db.setSetting('migrations', null);
await runMigrations();
const after = await marker();
after?.doubleStateEvents >= 1 && after?.fabricActions >= 1
  ? ok('the first run recorded a marker for each pass')
  : fail(`markers not written: ${JSON.stringify(after)}`);

// Second start: the passes must not walk the stores again. Proved by making one
// of them observable — a pass that runs will change the record it is given.
await db.putRaw('fabrics', { id: 'cloth-dupes', origin: 'user', createdAt: OLD, updatedAt: OLD,
  stateEvents: [{ trialId: 't9', date: '2024-06-01', stateCode: 'dyed' },
                { trialId: 't9', date: '2024-07-01', stateCode: 'dyed' }] });
await runMigrations();
is((await db.get('fabrics', 'cloth-dupes')).stateEvents.length, 2,
   'the second start did not walk the cloth again — the marker held');

// And the marker is a control, not a crutch: run the pass by hand and it must
// still be safe and still do its job.
await healDoubleStateEvents();
is((await db.get('fabrics', 'cloth-dupes')).stateEvents.length, 1,
   'run by hand it still repairs — the migration is idempotent on its own');
await healDoubleStateEvents();
is((await db.get('fabrics', 'cloth-dupes')).stateEvents.length, 1,
   'and running it twice by hand changes nothing');

console.log('\na pass that throws leaves no marker');

await db.setSetting('migrations', { fabricActions: 1 });
let threw = false;
try {
  const { runOnceForTest } = await import('../migrations.js');
  await runOnceForTest('willFail', 1, async () => { throw new Error('halfway'); });
} catch { threw = true; }
threw ? ok('the failure was not swallowed') : fail('a throwing migration was swallowed');
is((await marker())?.willFail, undefined,
   'and nothing was recorded — the next start will try again');

// ---------------------------------------------------------------- restore
console.log('\nan old backup makes a migration eligible again');

// The marker is data. It travels in the backup with the data it describes, so a
// snapshot of a database from before a migration restores the absence of its
// marker along with the state that needs it. Nothing extra was built for this —
// it falls out of a snapshot being a snapshot (§11.4), which is exactly why it
// has to be asserted rather than assumed.
await db.setSetting('migrations', null);
await db.putRaw('fabrics', { id: 'cloth-in-old-backup', origin: 'user', createdAt: OLD, updatedAt: OLD,
  stateEvents: [{ trialId: 't7', date: '2024-06-01', stateCode: 'dyed' },
                { trialId: 't7', date: '2024-07-01', stateCode: 'dyed' }] });
const oldBackup = await exportAll();

await runMigrations();
is((await marker())?.doubleStateEvents, 1, 'the modern database is marked done');

const modernBackup = await exportAll();
await importBackup(modernBackup, 'replace');
is((await marker())?.doubleStateEvents, 1,
   'restoring a modern backup leaves the marker in place — no redundant run');

await importBackup(oldBackup, 'replace');
is((await marker())?.doubleStateEvents, undefined,
   'restoring the OLD backup restored the absence of the marker');
is((await db.get('fabrics', 'cloth-in-old-backup')).stateEvents.length, 2,
   'along with the unrepaired data');

await runMigrations();
is((await db.get('fabrics', 'cloth-in-old-backup')).stateEvents.length, 1,
   'so the migration became eligible and ran');

// ================================================================ 3. photos
console.log('\nthe warning counts the photographs that exist nowhere else');

for (const store of ['fabrics', 'trials', 'pigmentBatches', 'plants', 'photos']) {
  for (const r of await db.all(store)) await db.remove(store, r.id);
}
is(await countUserPhotos(), 0, 'an empty database has nothing to lose');

const img = (n) => `data:image/jpeg;base64,${n}`;

await db.putRaw('fabrics', { id: 'f1', origin: 'user', photoData: img('cloth') });
is(await countUserPhotos(), 1, 'one photograph on a piece of cloth');

await db.putRaw('trials', { id: 't1', origin: 'user',
  resultPhotos: [img('a'), img('b'), img('c'), img('d'), img('e')], steps: [] });
is(await countUserPhotos(), 6, 'a trial with five results counts as five, not as one record');

await db.putRaw('trials', { id: 't2', origin: 'user', resultPhotos: [],
  steps: [{ id: 's1', photos: [img('x'), img('y'), img('z')] }, { id: 's2', photos: [] }] });
is(await countUserPhotos(), 9, 'photographs on the steps count too');

await db.putRaw('pigmentBatches', { id: 'p1', origin: 'user',
  photos: [img('pig')], stages: [{ id: 'g1', photos: [img('g1a'), img('g1b')] }] });
is(await countUserPhotos(), 12, 'and on a pigment batch and its stages');

// The distinction the whole thing rests on.
await db.putRaw('plants', { id: 'seed:shipped', origin: 'seed',
  photoSrc: 'seed/images/plants/quercus_robur.jpg' });
is(await countUserPhotos(), 12,
   'a SHIPPED plant photograph is not at risk — the application can lay it down again');

await db.putRaw('plants', { id: 'seed:mine', origin: 'seed',
  photoSrc: 'seed/images/plants/rubia_tinctorum.jpg', photoData: img('my own plant') });
is(await countUserPhotos(), 13, 'but a personal override on the same plant is');

console.log(failed ? '\nHARDENING CHECK FAILED' : '\nall held');
process.exit(failed ? 1 : 0);

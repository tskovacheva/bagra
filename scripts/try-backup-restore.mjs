// scripts/try-backup-restore.mjs — does `replace` actually restore a snapshot?
//
// The four faults this exists to keep out, each of which shipped in 1.0.0-rc25
// and none of which any layer of the check suite could see:
//
//   1. `replace` kept records that the backup did not carry. It overwrote what
//      matched and added what was missing and removed nothing, so restoring
//      last week's file did not return the database to last week. The label
//      promised a snapshot and the code performed a merge, to a person who had
//      reached for it because something had already gone wrong.
//   2. A restored record was stamped with the hour of the restore, so the file's
//      record of WHEN the work happened was destroyed by the act of recovering
//      it.
//   3. The unbacked-up-changes counter counted every write, including several
//      hundred at first install, so it measured nothing a person would recognise
//      as her own work.
//   4. Deleting a record did not count at all.
//
// Run on its own:  node scripts/try-backup-restore.mjs
//
// Each question is asked in both directions. A test that only ever sees the
// good case is a test that would pass against the broken code.

import 'fake-indexeddb/auto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

let failed = false;
const ok   = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is   = (got, want, m) =>
  (JSON.stringify(got) === JSON.stringify(want))
    ? ok(m)
    : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

const db = await import('../db.js');
const { importBackup, exportAll, validateBackup } = await import('../backup.js');

await db.open();

const trial = (id, title, updatedAt) => ({
  id, title, date: '2026-05-01', processCode: 'ecoprint',
  placements: [], steps: [], resultPhotos: [],
  origin: 'user', createdAt: '2026-05-01T00:00:00.000Z', updatedAt,
});

const counter = () => db.getSetting('changeCounter', 0);
const ids = async (store) => (await db.all(store)).map(r => r.id).sort();

// ---------------------------------------------------------------- case 1 & 2
// The database has three trials; the backup has two of them, and its copy of A
// is older than the one in the database.

console.log('\nreplace — a record the backup does not carry');

// Written RAW on purpose: `put` would stamp them with today, and then the
// backup would carry today's date and case 3 would pass without proving
// anything. The whole question is whether a time older than the restore
// survives it.
await db.putRaw('trials', trial('A', 'алабаш — версия от архива', '2026-08-01T09:00:00.000Z'));
await db.putRaw('trials', trial('B', 'брезов лист', '2026-08-01T09:00:00.000Z'));

const backup = await exportAll();
is(backup.data.trials.length, 2, 'the backup was taken with two trials in it');

// Then she works: A is edited, and C is written after the backup was taken.
const a = await db.get('trials', 'A');
a.title = 'алабаш — редактиран СЛЕД архива';
await db.put('trials', a);
await db.put('trials', trial('C', 'див морков, написан след архива', '2026-08-20T09:00:00.000Z'));

is(await ids('trials'), ['A', 'B', 'C'], 'before the restore the database holds A, B and C');

await importBackup(backup, 'replace');

is(await ids('trials'), ['A', 'B'], 'after the restore C is gone — the file did not carry it');
is((await db.get('trials', 'A')).title, 'алабаш — версия от архива',
   'A holds the value the file holds, not the newer one');

// And the other direction: merge must NOT remove C, or the safe mode has
// quietly become the destructive one.
console.log('\nmerge — the safe mode still only ever adds');

await db.put('trials', trial('C', 'див морков, написан пак', '2026-08-20T09:00:00.000Z'));
const a2 = await db.get('trials', 'A');
a2.title = 'алабаш — редактиран пак';
await db.put('trials', a2);

await importBackup(backup, 'merge');

is(await ids('trials'), ['A', 'B', 'C'], 'merge left C exactly where it was');
is((await db.get('trials', 'A')).title, 'алабаш — редактиран пак',
   'merge did not overwrite the newer A');

// ---------------------------------------------------------------- case 3
console.log('\nrestore keeps the time the file records');

await db.remove('trials', 'C');
await importBackup(backup, 'replace');

is((await db.get('trials', 'A')).updatedAt, '2026-08-01T09:00:00.000Z',
   'the restored record keeps the updatedAt the backup gave it');
is((await db.get('trials', 'A')).createdAt, '2026-05-01T00:00:00.000Z',
   'and its createdAt');

// The other direction: an ordinary edit must still move updatedAt, or the fix
// has turned every save into a record that never appears to change.
const a3 = await db.get('trials', 'A');
a3.title = 'редакция от ръка';
await db.put('trials', a3);
const moved = (await db.get('trials', 'A')).updatedAt !== '2026-08-01T09:00:00.000Z';
moved ? ok('a real edit still stamps updatedAt')
      : fail('a real edit no longer stamps updatedAt — the split went too far');

// Merge writes raw too: an added record carries the file's own time.
await db.remove('trials', 'B');
await importBackup(backup, 'merge');
is((await db.get('trials', 'B')).updatedAt, '2026-08-01T09:00:00.000Z',
   'a record merged back in also keeps the file’s time');

// ---------------------------------------------------------------- case 4
console.log('\nthe counter counts her work and nothing else');

const cases = [
  ['a seed pack write',   () => db.putSystem('plants',  { id: 'sys-1', nameBotanical: 'Rubia tinctorum' }), 0],
  ['a migration write',   () => db.putSystem('fabrics', { id: 'sys-2', actions: [] }),                      0],
  ['a pack withdrawal',   () => db.removeSystem('plants', 'sys-1'),                                         0],
  ['a raw restore write', () => db.putRaw('trials', trial('R', 'raw', '2026-01-01T00:00:00.000Z')),         0],
  ['a real edit',         () => db.put('trials', trial('U', 'her own', '2026-01-01T00:00:00.000Z')),        1],
  ['a real delete',       () => db.remove('trials', 'U'),                                                   1],
];

for (const [label, run, expected] of cases) {
  const before = await counter();
  await run();
  const delta = (await counter()) - before;
  is(delta, expected, `${label} moves the counter by ${expected}`);
}

// A whole restore, counted end to end. This is the one that mattered: it wrote
// through `put` and so announced a database-worth of unsaved changes at the
// exact moment the database equalled a file on disk.
await db.setSetting('changeCounter', 7);
await importBackup(backup, 'replace');
is(await counter(), 0, 'a snapshot restore leaves the counter at zero, not at seven');
is(await db.getSetting('lastExportAt'), backup.exportedAt,
   'and dates the last backup to the file, not to the moment of the restore');

// ------------------------------------------------------- clear → error → ?
//
// The failure the whole thing is arranged around. `clear()` and every `put()`
// ride one transaction, so a row the store refuses must take the clear down
// with it. The alternative — an emptied store and a message saying the restore
// failed — leaves a person with less than she had before she asked for help.

console.log('\na restore that fails leaves the database as it was');

await importBackup(backup, 'replace');
const beforeCrash = await ids('trials');

let threw = false;
try {
  await db.replaceStores({
    trials: [
      trial('Z', 'първият ред минава', '2026-01-01T00:00:00.000Z'),
      // A function cannot be stored. IndexedDB refuses it, and it refuses it
      // AFTER the clear and the first put have been queued — which is exactly
      // the shape of the half-restore.
      { id: 'BAD', broken: () => {} },
    ],
  });
} catch { threw = true; }

threw ? ok('the refused row was reported rather than swallowed')
      : fail('a refused row went through without a word');
is(await ids('trials'), beforeCrash, 'and the store is untouched — not emptied, not half-filled');

// -------------------------------------------------- the count that was wrong
//
// `removed` was the count before minus the count after, which is right only
// when the file is a subset of the database. Current {A,B} against a backup of
// {B,C} is two records before and two after — nothing removed, said the
// arithmetic, while A had gone. The number a person reads after a snapshot
// restore is the one thing telling her what the file did not carry, so it must
// be a set difference and not a subtraction.

console.log('\nthe report counts what went, not how many fewer there are');

await db.replaceStores({ trials: [] });
await db.putRaw('trials', trial('A', 'само в базата', '2026-08-01T09:00:00.000Z'));
await db.putRaw('trials', trial('B', 'в двете', '2026-08-01T09:00:00.000Z'));
const sameSize = await exportAll();          // holds A and B
sameSize.data.trials = [
  trial('B', 'в двете', '2026-08-01T09:00:00.000Z'),
  trial('C', 'само в архива', '2026-08-01T09:00:00.000Z'),
];

const r = await importBackup(sameSize, 'replace');
is(r.removed, 1, 'A went, and the report says one went — before and after are both two');
is(await ids('trials'), ['B', 'C'], 'and the store holds exactly what the file held');

// ------------------------------------------------------------- the language
//
// A device preference, not part of the work (§13co). Restoring a phone's backup
// onto the laptop must not switch the interface.

console.log('\nthe language belongs to the device');

await db.setSetting('language', 'bg');
const enBackup = await exportAll();
enBackup.data.settings = (enBackup.data.settings || [])
  .filter(row => row.key !== 'language')
  .concat([{ key: 'language', value: 'en' }]);

await importBackup(enBackup, 'replace');
is(await db.getSetting('language'), 'bg',
   'a backup carrying English did not switch a Bulgarian device');

// Absence is a value too: no row means Bulgarian by default, so restoring one
// where there was none changes the language just as surely as overwriting it.
await db.removeSystem('settings', 'language');
await importBackup(enBackup, 'replace');
is(await db.get('settings', 'language'), undefined,
   'and a device that had never chosen one still has not');

// The other direction: the tag counter IS part of the snapshot, because losing
// it means the next piece takes a number already on a label in the studio.
await db.setSetting('fabricLabelCounter', 99);
const counterBackup = await exportAll();
counterBackup.data.settings = counterBackup.data.settings
  .filter(row => row.key !== 'fabricLabelCounter')
  .concat([{ key: 'fabricLabelCounter', value: 12 }]);
await importBackup(counterBackup, 'replace');
is(await db.getSetting('fabricLabelCounter'), 12,
   'the tag counter came back from the file — it is work, not a preference');

// ---------------------------------------------------------------- validation
console.log('\na bad file is refused before anything is written');

const refuses = async (payload, why) => {
  try { validateBackup(payload); fail(`accepted ${why}`); }
  catch { ok(`refuses ${why}`); }
};
await refuses({ format: 'something-else' }, 'a file that is not a Багра backup');
await refuses({ format: 'bagra-backup', schemaVersion: 99, data: {} }, 'a newer schema');
await refuses({ format: 'bagra-backup', schemaVersion: 1, data: { trials: [{ title: 'no id' }] } },
              'a record with no key');

// And the destructive path must not have run on the way past.
const survived = await ids('trials');
is(survived.length > 0, true, 'a refused file left the database alone');

console.log(failed ? '\nBACKUP RESTORE CHECK FAILED' : '\nall held');
process.exit(failed ? 1 : 0);

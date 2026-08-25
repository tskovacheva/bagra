// migrations.js — the historical repairs, and the record of which have run.
//
// Their own file rather than functions inside app.js, for the reason
// migrate-actions and migrate-photos give: nothing here touches the DOM, so
// each pass can be run and checked on its own instead of only as a side effect
// of booting the whole application. A migration that can only be exercised by
// starting the program is a migration nobody exercises.

import { all, get, putMigration, getSetting, setSetting } from './db.js';
import { migrateAll } from './migrate-actions.js';
import { migratePlantPhotos } from './migrate-photos.js';

// ---------------------------------------------------------------- migrations
//
// A repair runs once, not at every start (§13cw).
//
// `healDoubleStateEvents` and `migrateFabricActions` each walked every piece of
// cloth on every single opening of the application, for ever, to establish that
// there was nothing left to do. Both were written to be safe to re-run and both
// were — but „safe" is not „free", and a pass that can only ever do nothing is
// a pass that should not be made.
//
// The marker is a CONTROL, not a substitute for the migration being idempotent.
// Both remain safe to run twice by hand, and the guard checks that they are:
// a marker that has become load-bearing is a marker one bad restore away from
// corrupting a database.
//
// WHY `if (marker) return` IS NOT ENOUGH ON ITS OWN.
//
// A snapshot restore brings back a whole database as it was (§11.4), and that
// includes `settings` — so restoring a backup taken before a migration restores
// the state before it AND the absence of its marker together. The marker is
// data, and it travels with the data it describes. Restore an old file and the
// migration becomes eligible again, because the copy of the marker in that file
// says it never ran. Nothing extra was needed for this: it falls out of the
// snapshot being a snapshot, and the guard asserts it rather than assuming it.
//
// The marker is written ONLY after the migration returns. A pass that throws
// leaves no marker and will be tried again — which is the whole reason it is
// written at the end and not at the beginning.
const MIGRATIONS = 'migrations';

async function runOnce(name, version, fn) {
  const state = (await getSetting(MIGRATIONS, null)) || {};
  if (state[name] >= version) return false;
  await fn();
  // Re-read: `fn` may itself have written settings, and a stale copy here would
  // quietly discard it.
  const now = (await getSetting(MIGRATIONS, null)) || {};
  await setSetting(MIGRATIONS, { ...now, [name]: version });
  return true;
}

// Exposed for the guard, which has to prove that a pass which throws leaves no
// marker — and the only honest way to prove it is to run one that throws.
export const runOnceForTest = runOnce;

export async function runMigrations() {
  // Order matters and is the reason these are not two independent markers run
  // in any order: migrating first would copy the duplicates into the new list.
  await runOnce('doubleStateEvents', 1, healDoubleStateEvents);
  await runOnce('fabricActions', 1, migrateFabricActions);
  await runOnce('plantPhotos', 1, migratePlantPhotos);
}


// One work, one mark on a piece — repairing what the fault already wrote.
//
// Finishing pushed a state event every time screen 4 was saved, and the date
// opened at today, so editing the result of an old piece of work stamped the
// piece a second time with today's date (§13au). Three pieces in the owner's
// own diary claim to have been finished twice.
//
// The earliest of the duplicates is kept, because the later one is always the
// re-visit: the original carries the day she chose, the duplicate carries the
// day she happened to open the record. That date is also the honest answer to
// "when did this work finish", so it fills `finishedOn` where the work has
// none — which recovers dates that were otherwise lost.
//
// Idempotent: with no duplicates left it changes nothing and says nothing.
export async function healDoubleStateEvents() {
  const trials = await all('trials');
  const byId = new Map(trials.map(tr => [tr.id, tr]));
  let pieces = 0;

  for (const f of await all('fabrics')) {
    const events = f.stateEvents || [];
    const seen = new Map();
    const keep = [];
    let dropped = 0;

    for (const e of events) {
      if (!e.trialId) { keep.push(e); continue; }
      const prev = seen.get(e.trialId);
      if (!prev) { seen.set(e.trialId, e); keep.push(e); continue; }
      // Whichever is earlier is the one that was meant.
      if ((e.date || '') < (prev.date || '')) {
        prev.date = e.date;
        prev.stateCode = e.stateCode || prev.stateCode;
      }
      dropped++;
    }

    if (!dropped) continue;
    f.stateEvents = keep;   // legacy: repairs records written before §13bd
    // Structural (§13cv): reshaping the list is not something that happened to
    // the cloth, and stamping it would move a piece last touched two summers
    // ago to the top of every list ordered by recency.
    await putMigration('fabrics', f);
    pieces++;
  }

  // The recovered dates, applied only where the work has none of its own.
  for (const f of await all('fabrics')) {
    for (const e of f.stateEvents || []) {
      const tr = e.trialId && byId.get(e.trialId);
      if (tr && !tr.finishedOn && e.date) {
        tr.finishedOn = e.date;
        // Recovering a date the record had lost is a repair, not an edit.
        await putMigration('trials', tr);
      }
    }
  }

  if (pieces) console.info(`healed doubled state events on ${pieces} piece(s)`);
}


// `stateEvents` become `actions`, and each batch becomes a record of its own
// (§13bd). Runs at every boot and is a no-op once done.
//
// The old list is NOT removed. Migrations only add, and for a fortnight the two
// lists coexist deliberately: `actions` is the only one the application reads
// or writes, and `stateEvents` stays as a way back if the mapping turns out to
// be wrong. It comes out in a later version, on purpose, not by drift.
//
// Ordered after `healDoubleStateEvents` and not before it: migrating first
// would copy the duplicates into the new list and the repair would then only
// fix the old one, leaving the two disagreeing about how many times a piece
// was finished.
export async function migrateFabricActions() {
  const fabrics = await all('fabrics');
  const { fabrics: migrated, batches, report } = migrateAll(fabrics);
  if (!report.actions && !fabrics.some(f => !Array.isArray(f.actions))) return;

  let touched = 0;
  for (let i = 0; i < fabrics.length; i++) {
    if (Array.isArray(fabrics[i].actions)) continue;
    await putMigration('fabrics', migrated[i]);
    touched++;
  }
  for (const b of batches) {
    // `add` semantics by hand: a batch whose id already exists was written by
    // an earlier run, and overwriting it would discard a weight or a deviation
    // she has since filled in by hand.
    if (await get('batchActions', b.id)) continue;
    // A batch reconstructed from an event dated two summers ago is not new work
    // (§13cv). It takes the time of what it was built from, so the recency of
    // her cloth is not rearranged by the order a migration happened to convert
    // things in. Where the source carried no date there is nothing to inherit,
    // and the conversion is the only time it can honestly claim.
    await putMigration('batchActions',
      { ...b, updatedAt: b.updatedAt || b.createdAt || b.date || new Date().toISOString() });
  }

  if (touched) {
    console.info(`migrated ${report.actions} action(s) on ${touched} piece(s), ` +
                 `${batches.length} batch(es)`);
  }
}

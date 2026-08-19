// migrate-actions.js — stateEvents become actions, and every action belongs to
// something (§13bd).
//
// Pure and DOM-free so it can be run against a backup file before it is ever
// run against a database. Nothing here reads or writes IndexedDB; app.js calls
// `migrateFabric` at boot and stores the result.
//
// The rule the migration exists to establish:
//
//   an action belongs to a batch OR to a trial, never to neither.
//
// A single piece scoured on its own is a batch of one. That is not ceremony —
// it means there is one shape of record, one writer, and one invariant a guard
// can check, instead of two paths that will drift.
//
// MIGRATIONS ONLY ADD. `stateEvents` is left exactly where it is. The new
// `actions` list is written beside it and is what the application reads. If
// this turns out to be wrong, the old list is still there to read.

// What a state code meant, as an action. Five, because that is all that has
// ever been written: the live database holds `scoured`, `mordanted` and
// `finished` and nothing else, and `tanned` was never used at all.
export const ACTION_FOR_STATE = {
  unwashed:  null,        // not an action — the absence of one
  scoured:   'wash',
  tanned:    'tannin',
  mordanted: 'mordant',
  dyed:      'dye',
  finished:  'finish',
};

// The eight a person chooses from. `dye` and `finish` are deliberately absent:
// they are written by a trial when work is finished (§13an), never picked from
// a chip row.
export const MANUAL_ACTIONS = [
  'wash', 'tannin', 'mordant', 'neutralise', 'iron', 'soy', 'bleach', 'other',
];

// Which actions move a piece from one box to another. The five that do not are
// carried as labels on the piece: tannin is a route, not a stop on the way to
// alum (§13bd), and an iron afterbath does not take a dyed piece out of the
// dyed box.
export const MOVES_BOX = {
  wash: 'scoured',
  mordant: 'mordanted',
  dye: 'dyed',
  finish: 'finished',
};

export const boxAfter = (actionCode) => MOVES_BOX[actionCode] || null;
export const movesBox = (actionCode) => Boolean(MOVES_BOX[actionCode]);

// A batch id that is stable across runs, so migrating the same backup twice
// produces the same ids rather than a second set of batches. Derived from the
// event it came from, which already has one.
const batchIdFor = (eventId) => 'batch-' + eventId;

/**
 * One fabric in, the same fabric out with `actions` filled.
 *
 * Idempotent: a record that already has `actions` is returned untouched, so
 * this can run at every boot without accumulating.
 *
 * Returns `{ fabric, batches }` — the batches are new top-level records and
 * have to be stored by the caller. They are not embedded in the fabric,
 * because a batch spans several fabrics and embedding it would mean five
 * copies of one bath, which is the whole thing this section exists to prevent.
 */
export function migrateFabric(fabric) {
  const batches = [];
  if (!fabric || Array.isArray(fabric.actions)) return { fabric, batches };

  const events = fabric.stateEvents || [];
  const actions = [];

  for (const e of events) {
    const actionCode = ACTION_FOR_STATE[e.stateCode];

    // A state code nobody wrote an action for. Rather than guess, keep the
    // event as an action of unknown type carrying its original code, so it is
    // visible in the history and can be corrected by hand. Dropping it would
    // lose a dated fact; inventing an action for it would manufacture one.
    const code = actionCode || 'other';

    const action = {
      id: e.id,
      fabricId: fabric.id,
      actionCode: code,
      // Kept so nothing is lost and so a wrongly-mapped row can be found later.
      fromStateCode: e.stateCode || null,
      date: e.date || null,
      recipeId: e.recipeId || null,
      chainId: null,
      trialId: e.trialId || null,
      batchId: null,
      note: e.note || '',
      deviation: '',
      observation: '',
      createdAt: e.createdAt || fabric.createdAt || null,
      migrated: true,
    };

    // An action written by a trial already has its shared context: the trial
    // spans the pieces through `fabricIds`. Giving it a batch as well would be
    // a second answer to the same question.
    if (!action.trialId) {
      action.batchId = batchIdFor(e.id);
      batches.push({
        id: action.batchId,
        actionCode: code,
        date: action.date,
        recipeId: action.recipeId,
        chainId: null,
        fabricIds: [fabric.id],
        // Not the fabric's weight. The bath was scaled against something, and
        // what that was is not recorded anywhere — writing the piece's own
        // weight here would state a measurement nobody took (§13d).
        totalWeightG: null,
        deviation: '',
        note: action.note,
        migrated: true,
      });
    }

    actions.push(action);
  }

  return { fabric: { ...fabric, actions }, batches };
}

/**
 * The whole set. Returns the migrated fabrics, the batches to store, and a
 * report — the report is the point when this is run against a backup by hand.
 */
export function migrateAll(fabrics = []) {
  const out = [], batches = [], counts = {}, unmapped = [];

  for (const f of fabrics) {
    const r = migrateFabric(f);
    out.push(r.fabric);
    batches.push(...r.batches);
    for (const a of r.fabric.actions || []) {
      counts[a.actionCode] = (counts[a.actionCode] || 0) + 1;
      if (a.actionCode === 'other' && a.fromStateCode) unmapped.push(a);
    }
  }

  return {
    fabrics: out,
    batches,
    report: {
      fabrics: fabrics.length,
      actions: Object.values(counts).reduce((a, b) => a + b, 0),
      byAction: counts,
      batches: batches.length,
      unmapped,
    },
  };
}

// `boxOf` and `treatmentsOf` used to live here and now live in fabric-logic.js,
// which is where every screen already looks for the arithmetic of a piece. Two
// homes for one question is how the two answers start to differ.

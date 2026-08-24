// db.js — IndexedDB is the single source of truth (§11.1).
// Migrations only ever ADD. Nothing is renamed or removed, ever.

const DB_NAME = 'bagra';
const DB_VERSION = 9;   // 8: the glossary store (§13bt); 9: pigmentBatches (§13bx)

// Every top-level entity from §13 gets a store. Nested lists (steps,
// placements, state events) are embedded in their parent, not stored apart.
export const STORES = {
  fabrics:      { keyPath: 'id', indexes: ['state', 'origin', 'updatedAt'] },
  substances:   { keyPath: 'id', indexes: ['category', 'updatedAt'] },
  stock:        { keyPath: 'id', indexes: ['substanceId', 'updatedAt'] },
  plants:       { keyPath: 'id', indexes: ['nameBotanical', 'updatedAt'] },
  recipes:      { keyPath: 'id', indexes: ['type', 'lineageId', 'updatedAt'] },
  chains:       { keyPath: 'id', indexes: ['updatedAt'] },
  sources:      { keyPath: 'id', indexes: ['kind', 'updatedAt'] },
  glossary:     { keyPath: 'id', indexes: ['group', 'updatedAt'] },
  pigmentBatches: { keyPath: 'id', indexes: ['plantId', 'status', 'updatedAt'] },
  techniques:   { keyPath: 'id', indexes: ['category'] },
  combinations: { keyPath: 'id', indexes: ['confidence', 'updatedAt'] },
  trials:       { keyPath: 'id', indexes: ['date', 'processCode', 'updatedAt'] },
  // One real bath, not one row per piece (§13bd). Five pieces in one mordant
  // bath share a weight, a recipe and a deviation; copying those onto five
  // records loses the fact that the bath was shared and invents a per-piece
  // share of the mordant that nobody weighed out.
  batchActions: { keyPath: 'id', indexes: ['actionCode', 'date', 'updatedAt'] },
  photos:       { keyPath: 'id', indexes: ['ownerType', 'ownerId'] },
  // Key is dimension + code, never code alone: the same code legitimately
  // appears in several dimensions (`mordant` is a substance category, a recipe
  // type AND a step type). Keyed on code alone they overwrite one another.
  vocabulary:   { keyPath: 'key', indexes: ['dimension', 'code'] },
  bands:        { keyPath: 'key', indexes: ['dimension', 'code'] },
  settings:     { keyPath: 'key' },
};

let _db = null;

export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      // v1 — initial creation. Later versions append their own blocks below
      // and never touch this one.
      // v3 — vocabulary and bands were keyed on `code` alone, which silently
      // dropped every term whose code exists in more than one dimension. They
      // hold only seed data, regenerated on next start, so recreating them
      // loses nothing the user wrote.
      // v6 — vocabulary labels revised. The store holds only seed data,
      // regenerated on the next start, so recreating it loses nothing.
      // v7 — `batchActions` added, and `fabric_state` lost `tanned` while
      // `fabric_action` arrived. Both vocabulary changes ride on the deletion
      // below; the new store is created by the loop, which only ever adds.
      if (e.oldVersion < 7) {
        for (const name of ['vocabulary', 'bands']) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        }
      }
      // The v6 block did the same deletion and is subsumed by v7: anything
      // that would have matched `oldVersion < 6` matches `< 7` too. Two blocks
      // deleting one store is a second thing to keep in step for no gain.

      // Otherwise migrations only ever ADD. Creating a store that already
      // exists is skipped rather than replaced, so user data is never touched.
      for (const [name, def] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: def.keyPath });
        for (const idx of def.indexes || []) {
          store.createIndex(idx, idx, { unique: false });
        }
      }
    };

    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return open().then(db => db.transaction(store, mode).objectStore(store));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

// Provenance fields every record carries (§13.1). `distributable` defaults to
// false: material derived from a published source is fine to hold locally and
// is not automatically ours to redistribute.
export function newRecord(extra = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    origin: 'user',
    packId: null,
    packVersion: null,
    editedByUser: false,
    editedFields: [],
    // There is no `learnedFrom`, and no `sourceRef`. Attribution lives in the
    // Sources section, not on the record — §13r. A field that holds one answer
    // cannot describe a chain of retellings, and one that cannot be right is
    // worse than one that is absent, because it looks like traceability.
    // Redistributable unless there is a real reason not to be: proportions and
    // sequences are facts, not authored works (§13.1).
    distributable: true,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

export async function all(store)      { return wrap((await tx(store)).getAll()); }
export async function get(store, id)  { return wrap((await tx(store)).get(id)); }

// ---- the three write paths ------------------------------------------------
//
// One `put` did three things at once, and two of them were wrong for most of
// its callers. Every write stamped `updatedAt` with the current time, and every
// write counted as an edit the user had not backed up. That is right for a
// woman saving a trial and wrong for everything else that writes: a seed pack,
// a migration, a repair, a restore.
//
// Two independent questions, so two independent flags:
//
//   stamp — is this an edit being made NOW? A restore is not: the file says
//           when the record was last touched and that is the fact. Stamping it
//           with today's date destroys the only evidence of when the work
//           happened, and does it silently.
//   count — is this the USER'S work, not yet in a backup file? A seeded plant
//           is not. Before this split, a first install wrote several hundred
//           records through `put` and the counter read like several hundred
//           unsaved edits before she had typed anything.
//
// Three of the four combinations are meaningful and each has a name. The
// fourth — count without stamp — has no caller and is not offered.
async function write(store, record, { stamp, count }) {
  if (stamp) record.updatedAt = new Date().toISOString();
  await wrap((await tx(store, 'readwrite')).put(record));
  if (count) await bumpChangeCounter();
  return record;
}

/** A person edited something. Stamps the time and counts against the backup. */
export async function put(store, record) {
  return write(store, record, { stamp: true, count: true });
}

/**
 * The application wrote something on its own account — a seed pack, a pack
 * update, a migration, a repair. It happened now, so it is stamped; it is not
 * her work, so it is not counted.
 */
export async function putSystem(store, record) {
  return write(store, record, { stamp: true, count: false });
}

/**
 * A record restored verbatim from a file. Nothing is stamped and nothing is
 * counted: the record's own `createdAt` and `updatedAt` came out of the backup
 * and are what it is being restored TO.
 */
export async function putRaw(store, record) {
  return write(store, record, { stamp: false, count: false });
}

// Deleting a trial is her work leaving the database, and it did not count at
// all — so the surest way to have unbacked-up changes read as zero was to
// spend the afternoon deleting things.
export async function remove(store, id) {
  await wrap((await tx(store, 'readwrite')).delete(id));
  await bumpChangeCounter();
}

/** A withdrawal performed by a pack update. Not her doing, so not counted. */
export async function removeSystem(store, id) {
  return wrap((await tx(store, 'readwrite')).delete(id));
}

/**
 * Replace the contents of whole stores with what a file holds — the snapshot
 * half of a restore (§11.4).
 *
 * ONE transaction across every store involved. `clear()` and every `put()` are
 * queued against it synchronously, so either the whole restore lands or the
 * transaction aborts and the database is exactly as it was. The failure this
 * exists to make impossible is `clear → half the records → error`, which would
 * leave a person with less than she started with and a success message on the
 * screen.
 *
 * Nothing is stamped and nothing is counted, for the reason `putRaw` gives.
 *
 * Only the stores PRESENT in `data` are touched. A backup written by an older
 * schema does not carry the newer stores, and clearing those would read a gap
 * in the file as an instruction to delete — a migration that guesses, in the
 * other direction.
 */
export async function replaceStores(data) {
  const db = await open();
  const names = Object.keys(data).filter(n => STORES[n]);
  if (!names.length) return { stores: [], written: 0, cleared: 0 };

  return new Promise((resolve, reject) => {
    const t = db.transaction(names, 'readwrite');
    let written = 0;
    t.oncomplete = () => resolve({ stores: names, written });
    t.onerror   = () => reject(t.error || new Error('restore failed'));
    t.onabort   = () => reject(t.error || new Error('restore aborted'));

    try {
      for (const name of names) {
        const store = t.objectStore(name);
        store.clear();
        for (const row of data[name] || []) { store.put(row); written++; }
      }
    } catch (err) {
      // A row the store refuses — no key, wrong shape — throws here rather
      // than firing an error event. Aborting by hand keeps the promise's
      // contract: this function either restores everything or nothing.
      try { t.abort(); } catch { /* already gone */ }
      reject(err);
    }
  });
}

// Favourites (§13.1). Personal, never travels in a pack: a working set of six
// out of forty is what a reference consulted daily actually looks like.
// Toggled straight against the store rather than through the open draft, so a
// star can be clicked from a list without loading the record into a form.
export async function toggleFavorite(store, id) {
  const record = await get(store, id);
  if (!record) return null;
  record.favorite = !record.favorite;
  await put(store, record);
  return record.favorite;
}

export async function byIndex(store, index, value) {
  return wrap((await tx(store)).index(index).getAll(value));
}

export async function count(store) { return wrap((await tx(store)).count()); }

// ---- settings -------------------------------------------------------------

export async function getSetting(key, fallback = null) {
  const row = await get('settings', key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const store = await tx('settings', 'readwrite');
  return wrap(store.put({ key, value }));
}

// Counts THE USER'S edits since the last export, so the backup reminder can be
// honest about how much would be lost — the Глина lesson.
//
// Only `put` and `remove` reach here. Seeding, pack updates, migrations,
// repairs and restores go through `putSystem`, `putRaw`, `removeSystem` or
// `replaceStores` and are deliberately invisible to it: none of them is work
// that would be lost, because every one of them can be performed again from a
// file that already exists.
async function bumpChangeCounter() {
  const n = await getSetting('changeCounter', 0);
  await setSetting('changeCounter', n + 1);
}

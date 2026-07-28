// db.js — IndexedDB is the single source of truth (§11.1).
// Migrations only ever ADD. Nothing is renamed or removed, ever.

const DB_NAME = 'bagra';
const DB_VERSION = 1;

// Every top-level entity from §13 gets a store. Nested lists (steps,
// placements, state events) are embedded in their parent, not stored apart.
export const STORES = {
  fabrics:      { keyPath: 'id', indexes: ['state', 'origin', 'updatedAt'] },
  materials:    { keyPath: 'id', indexes: ['category', 'updatedAt'] },
  plants:       { keyPath: 'id', indexes: ['nameBotanical', 'updatedAt'] },
  recipes:      { keyPath: 'id', indexes: ['type', 'lineageId', 'updatedAt'] },
  techniques:   { keyPath: 'id', indexes: ['category'] },
  combinations: { keyPath: 'id', indexes: ['confidence', 'updatedAt'] },
  trials:       { keyPath: 'id', indexes: ['date', 'processCode', 'updatedAt'] },
  photos:       { keyPath: 'id', indexes: ['ownerType', 'ownerId'] },
  vocabulary:   { keyPath: 'code', indexes: ['dimension'] },
  bands:        { keyPath: 'code', indexes: ['dimension'] },
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
      if (e.oldVersion < 1) {
        for (const [name, def] of Object.entries(STORES)) {
          const store = db.createObjectStore(name, { keyPath: def.keyPath });
          for (const idx of def.indexes || []) {
            store.createIndex(idx, idx, { unique: false });
          }
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
    sourceRef: null,
    distributable: false,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

export async function all(store)      { return wrap((await tx(store)).getAll()); }
export async function get(store, id)  { return wrap((await tx(store)).get(id)); }
export async function remove(store, id){ return wrap((await tx(store, 'readwrite')).delete(id)); }

export async function put(store, record) {
  record.updatedAt = new Date().toISOString();
  await wrap((await tx(store, 'readwrite')).put(record));
  await bumpChangeCounter();
  return record;
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

// Counts edits since the last export, so the backup reminder can be honest
// about how much would be lost — the Глина lesson.
async function bumpChangeCounter() {
  const n = await getSetting('changeCounter', 0);
  await setSetting('changeCounter', n + 1);
}

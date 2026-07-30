// seed.js — loading the shipped reference library (§10).
//
// Lives on its own rather than in app.js: modules need it, and app.js imports
// the modules, so keeping it there made a circular dependency — app importing
// plants importing app. It worked by accident of hoisting until it did not.

import { all, get, put } from './db.js';

/**
 * Adds seeded records that are absent, and touches nothing else.
 *
 * Safe to run at any time. A record the user has edited keeps its own id, so
 * re-running can never overwrite her work; and a base library that goes
 * missing after a deploy can be restored without wiping the database.
 *
 * @returns {Promise<number>} how many records were added
 */
export async function seedPack(file, store, listKey, defaults = {}) {
  let added = 0;
  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);

  const pack = await res.json();
  const rows = pack[listKey];
  if (!Array.isArray(rows)) throw new Error(`${file}: no "${listKey}" list`);

  const existing = new Set((await all(store)).map(r => r.id));

  for (const row of rows) {
    const id = 'seed:' + row.code;
    if (existing.has(id)) continue;
    const { code, ...rest } = row;
    await put(store, {
      id,
      origin: 'seed',
      packId: pack.packId,
      packVersion: pack.packVersion,
      editedByUser: false,
      editedFields: [],
      createdAt: new Date().toISOString(),
      ...defaults,
      ...rest,
    });
    added++;
  }
  return added;
}

export const PACKS = {
  substances: {
    file: 'seed/substances.json', store: 'substances', listKey: 'substances',
    defaults: { suitableFibreClasses: [], handling: [] },
  },
  plants: {
    file: 'seed/plants.json', store: 'plants', listKey: 'plants',
    defaults: { harvestMonths: [], colours: [], photoData: null },
  },
};

export function loadPack(name) {
  const p = PACKS[name];
  return seedPack(p.file, p.store, p.listKey, p.defaults);
}


/**
 * Bring seeded records up to date with the shipped pack.
 *
 * The merge policy from §10, finally enforced: an untouched seeded record is
 * replaced by the newer version; one the user has edited is left alone and
 * reported. Records she created herself are never involved — they carry their
 * own ids and the pack has nothing to say about them.
 *
 * @returns {Promise<{added:number, updated:number, kept:string[]}>}
 *          `kept` names the edited records that were deliberately not touched.
 */
export async function refreshPack(name) {
  const { file, store, listKey, defaults } = PACKS[name];

  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  const pack = await res.json();

  let added = 0, updated = 0;
  const kept = [];

  for (const row of pack[listKey]) {
    const id = 'seed:' + row.code;
    const existing = await get(store, id);
    const { code, ...rest } = row;

    if (existing?.editedByUser) {
      kept.push(nameOf(existing));
      continue;
    }

    await put(store, {
      ...(existing || {}),
      id,
      origin: 'seed',
      packId: pack.packId,
      packVersion: pack.packVersion,
      editedByUser: false,
      editedFields: [],
      createdAt: existing?.createdAt || new Date().toISOString(),
      ...defaults,
      ...rest,
    });
    existing ? updated++ : added++;
  }

  return { added, updated, kept };
}

function nameOf(record) {
  const n = record.nameCommon || record.name;
  if (!n) return record.id;
  return typeof n === 'string' ? n : (n.bg || n.en || record.id);
}

/**
 * Marks a seeded record as the user's own, so a later pack update leaves it
 * alone. Called on save; harmless for records she created herself.
 */
export function markEdited(record) {
  if (record.origin === 'seed') record.editedByUser = true;
  return record;
}

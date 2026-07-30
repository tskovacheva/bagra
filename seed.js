// seed.js — loading the shipped reference library (§10).
//
// Lives on its own rather than in app.js: modules need it, and app.js imports
// the modules, so keeping it there made a circular dependency — app importing
// plants importing app. It worked by accident of hoisting until it did not.

import { all, put } from './db.js';

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

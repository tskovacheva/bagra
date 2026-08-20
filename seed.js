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
      ...defaults,
      id,
      origin: 'seed',
      packId: pack.packId,
      packVersion: pack.packVersion,
      editedByUser: false,
      editedFields: [],
      createdAt: new Date().toISOString(),
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
  techniques: {
    file: 'seed/techniques.json', store: 'techniques', listKey: 'techniques',
    defaults: { appliesTo: [], distributable: true },
  },
  combinations: {
    file: 'seed/combinations.json', store: 'combinations', listKey: 'combinations',
    defaults: { influences: [] },
  },
  plants: {
    file: 'seed/plants.json', store: 'plants', listKey: 'plants',
    defaults: { harvestMonths: [], colours: [], photoData: null },
  },
  // Attribution for the whole library, in one place — §13r. Seeded rather than
  // left to the owner because a library that credits nobody is worse than one
  // that credits imperfectly, and the six here are attested.
  sources: {
    file: 'seed/sources.json', store: 'sources', listKey: 'sources',
    defaults: { kind: 'other', author: '', url: '' },
  },
  // The words of the craft (§13bt). Only terms that are NOT codes in the
  // model: a code carries its explanation in vocab.js and the Library merges
  // those in at render time, so nothing here restates one. Deep-check 24d
  // fails the build if that line is ever crossed.
  glossary: {
    file: 'seed/glossary.json', store: 'glossary', listKey: 'terms',
    defaults: { group: 'process', aliases: [], seeAlso: [], sourceCode: '' },
  },
  // Three recipes, and the set is chosen to demonstrate the distinction it
  // rests on (§13by): the pigment recipe has `output: 'pigment'` and is
  // WORKED — batches come out of it — while watercolour and pastels have
  // `output: 'none'` and are read and followed without keeping a record.
  // Shipping only the first would leave the distinction with nothing to show
  // itself on, and shipping none left the batch screen's recipe list empty,
  // which reads as broken rather than as unseeded.
  recipes: {
    file: 'seed/recipes.json', store: 'recipes', listKey: 'recipes',
    defaults: {
      output: 'none', appliesTo: [], scaleBy: 'raw', version: 1,
      ingredients: [], steps: [], requiredFollowOn: [], distributable: true,
    },
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


// ---------------------------------------------------------------- diffing

const IGNORED = new Set([
  'id', 'origin', 'packId', 'packVersion', 'editedByUser', 'editedFields',
  'createdAt', 'updatedAt', 'distributable',
]);

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What a pack update would actually do, worked out before anything is written.
 *
 * §10 asks for a merge with a preview rather than a silent apply, and this is
 * that: three lists the user can look at and choose from. Nothing here touches
 * the database.
 */


/**
 * What a pack would do, before anything is written (§10).
 *
 * Three groups, because they deserve different defaults: records that do not
 * exist yet, seeded records the pack would revise, and seeded records the user
 * has edited — which are offered but left unticked, since protecting her work
 * is the safer default.
 */
export async function diffPack(name) {
  const { file, store, listKey, defaults } = PACKS[name];

  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  const pack = await res.json();

  const diff = { store, pack, defaults, added: [], changed: [], edited: [], unchanged: [] };

  for (const row of pack[listKey]) {
    const id = 'seed:' + row.code;
    const existing = await get(store, id);
    const { code, ...incoming } = row;

    if (!existing) {
      diff.added.push({ id, name: nameOf(incoming), row: incoming, isNew: true });
      continue;
    }

    const fields = Object.entries(incoming)
      .filter(([k, v]) => JSON.stringify(existing[k]) !== JSON.stringify(v))
      .map(([k]) => k);

    if (!fields.length) { diff.unchanged.push(id); continue; }

    const entry = { id, name: nameOf(existing), fields, row: incoming };
    (existing.editedByUser ? diff.edited : diff.changed).push(entry);
  }

  return diff;
}

/**
 * Writes the chosen entries.
 *
 * Only the fields the pack actually carries are touched. Anything personal
 * living alongside them — a photograph, a hand-filled dose, a note — survives.
 * An earlier version applied the store's defaults over the existing record and
 * quietly erased photographs; hence defaults are used for new records only.
 */
export async function applyDiff(store, entries, pack) {
  const defaults = Object.values(PACKS).find(p => p.store === store)?.defaults || {};
  let n = 0;

  for (const entry of entries) {
    const existing = await get(store, entry.id);

    if (!existing) {
      await put(store, {
        ...defaults,
        id: entry.id,
        origin: 'seed',
        packId: pack.packId,
        packVersion: pack.packVersion,
        editedByUser: false,
        editedFields: [],
        createdAt: new Date().toISOString(),
        ...entry.row,
      });
    } else {
      await put(store, {
        ...existing,
        packId: pack.packId,
        packVersion: pack.packVersion,
        ...entry.row,
      });
    }
    n++;
  }
  return n;
}

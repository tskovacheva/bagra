// refs.js — who points at this record, and may it therefore be deleted (§13cq).
//
// THE FAULT THIS EXISTS FOR.
//
// Six modules offered a plain physical delete — recipes, plants, techniques,
// fabrics, combinations, chains — while other records held their ids. Nothing
// checked. Delete the tannin recipe and every trial that used it still says it
// used *something*: the step is there, the id is there, and the lookup that
// resolves it returns nothing, so the screen renders „—". The history survives
// in shape and loses its meaning, quietly, at the moment it is least likely to
// be noticed.
//
// It is worst on recipes, because the model already has versioning for exactly
// this reason: a past trial goes on pointing at the version actually used, so
// improving a recipe never rewrites what happened. Physical deletion of that
// version defeats the whole mechanism.
//
// THE RULE (§13.1, restated): NO BACK-REFERENCES ARE STORED. A record does not
// know who points at it, and nothing here changes that — the answer is derived
// by reading the pointing stores on demand. It costs a pass over a few stores
// at the moment somebody presses delete, which is the only moment it is needed.
//
// NO CASCADE, EVER. `delete recipe → delete the steps that used it` and
// `delete plant → blank every plantId` both turn an explicit act into silent
// data loss. The only two answers here are „nothing points at this" and „these
// do".

import { all, get, STORES } from './db.js';

// WHAT NAMES A RECORD OF THIS KIND.
//
// Almost everything is named by its `id`. Sources are not: a seeded source has
// the id `seed:boutrup-ellis`, and the records that credit it write
// `sourceCode: 'boutrup-ellis'` — the CODE, without the prefix. Attribution was
// written that way deliberately (§13bt), so that a credit survives a record
// being reseeded, and turning every source reference into an id would be a
// model migration this iteration has no reason to perform.
//
// So the checker takes the key from the target rather than assuming `id`. Every
// other entity keeps the identity function and behaves exactly as before.
const TARGET_KEY = {
  sources: (row) => row.code ?? String(row.id || '').replace(/^seed:/, ''),
};
const keyOf = (store, row) => (TARGET_KEY[store] ? TARGET_KEY[store](row) : row.id);

// Where the ids live, written out rather than discovered, because a path this
// file does not know about is a path that silently permits a delete. Each entry
// says: which store holds the pointers, and how to count the ones aimed at a
// given id.
//
// `label` is a translation key so the count can be read as a sentence rather
// than as a store name.
const INCOMING = {
  recipes: [
    { store: 'trials',       label: 'refs.trials',   count: (r, id) => (r.steps || []).filter(s => s.recipeId === id).length },
    { store: 'fabrics',      label: 'refs.fabrics',  count: (r, id) => (r.actions || []).filter(a => a.recipeId === id).length },
    { store: 'batchActions', label: 'refs.batches',  count: (r, id) => (r.recipeId === id ? 1 : 0) },
    { store: 'chains',       label: 'refs.chains',   count: (r, id) => (r.steps || []).filter(s => s.recipeId === id).length },
  ],
  chains: [
    { store: 'trials',       label: 'refs.trials',   count: (r, id) => (r.steps || []).filter(s => s.chainId === id).length },
    { store: 'fabrics',      label: 'refs.fabrics',  count: (r, id) => (r.actions || []).filter(a => a.chainId === id).length },
    { store: 'batchActions', label: 'refs.batches',  count: (r, id) => (r.chainId === id ? 1 : 0) },
  ],
  plants: [
    { store: 'trials',         label: 'refs.trials',    count: (r, id) => (r.placements || []).filter(p => p.plantId === id).length },
    { store: 'combinations',   label: 'refs.combos',    count: (r, id) => (r.key?.dyeSource?.plantId === id ? 1 : 0) },
    { store: 'pigmentBatches', label: 'refs.pigments',  count: (r, id) => (r.plantId === id ? 1 : 0) },
    // A recipe ingredient may name a plant instead of a substance — the option
    // carries `plantId` and a `partCode` beside it (§13.1). Missed on the first
    // pass of this inventory, which is why the paths are written out.
    { store: 'recipes',        label: 'refs.recipes',   count: (r, id) =>
        (r.ingredients || []).reduce((n, ing) =>
          n + (ing.options || []).filter(o => o.plantId === id).length, 0) },
  ],
  techniques: [
    { store: 'trials', label: 'refs.trials', count: (r, id) => ((r.techniqueIds || []).includes(id) ? 1 : 0) },
  ],
  combinations: [
    { store: 'trials', label: 'refs.trials', count: (r, id) => (r.placements || []).filter(p => p.combinationId === id).length },
  ],
  fabrics: [
    { store: 'trials',       label: 'refs.trials',  count: (r, id) => ((r.fabricIds || []).includes(id) ? 1 : 0) },
    { store: 'batchActions', label: 'refs.batches', count: (r, id) => ((r.fabricIds || []).includes(id) ? 1 : 0) },
  ],
  // Not in the audit's list and real all the same: a substance is named by every
  // recipe ingredient option that fills a role with it, and by every jar on the
  // shelf. Deleting one leaves a recipe whose ingredient has no substance —
  // exactly the recipe fault, one level down.
  substances: [
    { store: 'recipes', label: 'refs.recipes', count: (r, id) =>
        (r.ingredients || []).reduce((n, ing) =>
          n + (ing.options || []).filter(o => o.substanceId === id).length, 0) },
    { store: 'stock',   label: 'refs.stock',   count: (r, id) => (r.substanceId === id ? 1 : 0) },
  ],
  // ATTRIBUTION IS PART OF THE HISTORY TOO (§13ct). A source is not a workflow
  // record and deleting one does the same damage: the claim stays, the credit
  // it rests on is gone, and a knowledge record goes on naming a source that no
  // longer exists. For a library meant to be given away that is also a licence
  // problem, not only an integrity one.
  //
  // Matched on the CODE, not the id — see TARGET_KEY above.
  sources: [
    { store: 'glossary', label: 'refs.glossary', count: (r, code) => (r.sourceCode === code ? 1 : 0) },
    { store: 'recipes',  label: 'refs.recipes',  count: (r, code) => (r.sourceCode === code ? 1 : 0) },
    // Not in the audit's list and real: every colour swatch on a plant credits
    // where the colour was read from. 57 plants carry these, and four of the ten
    // sources are named only here.
    { store: 'plants',   label: 'refs.colours',  count: (r, code) =>
        (r.colours || []).filter(c => c.source === code).length },
  ],
  // A trial WRITES actions onto cloth (§13an), and those actions carry its id.
  // Deleting the trial would leave a piece of cloth saying it was dyed by
  // something that no longer exists.
  trials: [
    { store: 'fabrics', label: 'refs.fabrics', count: (r, id) => (r.actions || []).filter(a => a.trialId === id).length },
  ],
};

/**
 * Who points at this record.
 *
 * @returns {Promise<{total:number, byStore:Array<{store,label,records,count}>}>}
 *   `records` is how many records in that store point at it; `count` is how many
 *   pointers there are altogether, which can be larger — one trial may use the
 *   same recipe at three steps.
 *
 * A record never counts itself: `INCOMING` never lists a store as pointing at
 * its own kind, and where a store could hold both (a chain step naming a
 * recipe) the stores are different ones.
 */
export async function findReferences(store, id) {
  const paths = INCOMING[store] || [];
  // Sources are matched on their code. Read the record to learn it rather than
  // deriving it from the id, so a user-written source — which has a uid for an
  // id and its own code — is matched the same way a seeded one is.
  const target = TARGET_KEY[store] ? keyOf(store, (await get(store, id)) || { id }) : id;
  const byStore = [];
  let total = 0;

  for (const path of paths) {
    if (!STORES[path.store]) continue;
    let records = 0, count = 0;
    for (const row of await all(path.store)) {
      // A record cannot hold itself: guard the one case where the pointing
      // store and the pointed-at store are the same kind.
      if (path.store === store && row.id === id) continue;
      const n = path.count(row, target);
      if (n > 0) { records++; count += n; }
    }
    if (records) { byStore.push({ ...path, records, count }); total += records; }
  }

  return { total, byStore };
}

/** True when nothing in the database points at this record. */
export async function isUnreferenced(store, id) {
  return (await findReferences(store, id)).total === 0;
}

// Which stores this file knows how to check. A module offering a delete for a
// store that is not here is a module offering an unchecked delete, and
// `deep-check` fails the build for it rather than leaving it to be noticed.
export const CHECKED_STORES = Object.keys(INCOMING);

/**
 * Every id pointed at that no longer exists.
 *
 * Used by the guard rather than by the application: after any normal delete
 * flow this must return nothing new. It is the check that a policy has not
 * been quietly bypassed somewhere.
 */
export async function danglingReferences() {
  const out = [];
  const present = {};
  for (const store of Object.keys(INCOMING)) {
    present[store] = new Set((await all(store)).map(r => keyOf(store, r)));
  }

  const seen = new Map();   // 'store:id' -> where it was seen
  for (const [target, paths] of Object.entries(INCOMING)) {
    for (const path of paths) {
      if (!STORES[path.store]) continue;
      for (const row of await all(path.store)) {
        for (const id of pointersIn(row, target)) {
          if (!id || present[target].has(id)) continue;
          const key = `${target}:${id}`;
          if (!seen.has(key)) {
            seen.set(key, true);
            out.push({ target, id, from: path.store, fromId: row.id });
          }
        }
      }
    }
  }
  return out;
}

// The ids a record holds that are meant to name a record of `target`'s kind.
// Kept beside INCOMING deliberately: they are two readings of one map, and a
// path added to one without the other is a path the dangling guard cannot see.
function pointersIn(row, target) {
  switch (target) {
    case 'recipes': return [
      ...(row.steps || []).map(s => s.recipeId),
      ...(row.actions || []).map(a => a.recipeId),
      row.recipeId,
    ];
    case 'chains': return [
      ...(row.steps || []).map(s => s.chainId),
      ...(row.actions || []).map(a => a.chainId),
      row.chainId,
    ];
    case 'plants': return [
      ...(row.placements || []).map(p => p.plantId),
      row.key?.dyeSource?.plantId,
      row.plantId,
      ...(row.ingredients || []).flatMap(i => (i.options || []).map(o => o.plantId)),
    ];
    case 'techniques':   return row.techniqueIds || [];
    case 'combinations': return (row.placements || []).map(p => p.combinationId);
    case 'fabrics':      return row.fabricIds || [];
    case 'substances': return [
      ...(row.ingredients || []).flatMap(i => (i.options || []).map(o => o.substanceId)),
      row.substanceId,
    ];
    case 'trials':       return (row.actions || []).map(a => a.trialId);
    // The codes a record credits. `trials.water.sourceCode` is deliberately NOT
    // here: it holds a `water_source` vocabulary code — rain, tap, well — and
    // has nothing to do with the sources register. A checker that matched on
    // field name alone would have blocked the deletion of a source because
    // somebody once wrote down where the water came from.
    case 'sources': return [
      row.sourceCode,
      ...(row.colours || []).map(c => c.source),
    ];
    default:             return [];
  }
}

// seed.js — loading the shipped reference library (§10).
//
// Lives on its own rather than in app.js: modules need it, and app.js imports
// the modules, so keeping it there made a circular dependency — app importing
// plants importing app. It worked by accident of hoisting until it did not.

import { all, keys, get, putSystem, removeSystem, getSetting, setSetting } from './db.js';

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
    await putSystem(store, {
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
    // `harvestMonths` was here until rc25. The pack no longer carries it and the
    // record no longer has it (§13cn) — but a DEFAULT put it back on every plant
    // at install time, so the field was gone from the file and present in the
    // database. A default outlives the field it defaults.
    defaults: { colours: [], photoData: null },
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

// ---------------------------------------------------------------- the boot gate
//
// WHAT A NORMAL START USED TO DO (§13cs).
//
// Every boot fetched and parsed EVERY pack, in full, to find out whether there
// was anything to add. For plants in rc27 that was 3.97 MB of JSON — most of it
// photographs — read, parsed and thrown away, on every single opening of the
// application, so that `seedPack` could discover that all 57 records were
// already there. The first render waited for it.
//
// WHAT THE GATE MUST NOT BREAK.
//
// `seedPack` does not only seed a fresh install. It also puts back a seeded
// record that has gone missing — deleted by hand, lost after a deploy — and
// that is a real recovery path, not an accident of the implementation. So a
// gate that says
//
//     same version → skip
//
// would silently change behaviour: delete a plant, restart, and it would no
// longer come back.
//
// The gate therefore asks TWO questions, and skips only when both agree:
//
//   1. Is the shipped version the same one that was installed?  (the manifest)
//   2. Is the SET of seeded ids in the store still the set that was installed?
//      (a fingerprint over the ids, read with `keys()` — no records cloned, no
//      photographs, no parse of a pack)
//
// A record deleted by hand changes the fingerprint, the gate opens, the pack is
// fetched and the record comes back. Behaviour preserved, exactly.
//
// The gate is never a reason to overwrite anything. It can only decide whether
// to run `seedPack`, which adds absent records and touches nothing else. Pack
// UPDATES still go through `diffPack` and the preview (§10), and the explicit
// „check the library" button calls `diffPack` directly, so it fetches whatever
// the gate decided — a person asking to be shown the pack is always shown it.

const MANIFEST = 'seed/manifest.json';

// FNV-1a over the sorted seeded ids. Not a security hash — the question is only
// „is this the same set of records", and a 32-bit answer to that is enough for
// a few dozen ids while costing nothing and needing no crypto.
function fingerprint(ids) {
  const s = ids.filter(k => typeof k === 'string' && k.startsWith('seed:')).sort().join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${s ? s.split('|').length : 0}:${h.toString(16)}`;
}

async function packState() {
  return (await getSetting('packState', null)) || {};
}

/**
 * Load only the packs that actually need loading.
 *
 * @returns {Promise<{loaded:string[], skipped:string[], manifest:object|null}>}
 */
export async function ensurePacks() {
  const out = { loaded: [], skipped: [], failed: [], manifest: null };

  let manifest = null;
  try {
    const res = await fetch(MANIFEST);
    if (res.ok) manifest = (await res.json()).packs || null;
  } catch { /* no manifest: fall back to loading everything, as before */ }
  out.manifest = manifest;

  const state = await packState();
  const next = { ...state };

  for (const name of Object.keys(PACKS)) {
    const shipped = manifest?.[name];
    const known = state[name];
    const store = PACKS[name].store;

    if (shipped && known && known.version === shipped.version) {
      const now = fingerprint(await keys(store));
      if (now === known.fingerprint) { out.skipped.push(name); continue; }
    }

    try {
      await loadPack(name);
      out.loaded.push(name);
      next[name] = {
        version: shipped?.version ?? null,
        fingerprint: fingerprint(await keys(store)),
      };
    } catch (err) {
      // Failing to seed must not take the application down with it (§13aa).
      // Nothing is recorded for a pack that failed, so the next start tries
      // again rather than deciding it is installed.
      console.warn('seed failed:', name, err);
      out.failed.push(name);
    }
  }

  await setSetting('packState', next);
  return out;
}

/**
 * Which shipped packs differ from what is installed — asked from the manifest
 * alone, without opening a pack. This is what a „there is a new library"
 * notice would read; it does not apply anything.
 */
export async function packsWithNewVersion() {
  let manifest = null;
  try {
    const res = await fetch(MANIFEST);
    if (res.ok) manifest = (await res.json()).packs || null;
  } catch { return []; }
  if (!manifest) return [];

  const state = await packState();
  return Object.keys(PACKS).filter(name =>
    manifest[name] && state[name] && state[name].version !== manifest[name].version);
}

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

  const diff = {
    store, pack, defaults,
    added: [], changed: [], edited: [], withdrawn: [], unchanged: [],
  };

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

  // WHAT THE PACK NO LONGER CARRIES (§13cb).
  //
  // The loop above walks the PACK. A record that has left the pack is therefore
  // never looked at, and stays on an installed copy for ever — so a fresh
  // install and an updated one become two different applications, silently and
  // permanently. Until rc13 no pack had ever removed a row, so the gap had never
  // shown; the glossary review removed five terms and it showed at once. This is
  // the same shape as the fault §13bt records, where a corrected term never
  // reached an installed copy.
  //
  // Only SEEDED records are considered — `origin: 'seed'` and this pack's
  // `packId`. Anything the user wrote herself is not the pack's to withdraw, and
  // a record seeded by a different pack into the same store is not this pack's
  // business either.
  //
  // It is offered, not performed. Removal is the one direction that cannot be
  // undone by running the update again, so it goes through the same tick-box as
  // everything else, and an edited record arrives unticked like any other.
  const codes = new Set(pack[listKey].map(r => 'seed:' + r.code));
  for (const row of await all(store)) {
    if (row.origin !== 'seed' || row.packId !== pack.packId) continue;
    if (codes.has(row.id)) continue;
    diff.withdrawn.push({ id: row.id, name: nameOf(row), remove: true, edited: !!row.editedByUser });
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
    // A withdrawal is the one entry that is not a write. It is marked on the
    // entry rather than inferred from a missing `row`, because inferring it
    // would make a malformed entry delete a record.
    if (entry.remove) {
      await removeSystem(store, entry.id);
      n++;
      continue;
    }

    const existing = await get(store, entry.id);

    if (!existing) {
      await putSystem(store, {
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
      await putSystem(store, {
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

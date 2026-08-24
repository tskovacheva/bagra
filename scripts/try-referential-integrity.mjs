// scripts/try-referential-integrity.mjs — can the history be orphaned by a delete?
//
// Until rc28 it could. Six modules offered a plain physical delete while other
// records held their ids and nothing checked. Delete the tannin recipe and
// every trial that used it still says it used *something*: the step is there,
// the id is there, the lookup returns nothing, and the screen renders „—". The
// history survives in shape and loses its meaning.
//
// Each path is asked in BOTH directions, because the expensive failure here is
// not a delete that is wrongly blocked — that is loud and gets reported within
// a day. It is a checker that quietly returns zero for a path it does not know
// about, which looks exactly like a record nobody uses.
//
//   node scripts/try-referential-integrity.mjs

import 'fake-indexeddb/auto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

let failed = false;
const ok   = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };

const db = await import('../db.js');
const { findReferences, danglingReferences, CHECKED_STORES } = await import('../refs.js');

await db.open();

const raw = (store, rec) => db.putRaw(store, { origin: 'user', ...rec });

// ---------------------------------------------------------------- the fixture
//
// One of everything, wired the way the real model wires it.

await raw('recipes', { id: 'rec-used-trial',  name: { bg: 'танинова баня', en: 'tannin' } });
await raw('recipes', { id: 'rec-used-action', name: { bg: 'стипца', en: 'alum' } });
await raw('recipes', { id: 'rec-used-batch',  name: { bg: 'изваряване', en: 'scour' } });
await raw('recipes', { id: 'rec-used-chain',  name: { bg: 'подготовка', en: 'prep' } });
await raw('recipes', { id: 'rec-unused',      name: { bg: 'никъде', en: 'nowhere' } });
await raw('recipes', { id: 'rec-names-plant',
  ingredients: [{ role: 'dye', options: [{ plantId: 'plant-in-recipe', partCode: 'bark' }] }] });
await raw('recipes', { id: 'rec-names-substance',
  ingredients: [{ role: 'mordant', options: [{ substanceId: 'sub-used' }] }] });

await raw('chains', { id: 'chain-used',   steps: [{ recipeId: 'rec-used-chain' }] });
await raw('chains', { id: 'chain-unused', steps: [] });

await raw('plants', { id: 'plant-in-placement',   nameCommon: { bg: 'дъб', en: 'oak' } });
await raw('plants', { id: 'plant-in-combination', nameCommon: { bg: 'клен', en: 'maple' } });
await raw('plants', { id: 'plant-in-pigment',     nameCommon: { bg: 'марена', en: 'madder' } });
await raw('plants', { id: 'plant-in-recipe',      nameCommon: { bg: 'бреза', en: 'birch' } });
await raw('plants', { id: 'plant-unused',         nameCommon: { bg: 'липа', en: 'lime' } });

await raw('techniques',   { id: 'tech-used' });
await raw('techniques',   { id: 'tech-unused' });
await raw('combinations', { id: 'combo-used',   key: { dyeSource: { plantId: 'plant-in-combination' } } });
await raw('combinations', { id: 'combo-unused', key: { dyeSource: { plantId: null } } });
await raw('substances',   { id: 'sub-used' });
await raw('substances',   { id: 'sub-in-jar' });
await raw('substances',   { id: 'sub-unused' });
await raw('stock',        { id: 'jar-1', substanceId: 'sub-in-jar' });

await raw('fabrics', { id: 'cloth-in-trial' });
await raw('fabrics', { id: 'cloth-in-batch' });
await raw('fabrics', { id: 'cloth-unused' });
await raw('fabrics', { id: 'cloth-with-actions', actions: [
  { id: 'a1', recipeId: 'rec-used-action', chainId: 'chain-used', trialId: 'trial-wrote-action' },
] });

await raw('trials', { id: 'trial-1',
  fabricIds: ['cloth-in-trial'],
  techniqueIds: ['tech-used'],
  // The same recipe at two steps: one trial, two pointers. The report counts
  // records, because „7 trials" is a thing a person can go and look at.
  steps: [{ recipeId: 'rec-used-trial' }, { recipeId: 'rec-used-trial' }, { chainId: 'chain-used' }],
  placements: [{ plantId: 'plant-in-placement', combinationId: 'combo-used' }],
});
await raw('trials', { id: 'trial-wrote-action', fabricIds: [], steps: [], placements: [] });
await raw('trials', { id: 'trial-empty', fabricIds: [], steps: [], placements: [] });

await raw('pigmentBatches', { id: 'pig-1', plantId: 'plant-in-pigment' });
await raw('batchActions',   { id: 'batch-1', fabricIds: ['cloth-in-batch'],
  recipeId: 'rec-used-batch', chainId: null });

// ---------------------------------------------------------------- blocked
console.log('\na record the history points at cannot be deleted');

const blocked = [
  ['recipes',      'rec-used-trial',        'a recipe used at a trial step'],
  ['recipes',      'rec-used-action',       'a recipe used by an action on cloth'],
  ['recipes',      'rec-used-batch',        'a recipe used by a group action'],
  ['recipes',      'rec-used-chain',        'a recipe used inside a chain'],
  ['chains',       'chain-used',            'a chain used at a trial step'],
  ['plants',       'plant-in-placement',    'a plant named by a placement'],
  ['plants',       'plant-in-combination',  'a plant named by a reference record'],
  ['plants',       'plant-in-pigment',      'a plant named by a pigment batch'],
  ['plants',       'plant-in-recipe',       'a plant named by a recipe ingredient'],
  ['techniques',   'tech-used',             'a technique used by a trial'],
  ['combinations', 'combo-used',            'a reference record used by a placement'],
  ['fabrics',      'cloth-in-trial',        'a piece of cloth used in a trial'],
  ['fabrics',      'cloth-in-batch',        'a piece of cloth in a group action'],
  ['substances',   'sub-used',              'a substance named by a recipe'],
  ['substances',   'sub-in-jar',            'a substance with a jar on the shelf'],
  ['trials',       'trial-wrote-action',    'a trial that wrote an action onto cloth'],
];
for (const [store, id, label] of blocked) {
  const r = await findReferences(store, id);
  r.total > 0 ? ok(`${label} — ${r.total} referrer(s)`)
              : fail(`${label} — NOTHING SEEN, the delete would go through`);
}

// ---------------------------------------------------------------- allowed
console.log('\nand one nobody uses still can');

const allowed = [
  ['recipes',      'rec-unused',   'an unused recipe'],
  ['chains',       'chain-unused', 'an unused chain'],
  ['plants',       'plant-unused', 'an unused plant'],
  ['techniques',   'tech-unused',  'an unused technique'],
  ['combinations', 'combo-unused', 'an unused reference record'],
  ['fabrics',      'cloth-unused', 'a piece of cloth with no history'],
  ['substances',   'sub-unused',   'an unused substance'],
  ['trials',       'trial-empty',  'a trial that wrote nothing onto cloth'],
];
for (const [store, id, label] of allowed) {
  const r = await findReferences(store, id);
  r.total === 0 ? ok(label)
                : fail(`${label} — blocked by ${JSON.stringify(r.byStore.map(x => x.store))}`);
}

// ---------------------------------------------------------------- counting
console.log('\nthe count is honest');

const rec = await findReferences('recipes', 'rec-used-trial');
rec.byStore[0].records === 1 && rec.byStore[0].count === 2
  ? ok('one trial using a recipe at two steps counts as one trial, two pointers')
  : fail(`counted ${JSON.stringify(rec.byStore)}`);

const self = await findReferences('recipes', 'rec-unused');
self.total === 0 ? ok('a record does not count itself')
                 : fail('a record counted itself');

const unrelated = await findReferences('plants', 'plant-unused');
unrelated.total === 0 ? ok('an unrelated record is not counted')
                      : fail('unrelated records were counted');

// ---------------------------------------------------------------- no cascade
console.log('\nnothing is cascaded and nothing is blanked');

const before = JSON.stringify(await db.all('trials'));
await db.remove('recipes', 'rec-unused');
const after = JSON.stringify(await db.all('trials'));
before === after ? ok('deleting an unused recipe changed no trial')
                 : fail('a delete reached into the trials');

// ---------------------------------------------------------------- dangling
console.log('\nno dangling reference is left behind');

let dangling = await danglingReferences();
dangling.length === 0
  ? ok('the fixture holds together to begin with')
  : fail(`started with ${dangling.length}: ${JSON.stringify(dangling.slice(0, 3))}`);

// The other direction: a dangling id must actually be SEEN. A guard that
// reports zero because it cannot look is the failure mode this project has
// named three times.
await db.remove('techniques', 'tech-used');
dangling = await danglingReferences();
dangling.some(d => d.target === 'techniques' && d.id === 'tech-used')
  ? ok('an id deleted behind the policy’s back is caught')
  : fail('a deleted record left a pointer nobody noticed');
await raw('techniques', { id: 'tech-used' });

// ---------------------------------------------------------------- coverage
console.log('\nevery module that offers a delete is covered');

const fs = await import('node:fs');
const offered = new Set();
for (const f of fs.readdirSync('modules')) {
  const src = fs.readFileSync('modules/' + f, 'utf8');
  for (const m of src.matchAll(/deleteGuarded\('([a-zA-Z]+)'/g)) offered.add(m[1]);
  // A plain physical delete left anywhere in a module is the fault coming back.
  for (const m of src.matchAll(/await remove\('([a-zA-Z]+)'/g)) {
    if (CHECKED_STORES.includes(m[1])) fail(`modules/${f} still deletes ${m[1]} unguarded`);
  }
}
const uncovered = [...offered].filter(s => !CHECKED_STORES.includes(s));
uncovered.length === 0
  ? ok(`${offered.size} guarded delete(s), every store known to refs.js`)
  : fail(`guarded but unknown to refs.js: ${uncovered.join(', ')}`);

console.log(failed ? '\nREFERENTIAL INTEGRITY CHECK FAILED' : '\nall held');
process.exit(failed ? 1 : 0);

// scripts/try-pigment-lines.mjs — what a batch says about what actually went in.
//
// WHY THIS EXISTS.
//
// The batch named a recipe and showed none of its amounts, so standing over the
// pot you were told which recipe and not how much of anything (§17e). It also
// had nowhere to record a departure — and the owner's open question about her
// own madder, whether chalk or soda ash served better, is exactly a departure
// she made and could not write down.
//
// FIVE THINGS ARE ASSERTED, and each is a decision that could have gone the
// other way:
//
//   1. The lines resolve to AMOUNTS, not to a reference. 50 g stays 50 g next
//      year even if the recipe's percentage is revised, because 50 g is what
//      went in the pot.
//   2. `was` freezes what the recipe said ON THE DAY. The departure is measured
//      against that, never against the recipe as it stands now — otherwise a
//      pack update silently rewrites what last summer's batch departed from,
//      which is the fault family this project has caught in five consecutive
//      releases.
//   3. A line the owner adds has `was: null` and reads as ADDED. Soda the
//      recipe never mentioned is the case the whole feature exists for.
//   4. A line taken from the recipe and left out is STRUCK, not deleted.
//      Deleting it would make „I left the soda out" indistinguishable from
//      never having followed a recipe.
//   5. Taking is refused when lines already exist. One click must not be able
//      to replace an evening's entries.
//
// And the migration backfills an EMPTY list and reconstructs nothing. Filling
// the rows in from `viaId` would have been easy and would have claimed she
// followed the recipe exactly — the one thing the record cannot know.

import 'fake-indexeddb/auto';
import fs from 'node:fs';

let failed = false;
const ok  = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed = true; console.log('  FAIL ' + m); };

const { open, putSystem, all } = await import('../db.js');
const { migratePigmentBatchLines } = await import('../migrations.js');
const { scaleRecipe } = await import('../calc/scale.js');

await open();

// ---- the amounts a batch would take from the lake recipe -------------------

const recipes = JSON.parse(fs.readFileSync('seed/recipes.json', 'utf8')).recipes;
const lake = recipes.find(r => r.code === 'pigment-lake-master');
const scaled = scaleRecipe(lake, {});
const byRole = {};
for (const i of scaled.ingredients) byRole[i.roleCode] = i;

byRole.dyestuff?.scaledMin === 50 && byRole.carrier?.scaledMin === 10
  ? ok('a batch taking the lake recipe gets 50 g of root against 10 g of carrier')
  : bad(`took ${byRole.dyestuff?.scaledMin} / ${byRole.carrier?.scaledMin}`);

// ---- departures ------------------------------------------------------------
//
// Imported, not restated. A copy of the rule here would pass while the screen
// did something else, which is the guard failure this project keeps finding —
// and a source-text search for the rule would be the one that invents the
// string it looks for (§13cz). The module is asked the same question the screen
// asks it.
// `departureOf` moved to `recipe-lines.js` at §13ee, so a paste print could ask
// the same question of the same code. `canTakeLines` stayed with the batch.
const { canTakeLines } = await import('../modules/pigments.js');
const { departureOf } = await import('../recipe-lines.js');

const fromRecipe = (name, amount, unit) =>
  ({ name, amount, unit, removed: false, was: { name, amount, unit } });

departureOf(fromRecipe('стипца', 10, 'g')) === 'same'
  ? ok('an untouched line reports no departure')
  : bad('an untouched line reported one');

const doubled = fromRecipe('стипца', 10, 'g'); doubled.amount = 20;
departureOf(doubled) === 'changed'
  ? ok('twice the alum reads as changed')
  : bad(`twice the alum read as ${departureOf(doubled)}`);

const swapped = fromRecipe('калцинирана сода', 5, 'g'); swapped.name = 'креда';
departureOf(swapped) === 'swapped'
  ? ok('soda ash replaced by chalk reads as swapped, the owner\u2019s own open question')
  : bad(`the swap read as ${departureOf(swapped)}`);

departureOf({ name: 'сода', amount: 3, unit: 'g', removed: false, was: null }) === 'added'
  ? ok('a line the recipe never had reads as added')
  : bad('an added line did not read as added');

// The same line asked without a `was` key at all, not merely null — a record
// written before the field existed. It must answer, not throw: a guard that
// crashes says something is wrong without saying what.
try {
  departureOf({ name: 'сода', amount: 3, removed: false }) === 'added'
    ? ok('a line with no history at all answers „added" rather than throwing')
    : bad('a line with no history gave the wrong answer');
} catch (err) {
  bad(`a line with no history threw: ${err.message}`);
}

const left = fromRecipe('сода', 5, 'g'); left.removed = true;
departureOf(left) === 'removed'
  ? ok('a line left out reads as left out, and still carries what it was')
  : bad('a struck line did not read as removed');

// The point of freezing `was`: the recipe changing later must not rewrite it.
const historic = fromRecipe('стипца', 10, 'g');
const recipeNowSays = 25;
departureOf(historic) === 'same' && historic.was.amount !== recipeNowSays
  ? ok('a revised recipe does not turn last year\u2019s faithful batch into a departure')
  : bad('the frozen `was` moved with the recipe');

// ---- taking is refused once there is work to lose --------------------------

const emptyBatch  = { viaKind: 'recipe', lines: [] };
const workedBatch = { viaKind: 'recipe', lines: [{ id: 'l1', name: 'креда' }] };
const someRecipe  = { id: 'r1' };

canTakeLines(emptyBatch, someRecipe)
  ? ok('an empty batch may take a recipe\u2019s lines')
  : bad('an empty batch was refused');

canTakeLines(workedBatch, someRecipe) === false
  ? ok('a batch with lines already entered refuses — one click cannot replace an evening')
  : bad('a batch with entries would have been overwritten');

canTakeLines(emptyBatch, null) === false
  ? ok('and with no recipe chosen there is nothing to take')
  : bad('taking was offered with no recipe');

canTakeLines({ viaKind: 'chain', lines: [] }, someRecipe) === false
  ? ok('a batch made by a chain does not take recipe lines')
  : bad('a chain-made batch was offered recipe lines');

// ---- the migration ---------------------------------------------------------

await putSystem('pigmentBatches', { id: 'old', plantId: 'seed:rubia_tinctorum',
  viaKind: 'recipe', viaId: 'seed:pigment-lake-master', stages: [] });
await putSystem('pigmentBatches', { id: 'new', lines: [
  { id: 'l1', name: 'креда', amount: 3, unit: 'g', removed: false, was: null, note: {} },
], linesFrom: { recipeId: 'x', recipeName: { bg: 'нещо' }, takenOn: '2026-07-01' } });

const stampsBefore = Object.fromEntries((await all('pigmentBatches')).map(b => [b.id, b.updatedAt]));
await migratePigmentBatchLines();
const after = Object.fromEntries((await all('pigmentBatches')).map(b => [b.id, b]));

Array.isArray(after.old.lines) && after.old.lines.length === 0
  ? ok('an existing batch is backfilled with an EMPTY list')
  : bad(`the old batch got ${JSON.stringify(after.old.lines)}`);

after.old.linesFrom === null
  ? ok('and claims no recipe was taken from — nothing is reconstructed from viaId')
  : bad('the migration invented a linesFrom');

after.new.lines.length === 1 && after.new.lines[0].name === 'креда'
  ? ok('a batch whose lines are already filled in is not emptied')
  : bad('the migration overwrote entered lines');

Object.entries(after).every(([id, b]) => b.updatedAt === stampsBefore[id])
  ? ok('no updatedAt moved — giving a record a field is not the owner touching it')
  : bad('a batch was stamped as freshly edited');

const snapshot = JSON.stringify(after);
await migratePigmentBatchLines();
JSON.stringify(Object.fromEntries((await all('pigmentBatches')).map(b => [b.id, b]))) === snapshot
  ? ok('a second run changes nothing')
  : bad('a second run changed the data');

// ---- swatches become a list ------------------------------------------------
//
// One batch of madder becomes powder, watercolour and pastel, three different
// colours, and a single `swatchHex` could hold one of them (§13ds).

const { migratePigmentSwatchList } = await import('../migrations.js');

await putSystem('pigmentBatches', { id: 'sw-both', lines: [],
  swatchHex: '#A03D3B', swatchName: { bg: 'марена, топла', en: '' } });
// A colour described in words and never measured. §13dl: this is a FINISHED
// record, and dropping it because there is no hex would lose the whole of it.
await putSystem('pigmentBatches', { id: 'sw-words', lines: [],
  swatchHex: '', swatchName: { bg: 'мътно розово', en: '' } });
await putSystem('pigmentBatches', { id: 'sw-none', lines: [],
  swatchHex: '', swatchName: { bg: '', en: '' } });
await putSystem('pigmentBatches', { id: 'sw-already', lines: [], swatchHex: '#111111',
  swatches: [{ id: 'w1', kind: 'pastel', hex: '#222222', name: { bg: 'мой', en: '' } }] });

const swStamps = Object.fromEntries((await all('pigmentBatches')).map(b => [b.id, b.updatedAt]));
await migratePigmentSwatchList();
const sw = Object.fromEntries((await all('pigmentBatches')).map(b => [b.id, b]));

sw['sw-both'].swatches.length === 1 && sw['sw-both'].swatches[0].hex === '#A03D3B'
  && sw['sw-both'].swatches[0].kind === 'pigment'
  ? ok('the old colour becomes one swatch, of kind pigment')
  : bad(`sw-both became ${JSON.stringify(sw['sw-both'].swatches)}`);

sw['sw-words'].swatches.length === 1 && sw['sw-words'].swatches[0].hex === ''
  ? ok('a colour named but never measured is kept, with no hex invented for it')
  : bad(`sw-words became ${JSON.stringify(sw['sw-words'].swatches)}`);

sw['sw-none'].swatches.length === 0
  ? ok('a batch that recorded no colour at all gets an empty list, not a blank swatch')
  : bad(`sw-none became ${JSON.stringify(sw['sw-none'].swatches)}`);

sw['sw-already'].swatches.length === 1 && sw['sw-already'].swatches[0].kind === 'pastel'
  ? ok('a batch whose swatches are already entered is not overwritten')
  : bad('the migration overwrote entered swatches');

sw['sw-both'].swatchHex === '#A03D3B'
  ? ok('the legacy pair survives — the migration adds, it does not take away')
  : bad('swatchHex was removed');

sw['sw-both'].swatches.length === 1
  ? ok('and no watercolour row is invented on the grounds that one might exist')
  : bad('the migration invented extra swatches');

Object.entries(sw).every(([id, b]) => b.updatedAt === swStamps[id])
  ? ok('no updatedAt moved')
  : bad('a batch was stamped as freshly edited by the swatch migration');

const swSnapshot = JSON.stringify(sw);
await migratePigmentSwatchList();
JSON.stringify(Object.fromEntries((await all('pigmentBatches')).map(b => [b.id, b]))) === swSnapshot
  ? ok('a second run changes nothing')
  : bad('a second swatch run changed the data');

process.exit(failed ? 1 : 0);

// scripts/try-recipe-temp-range.mjs — a recipe's temperature becomes a range.
//
// WHY THIS EXISTS.
//
// `tempC` held one number and both sources the owner works from give two:
// Stopka's madder digestion is 66–76 °C, Joanne Green's extraction 50–80 °C.
// For madder the CEILING is the half that matters — the library already carries
// a `softMaxTempC` of 82 for exactly that reason, because above it the red goes
// brown. A single field could hold the floor or the ceiling and not both.
//
// The plant record has carried `tempDyeC.min` and `.max` all along, and
// `tempSpan(min, max)` had been sitting in units.js unused. So the plant knew
// the range, the display could already draw one, and the recipe was flat in the
// middle — including at the door: pre-filling a recipe from a plant part took
// `.min` and dropped the ceiling, three lines under a comment arguing that one
// number hands the elder fruit the elder leaf's boil.
//
// WHAT IT ASSERTS.
//
//   - a single figure becomes a range whose ends agree, and still reads as one
//     temperature;
//   - a recipe with no temperature is not given one — nothing is invented;
//   - a recipe that already has either end is left alone, so a range the owner
//     has widened by hand is not narrowed back;
//   - running it twice changes nothing;
//   - `updatedAt` does not move. Reshaping a field is not something the owner
//     did (§13cv), and stamping it would carry a recipe untouched since spring
//     to the top of every list ordered by recency;
//   - `tempC` survives. Migrations add; the old field is the way back if the
//     mapping proves wrong, and it comes out in a later version on purpose.

import 'fake-indexeddb/auto';

let failed = false;
const ok  = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed = true; console.log('  FAIL ' + m); };

const { open, putSystem, all } = await import('../db.js');
const { migrateRecipeTempRange } = await import('../migrations.js');
const { tempSpan } = await import('../units.js');

await open();

const rows = [
  { id: 'flat',      tempC: 70,   tempMinC: null, tempMaxC: null },
  { id: 'none',      tempC: null, tempMinC: null, tempMaxC: null },
  { id: 'has-range', tempC: 60,   tempMinC: 66,   tempMaxC: 76   },
  // Only one end filled in, by hand, which is a partial answer and not an
  // absence: „never above 80" is a real thing to have written down.
  { id: 'ceiling',   tempC: 55,   tempMinC: null, tempMaxC: 80   },
];
for (const r of rows) await putSystem('recipes', r);

const byId = async () =>
  Object.fromEntries((await all('recipes')).map(r => [r.id, r]));

const before = await byId();
const stamps = Object.fromEntries(Object.entries(before).map(([k, r]) => [k, r.updatedAt]));

await migrateRecipeTempRange();
const after = await byId();

after.flat.tempMinC === 70 && after.flat.tempMaxC === 70
  ? ok('a single 70 becomes a range of 70 to 70')
  : bad(`flat became ${after.flat.tempMinC}/${after.flat.tempMaxC}`);

tempSpan(after.flat.tempMinC, after.flat.tempMaxC) === tempSpan(70, null)
  ? ok('and still reads as one temperature, not as „70–70"')
  : bad(`it reads as ${tempSpan(after.flat.tempMinC, after.flat.tempMaxC)}`);

after.none.tempMinC == null && after.none.tempMaxC == null
  ? ok('a recipe with no temperature is given none — no ceiling is invented')
  : bad(`none became ${after.none.tempMinC}/${after.none.tempMaxC}`);

after['has-range'].tempMinC === 66 && after['has-range'].tempMaxC === 76
  ? ok('a range already entered by hand is left alone, legacy tempC ignored')
  : bad(`has-range became ${after['has-range'].tempMinC}/${after['has-range'].tempMaxC}`);

after.ceiling.tempMaxC === 80 && after.ceiling.tempMinC == null
  ? ok('„never above 80" keeps its ceiling and gains no invented floor')
  : bad(`ceiling became ${after.ceiling.tempMinC}/${after.ceiling.tempMaxC}`);

after.flat.tempC === 70
  ? ok('tempC survives — the migration adds, it does not take away')
  : bad('tempC was removed');

let moved = 0;
for (const [id, r] of Object.entries(after)) if (r.updatedAt !== stamps[id]) moved++;
moved === 0
  ? ok('no updatedAt moved — reshaping a field is not the owner touching a record')
  : bad(`${moved} recipe(s) were stamped as freshly edited`);

await migrateRecipeTempRange();
const twice = await byId();
JSON.stringify(twice) === JSON.stringify(after)
  ? ok('a second run changes nothing')
  : bad('a second run changed the data');

process.exit(failed ? 1 : 0);

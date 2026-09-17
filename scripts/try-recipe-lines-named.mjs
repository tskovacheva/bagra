// scripts/try-recipe-lines-named.mjs — every shipped recipe line names what goes in (§13dv).
//
// WHY THIS EXISTS.
//
// The owner asked why the fermentation recipe read „носител", „алкали",
// „помощно" instead of names. The alum, the soda ash and the chalk had been in
// the library all along. The lines were written at rc50 with the substance in
// a prose note and no `substanceId`, so the work view fell back to the ROLE —
// exactly what it shows for a substance that is genuinely missing. Two very
// different states, one appearance, and nothing that asked (item 18f).
//
// The question is not „do the three pigment recipes point at alum". It is
// „which shipped line names nothing, and has anybody said why".
//
// A LINE PASSES when an option names a plant or a substance, and the id
// resolves in the shipped packs. Otherwise it must be in NAMED_IN_PROSE with a
// reason. Three reasons exist, and they are different kinds of thing:
//
//   not-a-substance  — decided not to be a library record. The owner, on
//                      11 September 2026, of the sauerkraut juice: food, not a
//                      dye material, and the vocabulary does not grow to hold
//                      one recipe. Water follows the same reasoning.
//   dyer-chooses     — the recipe leaves the choice open on purpose. „Any dye
//                      extract" is what a print paste says, and how much
//                      depends on which one; naming a plant would make an open
//                      recipe a madder recipe.
//   made-elsewhere   — the pigment a paint is made FROM comes out of a BATCH,
//                      which is not a library record and has no id to point at.
//                      A binder solution is NOT this: it is made by a recipe,
//                      and since §13dy a line can name that recipe.
// A third reason, `awaits-18g`, covered seven lines at rc55 and is GONE at
// rc56: 18g landed, the lines resolved, and the guard failed on every one of
// them as „still excused". That is the temporary exemption working — it
// removed itself by failing, rather than by being remembered.
//
// BOTH DIRECTIONS. An exemption for a line that now resolves, or for a line
// that no longer exists, fails too. An excuse nobody prunes becomes permission.
//
// STATIC. Reads the recipe, substance and plant packs.

import { readFileSync } from 'node:fs';

const pack = (f) => JSON.parse(readFileSync(new URL(`../seed/${f}.json`, import.meta.url), 'utf8'));
const recipes = pack('recipes').recipes;
const substances = new Set(pack('substances').substances.map(s => 'seed:' + s.code));
const plants = new Set(pack('plants').plants.map(p => 'seed:' + p.code));
const recipeIds = new Set(recipes.map(r => 'seed:' + r.code));

// `recipe-code#line-index` → reason. Indexed by position on purpose: a line
// moved or removed makes the entry point at something else, and the guard
// then fails rather than excusing the wrong line.
const NAMED_IN_PROSE = {
  // 'madder-lake-fermentation#3' (sauerkraut juice) went with the recipe, withdrawn at rc74 and kept in
  // archive/withdrawn/ (§13eo). Restore the entry if the recipe comes back.
  'madder-lake-hot#1':          'not-a-substance',   // distilled water
  'watercolour-binder#1':       'not-a-substance',   // boiling water
  'pastel-binder-oat#1':        'not-a-substance',   // water
  'pastel-binder-gum#1':        'not-a-substance',   // water
  // The print pastes (§13eb). „Which dye" is the whole point of the paste and
  // the recipe deliberately does not answer it: any extract will do, and the
  // quantity depends on which. Naming one here would turn an open recipe into
  // a madder one.
  'dye-print-paste#0':          'dyer-chooses',      // any dye extract
  'dye-mordant-print-paste#0':  'dyer-chooses',      // any dye extract
  'mordant-print-paste#4':      'dyer-chooses',      // a marker; the colour washes out
  'watercolour-from-pigment#0': 'made-elsewhere',    // the pigment, from a batch
  'pastels-from-pigment#0':     'made-elsewhere',    // the pigment, from a batch
};
const REASONS = new Set(['not-a-substance', 'made-elsewhere', 'dyer-chooses']);

let bad = 0;
const fail = (m) => { console.log('RECIPE LINES: ' + m); bad = 1; };
const seen = new Set();

for (const r of recipes) {
  (r.ingredients || []).forEach((line, i) => {
    const key = `${r.code}#${i}`;
    seen.add(key);
    const opts = line.options || [];
    const named = opts.filter(o => o.substanceId || o.plantId || o.recipeId);
    for (const o of named) {
      if (o.substanceId && !substances.has(o.substanceId))
        fail(`${key} (${line.roleCode}) points at substance ${o.substanceId}, which the library does not have`);
      if (o.plantId && !plants.has(o.plantId))
        fail(`${key} (${line.roleCode}) points at plant ${o.plantId}, which the library does not have`);
      // A line can be filled by another RECIPE (§13dy) — the pastel's binder is
      // a solution the oat recipe makes. Two things to refuse: a recipe that is
      // not in the pack, and a recipe that is itself, which the work view would
      // follow in a circle.
      if (o.recipeId && !recipeIds.has(o.recipeId))
        fail(`${key} (${line.roleCode}) points at recipe ${o.recipeId}, which the pack does not have`);
      if (o.recipeId === 'seed:' + r.code)
        fail(`${key} (${line.roleCode}) names its own recipe as an ingredient`);
    }
    const excuse = NAMED_IN_PROSE[key];
    if (!named.length && !excuse)
      fail(`${key} (${line.roleCode}) names nothing — the work view will show the role, as if the substance were missing. „${(line.note?.bg || '').slice(0, 60)}"`);
    if (named.length && excuse)
      fail(`${key} (${line.roleCode}) now names what goes in, and is still excused as „${excuse}" — remove the exemption`);
    if (excuse && !REASONS.has(excuse))
      fail(`${key}: „${excuse}" is not one of the reasons this guard knows`);
  });
}
for (const key of Object.keys(NAMED_IN_PROSE))
  if (!seen.has(key)) fail(`${key} is excused and no such line exists — prune it`);

if (bad) process.exit(1);
const counts = {};
for (const v of Object.values(NAMED_IN_PROSE)) counts[v] = (counts[v] || 0) + 1;
console.log(`every shipped recipe line names what goes in, or says why not (${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')}).`);

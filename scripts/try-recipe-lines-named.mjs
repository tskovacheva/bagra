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
//   made-elsewhere   — the pigment a paint is made FROM comes out of a batch;
//                      the binder solution out of another recipe. A substance
//                      record for either would be a second copy of a thing the
//                      application already makes.
//   awaits-18g       — the six new substances (item 18g). Temporary, and this
//                      is what makes it visible: when 18g lands these lines
//                      resolve, and the exemption goes stale and fails.
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

// `recipe-code#line-index` → reason. Indexed by position on purpose: a line
// moved or removed makes the entry point at something else, and the guard
// then fails rather than excusing the wrong line.
const NAMED_IN_PROSE = {
  'madder-lake-fermentation#3': 'not-a-substance',   // sauerkraut juice — owner, 11 Sep 2026
  'madder-lake-hot#1':          'not-a-substance',   // distilled water
  'watercolour-binder#1':       'not-a-substance',   // boiling water
  'watercolour-from-pigment#0': 'made-elsewhere',    // the pigment, from a batch
  'pastels-from-pigment#0':     'made-elsewhere',    // the pigment, from a batch
  'watercolour-from-pigment#1': 'awaits-18g',        // the binder solution
  'pastels-from-pigment#1':     'awaits-18g',        // filler — chalk or kaolin
  'pastels-from-pigment#2':     'awaits-18g',        // gum tragacanth or methylcellulose
  'watercolour-binder#0':       'awaits-18g',        // gum arabic
  'watercolour-binder#2':       'awaits-18g',        // glycerine
  'watercolour-binder#3':       'awaits-18g',        // honey
  'watercolour-binder#4':       'awaits-18g',        // clove oil
};
const REASONS = new Set(['not-a-substance', 'made-elsewhere', 'awaits-18g']);

let bad = 0;
const fail = (m) => { console.log('RECIPE LINES: ' + m); bad = 1; };
const seen = new Set();

for (const r of recipes) {
  (r.ingredients || []).forEach((line, i) => {
    const key = `${r.code}#${i}`;
    seen.add(key);
    const opts = line.options || [];
    const named = opts.filter(o => o.substanceId || o.plantId);
    for (const o of named) {
      if (o.substanceId && !substances.has(o.substanceId))
        fail(`${key} (${line.roleCode}) points at substance ${o.substanceId}, which the library does not have`);
      if (o.plantId && !plants.has(o.plantId))
        fail(`${key} (${line.roleCode}) points at plant ${o.plantId}, which the library does not have`);
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

// scripts/try-recipe-followons.mjs — a required follow-on must exist (§13ec).
//
// WHY THIS EXISTS.
//
// A merge script ran twice from two drafts and left the pack with TWO fixing
// baths: the compound mordants pointed at `seed:bran-fix-bath`, and the record
// the second draft wrote, `seed:oatmeal-fixing-bath`, was reachable from
// nothing. Both were in the pack and the whole set passed, because no check had
// ever looked at `requiredFollowOn`.
//
// §5.4 says a recipe the work is not correct without is a STEP, not a footnote —
// the work view scales it and draws it under the recipe. So a follow-on that
// does not resolve is not a broken link in a document: it is a bath that
// silently does not appear on the screen of somebody mordanting cloth.
//
// Two directions, and the second is the one that was actually wrong here:
//   - a follow-on that names a recipe the pack does not have;
//   - a recipe that is reachable from NOTHING and is not meant to stand alone.
//     Stated, not guessed: a recipe that is only ever done after another one
//     names itself here, and then it must be pointed at.
//
// STATIC. Reads the recipes pack.

import { readFileSync } from 'node:fs';

const recipes = JSON.parse(readFileSync(new URL('../seed/recipes.json', import.meta.url), 'utf8')).recipes;
const codes = new Set(recipes.map(r => 'seed:' + r.code));

// Recipes that are a step of another recipe and never a piece of work on their
// own. If one of these is pointed at by nobody, something has come loose.
const ONLY_AS_A_FOLLOW_ON = ['oatmeal-fixing-bath'];

let bad = 0;
const fail = (m) => { console.log('FOLLOW-ON: ' + m); bad = 1; };

const pointedAt = new Set();
for (const r of recipes) {
  for (const id of r.requiredFollowOn || []) {
    pointedAt.add(id);
    if (!codes.has(id))
      fail(`${r.code} requires ${id}, which the pack does not have — the bath would not be drawn at all`);
    if (id === 'seed:' + r.code)
      fail(`${r.code} requires itself`);
  }
}
for (const code of ONLY_AS_A_FOLLOW_ON) {
  if (!codes.has('seed:' + code)) fail(`${code} is listed as a follow-on-only recipe and is not in the pack`);
  else if (!pointedAt.has('seed:' + code)) fail(`${code} is only ever done after another recipe, and nothing points at it`);
}

if (bad) process.exit(1);
console.log(`every required follow-on resolves, and ${ONLY_AS_A_FOLLOW_ON.length} follow-on-only recipe(s) are reachable.`);

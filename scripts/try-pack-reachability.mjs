// scripts/try-pack-reachability.mjs — every pack can be updated from a screen.
//
// WHY THIS EXISTS.
//
// A pack reaches an installed copy by two different routes, and only one of
// them is automatic:
//
//   ADDED record   — `loadPack` at boot adds what is absent. Arrives by itself.
//   CHANGED record — only through `diffPack`/`applyDiff`, which is the
//                    „Обнови от библиотеката" button and nothing else.
//
// So a pack with no button can gain records and can never correct one. Seven
// packs are declared and four had a button: `recipes`, `sources` and `glossary`
// had none. A correction to a shipped recipe would have gone out in the ZIP and
// reached nobody who already had the application — visible only on a fresh
// install.
//
// That is §13cb word for word: a fresh install and an updated one become two
// different applications, silently and permanently. The mechanism that closes
// it was built at rc13 and three of the seven packs were left outside it, which
// nothing noticed because nothing asked.
//
// WHAT IT ASKS. Not „does Recipes have a button" — that question needs asking
// again by hand every time a pack is declared, and this is the second guard in
// two releases written because a hand-maintained list drifted from the code
// (see try-screen-coverage.mjs). It asks which pack no screen can update.
//
// STATIC. Reads seed.js and the modules as text. No browser, no shim.
//
// BOTH DIRECTIONS. An exemption naming a pack that IS reachable, or a pack that
// no longer exists, fails too. An excuse nobody prunes becomes permission.

import { readFileSync, readdirSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const seed = readFileSync(here('../seed.js'), 'utf8');

// The declared packs, read from the PACKS object literal. Each entry opens with
// `  <name>: {` at one level of indentation.
const packsBlock = seed.match(/const PACKS = \{([\s\S]*?)\n\};/);
if (!packsBlock) {
  console.log('PACK REACHABILITY: cannot find the PACKS registry in seed.js.');
  process.exit(1);
}
const packs = [...packsBlock[1].matchAll(/\n {2}([a-zA-Z0-9_]+): \{/g)].map(m => m[1]);
if (!packs.length) {
  console.log('PACK REACHABILITY: PACKS parsed to nothing — the shape has changed.');
  process.exit(1);
}

// The exemption list lives in seed.js beside PACKS, so declaring a pack and
// excusing it are one edit in one file.
const declared = seed.match(/const UNREACHABLE_PACKS = \[([\s\S]*?)\];/);
if (!declared) {
  console.log('PACK REACHABILITY: seed.js declares no UNREACHABLE_PACKS.');
  console.log('  A pack with no update screen needs a written reason, not a silent gap.');
  process.exit(1);
}
const exempt = [...declared[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

// Which packs some module actually opens the merge preview for.
const dir = here('../modules/');
const reachable = new Set();
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.js')) continue;
  const src = readFileSync(new URL(file, dir), 'utf8');
  for (const m of src.matchAll(/seedUI\.open\('([^']+)'\)/g)) reachable.add(m[1]);
}

let bad = 0;

for (const name of packs) {
  if (reachable.has(name)) continue;
  if (exempt.includes(name)) continue;
  console.log(`UNREACHABLE PACK: ${name} — no module calls seedUI.open('${name}').`);
  console.log('  A correction to one of its records can never reach an installed copy.');
  console.log(`  Give it a button, or name it in UNREACHABLE_PACKS with a reason.`);
  bad = 1;
}

for (const name of exempt) {
  if (!packs.includes(name)) {
    console.log(`STALE EXEMPTION: ${name} is excused and is not a declared pack.`);
    bad = 1;
  } else if (reachable.has(name)) {
    console.log(`POINTLESS EXEMPTION: ${name} is excused and is reachable.`);
    console.log('  Remove it from UNREACHABLE_PACKS; an unpruned excuse is permission.');
    bad = 1;
  }
}

if (bad) process.exit(1);
console.log(`pack reachability: ${packs.length - exempt.length} packs updatable, ${exempt.length} excused.`);

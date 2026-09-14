// scripts/try-pack-field-labels.mjs — every pack field is named in words (§13du).
//
// WHY THIS EXISTS.
//
// The merge preview names the fields a pack would change, and from rc54 so does
// the note on an open record. The dictionary behind both covered plants and
// substances and fell back to the RAW field name for everything else, so a
// recipe preview said „ingredients, steps" in the middle of a Bulgarian screen.
// Nobody saw it because nobody had opened a recipe update with a change in it.
//
// Adding the recipe fields would close that gap and leave the hole: the
// dictionary is written by hand and nothing compares it to the packs. So the
// question is not „are the recipe fields there" but „which field that a pack
// carries has no name", asked again every time a pack gains one.
//
// BOTH DIRECTIONS.
//   - a field in a pack with no entry                         → fails
//   - an entry whose i18n key is missing in either language   → fails
//   - an entry for a field no row of that pack carries        → fails
// The third because an entry nobody prunes is how the plant dictionary came to
// hold `tempExtractC` years after the field left the plant.
//
// STATIC. Reads seed-ui.js, seed.js, i18n.js and the pack files as text.

import { readFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(here(p), 'utf8');

let bad = 0;
const fail = (m) => { console.log('FIELD LABELS: ' + m); bad = 1; };

// The dictionary, taken out of seed-ui.js as the object literal it is.
const ui = read('../seed-ui.js');
const block = ui.match(/export const FIELD_LABELS = (\{[\s\S]*?\n\});/);
if (!block) {
  console.log('FIELD LABELS: cannot find FIELD_LABELS in seed-ui.js — the shape has changed.');
  process.exit(1);
}
const LABELS = Function(`return ${block[1]};`)();

// The i18n keys of each language, from the two blocks of DICT.
const i18n = read('../i18n.js');
const bgAt = i18n.indexOf('\n  bg: {');
const enAt = i18n.indexOf('\n  en: {');
if (bgAt < 0 || enAt < 0 || enAt < bgAt) {
  console.log('FIELD LABELS: cannot find the bg and en blocks in i18n.js.');
  process.exit(1);
}
const keysIn = (src) => new Set([...src.matchAll(/\n\s+'([^']+)':/g)].map(m => m[1]));
const BG = keysIn(i18n.slice(bgAt, enAt));
const EN = keysIn(i18n.slice(enAt));

// The packs that have a button, read from PACKS in seed.js.
const seed = read('../seed.js');
const packsBlock = seed.match(/const PACKS = \{([\s\S]*?)\n\};/);
const packs = {};
for (const m of packsBlock[1].matchAll(/\n {2}([a-zA-Z0-9_]+): \{\s*\n?\s*file: '([^']+)'[^\n]*listKey: '([^']+)'/g)) {
  packs[m[1]] = { file: m[2], listKey: m[3] };
}
const exempt = [...seed.match(/const UNREACHABLE_PACKS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)]
  .map(m => m[1]);

const named = Object.keys(packs).filter(n => !exempt.includes(n));
if (named.length < 5) fail(`expected at least five packs with a button, read ${named.length}: ${named.join(', ')}`);

for (const name of named) {
  const { file, listKey } = packs[name];
  const rows = JSON.parse(read('../' + file))[listKey];
  const carried = new Set();
  for (const r of rows) for (const k of Object.keys(r)) if (k !== 'code') carried.add(k);

  const dict = LABELS[name];
  if (!dict) { fail(`${name}: no dictionary at all`); continue; }

  for (const f of carried) {
    if (!dict[f]) fail(`${name}.${f} is carried by the pack and has no name — the preview would print „${f}"`);
  }
  for (const [f, key] of Object.entries(dict)) {
    if (!carried.has(f)) fail(`${name}.${f} is named, and no row of the pack carries it — prune it`);
    if (!BG.has(key)) fail(`${name}.${f} → '${key}' is missing from the Bulgarian block`);
    if (!EN.has(key)) fail(`${name}.${f} → '${key}' is missing from the English block`);
  }
}

if (bad) process.exit(1);
console.log(`every field of ${named.length} packs is named in both languages, and no name is stale.`);

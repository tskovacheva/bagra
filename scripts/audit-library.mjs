// scripts/audit-library.mjs — is the library done, by the owner's definition?
//
// The Definition of Done for Plant Library v1 is the owner's, written down and
// agreed. This runs it. It is a permanent layer rather than a one-off script
// because a definition of done that cannot be re-run is a claim made once about
// a moment that has passed.
//
// TWO KINDS OF GAP, and the distinction is the point of the whole thing.
//
//   INTENTIONAL — the source does not say, and nobody is going to make it say.
//                 An eco print record whose review described the print and the
//                 colour and never mentioned the cloth has `fibreClass: null`
//                 and that is the finished state of that field.
//   UNRESOLVED  — somebody could still answer it.
//
// Counting the first as work outstanding is how a library that is finished goes
// on looking unfinished for ever, and how a real gap gets lost among fifty that
// are not. §6 of the Definition says so explicitly.
//
//   node scripts/audit-library.mjs

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

const plants = JSON.parse(fs.readFileSync('seed/plants.json', 'utf8')).plants;
const combos = JSON.parse(fs.readFileSync('seed/combinations.json', 'utf8')).combinations;
const sources = JSON.parse(fs.readFileSync('seed/sources.json', 'utf8')).sources;
const vocabSrc = fs.readFileSync('vocab.js', 'utf8');

const V = {};
for (const m of vocabSrc.matchAll(/V\('([a-z_]+)',\s*'([a-zA-Z0-9_]+)',/g)) {
  (V[m[1]] ||= new Set()).add(m[2]);
}

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed = true; console.log('  FAIL ' + m); };
const line = (m) => console.log('       ' + m);

const byCode = Object.fromEntries(plants.map(p => [p.code, p]));
const plantOf = (r) => r.key.dyeSource.plantId.replace(/^seed:/, '');
const name = (p) => (p.nameCommon?.bg) || p.code;

// ---------------------------------------------------------------- §1
console.log('\n§1  every plant has a full basic profile');
const PROFILE = ['nameCommon', 'nameBotanical', 'family', 'plantType', 'habitat',
                 'description', 'dyeClass', 'lightfastness', 'washfastness'];
const incomplete = plants.filter(p =>
  PROFILE.some(f => !p[f]) || !p.toxicity?.level);
incomplete.length === 0
  ? ok(`${plants.length}/${plants.length} plants carry every field of the basic profile`)
  : bad(`${incomplete.length} incomplete: ${incomplete.map(p => p.code).join(', ')}`);

// ---------------------------------------------------------------- §2
console.log('\n§2  every part is structured');
const parts = plants.flatMap(p => (p.parts || []).map(pt => ({ p, pt })));
// A season is required of a part that is GATHERED. Brazilwood, cutch and henna
// are bought — `sourcedNotGathered` says so on the record — and there is no
// month to name, because the question does not apply to them. Asking for one is
// the „unknown" and „not applicable" confusion the model already distinguishes
// here and has an open question about elsewhere (§16.00). The first version of
// this audit failed all seven of them and was wrong to.
const gathered = parts.filter(({ pt }) => !pt.sourcedNotGathered);
const bought = parts.length - gathered.length;
const badPart = gathered.filter(({ pt }) =>
  !V.plant_part?.has(pt.partCode) || !(pt.harvestMonths || []).length);
badPart.length === 0
  ? ok(`${gathered.length} gathered parts, each with a known code and a season` +
       (bought ? `; ${bought} bought, where a season does not apply` : ''))
  : bad(`${badPart.length} gathered without a code or a season: ` +
        badPart.slice(0, 5).map(x => `${x.p.code}/${x.pt.partCode}`).join(', '));

const withChem = parts.filter(({ pt }) => (pt.chemistry || []).length).length;
const withDose = parts.filter(({ pt }) => (pt.dosing || []).length).length;
line(`chemistry on ${withChem}/${parts.length}, dosing on ${withDose}/${parts.length}`);

// ---------------------------------------------------------------- §3
console.log('\n§3  the unknown stays unknown');
// The failure this guards is a value written to make a blank disappear. `mixed`
// on a fibre class is the one to watch: it does not mean „works on both", it
// means the cloth itself was a blend, and using it to paper over „does not say"
// would make the reference engine answer a question nobody asked.
const mixedFibre = combos.filter(r => r.key.fibreClass === 'mixed');
mixedFibre.length === 0
  ? ok('no record uses `mixed` as a fibre class')
  : bad(`${mixedFibre.length} records say mixed: ${mixedFibre.map(r => r.code).join(', ')}`);

const emptyColour = combos.filter(r => !(r.expected.colourText?.bg || '').trim());
emptyColour.length === 0
  ? ok('every combination says what colour to expect')
  : bad(`${emptyColour.length} with no expected colour: ${emptyColour.slice(0, 4).map(r => r.code).join(', ')}`);

// A swatch invented from prose is false precision (§9). Records that carry one
// should have got it from somewhere; records that do not should simply not draw.
const hexed = combos.filter(r => r.expected.swatchHex).length;
line(`${hexed}/${combos.length} carry a measured swatch; the rest draw none, which is honest`);

// ---------------------------------------------------------------- §4
console.log('\n§4  every plant has a usable combination, or is a known gap');
const covered = new Set(combos.map(plantOf));
const uncovered = plants.filter(p => !covered.has(p.code));
line(`${covered.size}/${plants.length} plants have at least one combination`);

// A known gap is one the owner has written a reason for. The file is read
// rather than a list being kept here, so the reason and the exemption cannot
// drift apart — an exemption whose reason lives somewhere else is an exemption
// nobody can check.
const decisions = fs.readFileSync('DOCUMENTATION_DECISIONS_NEEDED.md', 'utf8');
const documented = uncovered.filter(p => decisions.includes(p.code));
const undocumented = uncovered.filter(p => !decisions.includes(p.code));
undocumented.length === 0
  ? ok(uncovered.length
      ? `${uncovered.length} without one, every one of them documented: ${documented.map(p => name(p)).join(', ')}`
      : 'every plant has one')
  : bad(`${undocumented.length} without a combination and without a reason: ` +
        undocumented.map(p => name(p)).join(', '));

// ---------------------------------------------------------------- §5
console.log('\n§5  no obvious semantic error in the combinations');

// An iron BLANKET is a cloth soaked in iron water and laid against the work.
// An iron MORDANT is iron taken up by the fibre beforehand. They give different
// results and a record that confuses them tells somebody to do the wrong thing.
const blanketAsMordant = combos.filter(r =>
  r.key.blanket === 'iron' && r.key.mordantCode === 'iron');
blanketAsMordant.length === 0
  ? ok('no record claims an iron blanket AND an iron mordant as one thing')
  : bad(`${blanketAsMordant.length}: ${blanketAsMordant.map(r => r.code).join(', ')}`);

// pH is a medium, not a mordant. Soda ash is not something the fibre takes up.
const PH_WORDS = ['alkaline', 'acid', 'soda', 'vinegar', 'ph'];
const phAsMordant = combos.filter(r =>
  r.key.mordantCode && PH_WORDS.some(w => String(r.key.mordantCode).toLowerCase().includes(w)));
phAsMordant.length === 0
  ? ok('no pH modifier is recorded in the mordant field')
  : bad(`${phAsMordant.length}: ${phAsMordant.map(r => r.code).join(', ')}`);

// One record, one answer. Two records with the same key are two answers to one
// question, and the reference engine would show whichever it read last.
const keys = new Map();
for (const r of combos) {
  const k = JSON.stringify([plantOf(r), r.key.dyeSource.partCode, r.key.fibreClass,
                            r.key.mordantCode, r.key.mordantBand, r.key.processCode,
                            r.key.blanket, r.key.medium]);
  if (!keys.has(k)) keys.set(k, []);
  keys.get(k).push(r.code);
}
const dupes = [...keys.values()].filter(v => v.length > 1);
dupes.length === 0
  ? ok('no two records answer the same question')
  : bad(`${dupes.length} duplicated keys: ${dupes.slice(0, 3).map(d => d.join(' / ')).join('  |  ')}`);

// ---------------------------------------------------------------- §6
console.log('\n§6  eco print may knowingly not name a fibre');
const eco = combos.filter(r => r.key.processCode === 'ecoprint');
const ecoNoFibre = eco.filter(r => !r.key.fibreClass);
const immersionNoFibre = combos.filter(r => r.key.processCode !== 'ecoprint' && !r.key.fibreClass);
line(`${eco.length} eco print records, ${ecoNoFibre.length} of them intentionally silent on fibre`);
line(`${immersionNoFibre.length} non-eco-print records still do not name one — these are the real gap`);
ok('the two are counted apart, and only the second is work outstanding');

// ---------------------------------------------------------------- §7
console.log('\n§7  provenance is sufficient without a bibliography per cell');
const codes = new Set(sources.map(s => s.code));
const cited = new Set(combos.map(r => r.learnedFrom).filter(Boolean));
const unresolved = [...cited].filter(c => !codes.has(c) && !c.includes(' '));
unresolved.length === 0
  ? ok(`${sources.length} sources registered; every code cited resolves in the register`)
  : bad(`cited but not registered: ${unresolved.join(', ')}`);
const freeText = [...cited].filter(c => c.includes(' ')).length;
line(`${freeText} distinct attributions are still free text rather than a code`);

// ---------------------------------------------------------------- §10
console.log('\n§10 no invalid code anywhere');
const invalid = [];
for (const r of combos) {
  const check = [['fibre_class', r.key.fibreClass], ['process', r.key.processCode],
                 ['confidence', r.confidence], ['print_quality', r.expected.printQuality]];
  for (const [dim, val] of check) {
    if (val && !V[dim]?.has(val)) invalid.push(`${r.code}: ${dim}=${val}`);
  }
  if (r.key.mordantCode && r.key.mordantCode !== 'none'
      && !V.mordant_type?.has(r.key.mordantCode)) {
    invalid.push(`${r.code}: mordant=${r.key.mordantCode}`);
  }
}
invalid.length === 0
  ? ok(`${combos.length} combinations, no code outside the vocabulary`)
  : bad(`${invalid.length}: ${invalid.slice(0, 6).join('; ')}`);

// ---------------------------------------------------------------- integrity
console.log('\nnothing points at anything that is not there');

const plantCodes = new Set(plants.map(p => p.code));
const partsOf = new Map(plants.map(p => [p.code, new Set((p.parts || []).map(x => x.partCode))]));

const orphanPlant = combos.filter(r => !plantCodes.has(plantOf(r)));
orphanPlant.length === 0
  ? ok(`every one of the ${combos.length} combinations names a plant that exists`)
  : bad(`${orphanPlant.length} name no such plant: ${orphanPlant.slice(0, 4).map(r => r.code).join(', ')}`);

// A part is a claim about the plant, not a convenience for the record. A
// combination naming a part its plant does not have is the alder buckthorn
// question (decision 14) arriving unnoticed.
const orphanPart = combos.filter(r => {
  const set = partsOf.get(plantOf(r));
  const part = r.key.dyeSource?.partCode;
  return set && part && !set.has(part);
});
orphanPart.length === 0
  ? ok('and a part its plant actually has')
  : bad(`${orphanPart.length} name a part the plant has not: ` +
        orphanPart.slice(0, 4).map(r => `${r.code}`).join(', '));

const sourceCodes = new Set(sources.map(s => s.code));
const badSource = [];
for (const r of combos) {
  for (const c of r.sourceCodes || []) if (!sourceCodes.has(c)) badSource.push(`${r.code}→${c}`);
  for (const i of r.influences || []) {
    if (i.sourceCode && !sourceCodes.has(i.sourceCode)) badSource.push(`${r.code}→${i.sourceCode}`);
  }
}
badSource.length === 0
  ? ok('every source code cited by a record or an influence resolves in the register')
  : bad(`${badSource.length} orphan source reference(s): ${badSource.slice(0, 4).join(', ')}`);

// A closed list, checked. A factor outside it is a free-text field wearing a
// label, which is what `influences` was built to stop being.
const FACTORS = V.influence_factor || new Set();
const badFactor = [];
let influenceCount = 0;
for (const r of combos) {
  for (const i of r.influences || []) {
    influenceCount++;
    if (!FACTORS.has(i.factor)) badFactor.push(`${r.code}: ${i.factor}`);
    if (!(i.text?.bg || '').trim()) badFactor.push(`${r.code}: an influence with no text`);
  }
}
badFactor.length === 0
  ? ok(`${influenceCount} influences across ${combos.filter(r => (r.influences || []).length).length} records, every factor known`)
  : bad(`${badFactor.length}: ${badFactor.slice(0, 4).join('; ')}`);

// The eucalyptus case, named because it is the one the owner set as the test of
// whether the collected knowledge survived: unmordanted protein fibre, and the
// species being what decides the colour.
{
  const euc = combos.find(r => r.code === 'eucalyptus_spp_leaf_nomordant_immersion');
  const problems = [];
  if (!euc) problems.push('the record is missing');
  else {
    if (euc.key.fibreClass !== 'protein') problems.push(`fibre is ${euc.key.fibreClass}`);
    if (euc.key.mordantCode !== 'none') problems.push(`mordant is ${euc.key.mordantCode}`);
    const sp = (euc.influences || []).find(i => i.factor === 'species');
    if (!sp) problems.push('no species influence');
    else {
      if (!/cinerea/.test(sp.text?.bg || '')) problems.push('the species note does not name the species');
      if (sp.sourceCode !== 'ellis-natural-dye') problems.push(`the evidence source is ${sp.sourceCode}`);
    }
    if (!(euc.sourceCodes || []).includes('crafty-place-guide'))
      problems.push('the original colour source was replaced rather than joined');
  }
  problems.length === 0
    ? ok('eucalyptus: unmordanted protein, the species decides, Ellis cited, the colour source kept')
    : bad('eucalyptus: ' + problems.join('; '));
}

// The single-source records still work. A list that broke them would be a
// migration that fixed one thing and quietly cost 126 others.
const noSources = combos.filter(r => !(r.sourceCodes || []).length && !r.learnedFrom);
noSources.length === 0
  ? ok('and no record was left without a source by the change')
  : bad(`${noSources.length} records now cite nothing`);

// ---------------------------------------------------------------- the tally
console.log('\n— the tally the Definition asks for —');
line(`plants with a full basic profile     ${plants.length - incomplete.length}/${plants.length}`);
line(`plants with at least one combination ${covered.size}/${plants.length}`);
line(`plants without one                   ${uncovered.length}` +
     (uncovered.length ? ` — ${uncovered.map(p => name(p)).join(', ')}` : ''));
line(`combination records                  ${combos.length}`);
line(`  of them eco print                  ${eco.length}`);
line(`intentional nulls (eco print fibre)  ${ecoNoFibre.length}`);
line(`unresolved gaps (other fibre)        ${immersionNoFibre.length}`);
line(`sources registered                   ${sources.length}`);

console.log(failed ? '\nLIBRARY AUDIT FAILED' : '\nPlant Library v1 — every clause of the Definition holds');
process.exit(failed ? 1 : 0);

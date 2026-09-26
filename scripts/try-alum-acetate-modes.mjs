// scripts/try-alum-acetate-modes.mjs — the aluminium acetate calculator answers
// two different questions and must keep answering both (§13ff).
//
//   mode 'finished' — the % WOF is the FINISHED acetate (the stoichiometric target)
//   mode 'source'   — the % WOF is the chosen aluminium SALT, as recipes state it
//
// Regressions, not illustrations: the 311 g case is the owner's own, and the rest
// hold the claims the screen makes — a hydrate is not a swap for an anhydrous
// salt, vinegar strength moves the volume and not the acid, and the fixed
// Crafty Place recipe is a recipe rather than the stoichiometric answer.
//
//   node scripts/try-alum-acetate-modes.mjs

let failed = 0;
import fs from 'node:fs';
const { aluminiumAcetate } = await import('../calc/alum-acetate.js');
const subs = Object.fromEntries(JSON.parse(fs.readFileSync('seed/substances.json','utf8')).substances.map(s => [s.code, { id: 'seed:'+s.code, ...s }]));
const ok = (c, m) => { if (!c) failed++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// --- mode 1, the stated regression case -----------------------------------------
let r = aluminiumAcetate({ fabricWeightG: 311, percentWof: 8, mode: 'finished',
  aluminiumSubstance: subs.al_sulfate_anhydrous, sodiumSubstance: subs.soda_ash, vinegarPercent: 6 });
ok(near(r.targetAluminiumAcetateG, 24.88, 0.06) && near(r.aluminiumSource.grams, 20.85, 0.06)
   && near(r.sodiumSource.grams, 19.38, 0.06) && near(r.acid.vinegarMl, 366, 1),
   `mode 1 · 311 g, 8%, anhydrous sulfate, 6% vinegar → acetate ${r.targetAluminiumAcetateG} g, Al₂(SO₄)₃ ${r.aluminiumSource.grams} g, Na₂CO₃ ${r.sodiumSource.grams} g, vinegar ${r.acid.vinegarMl} ml`);

// mode 1 with a hydrated salt: more salt for the same acetate, same soda and acid
const hyd = aluminiumAcetate({ fabricWeightG: 311, percentWof: 8, mode: 'finished',
  aluminiumSubstance: subs.al_sulfate_18, sodiumSubstance: subs.soda_ash, vinegarPercent: 6 });
ok(hyd.aluminiumSource.grams > r.aluminiumSource.grams * 1.9
   && near(hyd.sodiumSource.grams, r.sodiumSource.grams, 0.05) && near(hyd.acid.vinegarMl, r.acid.vinegarMl, 1),
   `mode 1 · the 18-hydrate needs ${hyd.aluminiumSource.grams} g where the anhydrous needs ${r.aluminiumSource.grams} g — same soda and vinegar`);

// mode 1 with potassium alum, and 5% vinegar
const k1 = aluminiumAcetate({ fabricWeightG: 100, percentWof: 8, mode: 'finished',
  aluminiumSubstance: subs.alum_potassium_12, sodiumSubstance: subs.soda_ash, vinegarPercent: 5 });
ok(near(k1.targetAluminiumAcetateG, 8, 0.05) && near(k1.aluminiumSource.grams, 18.6, 0.1),
   `mode 1 · 100 g, 8% finished, potassium alum → ${k1.aluminiumSource.grams} g alum, ${k1.sodiumSource.grams} g soda, ${k1.acid.vinegarMl} ml of 5%`);

// --- mode 2, the stated example ---------------------------------------------------
const k2 = aluminiumAcetate({ fabricWeightG: 100, percentWof: 18, mode: 'source',
  aluminiumSubstance: subs.alum_potassium_12, sodiumSubstance: subs.soda_ash, vinegarPercent: 5 });
ok(near(k2.aluminiumSource.grams, 18, 0.01),
   `mode 2 · 100 g, 18% of potassium alum → starts from exactly ${k2.aluminiumSource.grams} g of alum`);
ok(near(k2.targetAluminiumAcetateG, 7.75, 0.06) && near(k2.sodiumSource.grams, 6.03, 0.06) && near(k2.acid.vinegarMl, 136.7, 0.5),
   `  and follows to ${k2.targetAluminiumAcetateG} g acetate, ${k2.sodiumSource.grams} g soda, ${k2.acid.vinegarMl} ml of 5% vinegar`);

// mode 2 with a different salt at the same percentage: different chemistry, not a swap
const s2 = aluminiumAcetate({ fabricWeightG: 100, percentWof: 18, mode: 'source',
  aluminiumSubstance: subs.al_sulfate_anhydrous, sodiumSubstance: subs.soda_ash, vinegarPercent: 5 });
ok(s2.targetAluminiumAcetateG > k2.targetAluminiumAcetateG * 2.5,
   `mode 2 · 18% of anhydrous sulfate carries far more aluminium: ${s2.targetAluminiumAcetateG} g acetate against ${k2.targetAluminiumAcetateG} g — not a gram-for-gram swap`);

// the two modes are NOT the same answer
ok(Math.abs(k1.aluminiumSource.grams - k2.aluminiumSource.grams) > 0.5,
   `the two modes answer differently at the same numbers: ${k1.aluminiumSource.grams} g against ${k2.aluminiumSource.grams} g of alum`);

// --- vinegar strength: same acid, scaled volume ------------------------------------
const v5 = aluminiumAcetate({ fabricWeightG: 100, percentWof: 8, mode: 'finished',
  aluminiumSubstance: subs.alum_potassium_12, sodiumSubstance: subs.soda_ash, vinegarPercent: 5 });
const v6 = aluminiumAcetate({ fabricWeightG: 100, percentWof: 8, mode: 'finished',
  aluminiumSubstance: subs.alum_potassium_12, sodiumSubstance: subs.soda_ash, vinegarPercent: 6 });
ok(near(v5.acid.aceticAcidG, v6.acid.aceticAcidG, 0.02) && near(v5.acid.vinegarMl * 5, v6.acid.vinegarMl * 6, 1.5),
   `vinegar strength scales the volume, not the acid: ${v5.acid.vinegarMl} ml of 5% ≈ ${v6.acid.vinegarMl} ml of 6% (${v5.acid.aceticAcidG} g acetic acid both)`);
ok(near(240 * 5 / 6, 200, 0.5), 'and the stated ratio holds: 240 ml of 5% ≈ 200 ml of 6%');

// --- sodium acetate needs no acid, in either mode ------------------------------------
const noAcid = aluminiumAcetate({ fabricWeightG: 100, percentWof: 18, mode: 'source',
  aluminiumSubstance: subs.alum_potassium_12, sodiumSubstance: subs.sodium_acetate, vinegarPercent: 5 });
ok(noAcid.acid === null && noAcid.sodiumSource.grams > 0, 'mode 2 with sodium acetate: no vinegar line, as before');

// --- the fixed recipe is a recipe, not the stoichiometric answer -----------------------
ok(Math.abs(k2.sodiumSource.grams - 10) > 1 && Math.abs(k2.acid.vinegarMl - 240) > 50,
   `the fixed recipe (18 / 10 g / 240 ml) is NOT what the stoichiometry returns (${k2.sodiumSource.grams} g / ${k2.acid.vinegarMl} ml) — the calculator does not claim they match`);

if (failed) { console.log(`alum acetate modes: ${failed} FAILED`); process.exit(1); }
console.log('alum acetate modes: both modes answer, and answer differently.');

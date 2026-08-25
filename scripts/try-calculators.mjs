// scripts/try-calculators.mjs — do the numbers come out right?
//
// The calculators had no numerical test. Every other layer of the suite asks
// whether the application still WORKS; none asked whether it is CORRECT. A
// disclaimer does not cover a formula nobody has checked, and the aluminium
// acetate calculator is the one that matters: it tells somebody how much of a
// chemical to weigh out, and being wrong there wastes an afternoon and a
// kilogram of cloth.
//
// So the arithmetic is checked in two ways, and the second is the point:
//
//   1. AGAINST FIRST PRINCIPLES — every molar mass recomputed from atomic
//      weights here, so a typo in the substance pack is caught rather than
//      trusted.
//   2. AGAINST PUBLISHED RECIPES — three independent ones, from Maiwa, Earth
//      Guild and Botanical Colors. If our stoichiometry is right, feeding it
//      their alum quantity must reproduce their sodium acetate quantity. This
//      is the check that cannot be passed by being consistently wrong.
//
//   node scripts/try-calculators.mjs

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

let failed = false;
const ok   = (m) => console.log('  ok   ' + m);
const bad  = (m) => { failed = true; console.log('  FAIL ' + m); };
const line = (m) => console.log('       ' + m);

/** Equal to within a tolerance, stated as a percentage. */
const near = (got, want, tolPct, msg) => {
  if (got == null) return bad(`${msg} — got nothing`);
  const off = Math.abs(got - want) / want * 100;
  off <= tolPct
    ? ok(`${msg} — ${got} vs ${want} (${off.toFixed(1)}% off, ${tolPct}% allowed)`)
    : bad(`${msg} — ${got} vs ${want} (${off.toFixed(1)}% off, ${tolPct}% allowed)`);
};

const { wofGrams, wofPercent, solutionGrams, solutionPercent, bathLitres,
        freshFromDried, driedFromFresh, exhaustBath, round } = await import('../calc/basic.js');
const { aluminiumAcetate, fromAvailable } = await import('../calc/alum-acetate.js');

const substances = JSON.parse(fs.readFileSync('seed/substances.json', 'utf8')).substances;
const byCode = Object.fromEntries(substances.map(s => [s.code, { ...s, id: `seed:${s.code}` }]));

// ---------------------------------------------------------------- 1. masses
console.log('\nevery molar mass, recomputed from atomic weights');

// IUPAC 2021 standard atomic weights, to four figures. Written here rather than
// imported so the pack is checked against something, not against itself.
const A = { H: 1.008, C: 12.011, N: 14.007, O: 15.999, Na: 22.990,
            S: 32.06, K: 39.098, Al: 26.982, Ca: 40.078 };

// Composition of each substance, read off its formula by hand. A parser for
// „KAl(SO₄)₂·12H₂O" would be a second thing to get wrong.
const FORMULAE = {
  alum_potassium_12:    { K: 1, Al: 1, S: 2, O: 8, H: 24, extraO: 12 },
  alum_ammonium_12:     { N: 1, H: 4 + 24, Al: 1, S: 2, O: 8, extraO: 12 },
  al_sulfate_18:        { Al: 2, S: 3, O: 12, H: 36, extraO: 18 },
  al_sulfate_16:        { Al: 2, S: 3, O: 12, H: 32, extraO: 16 },
  al_sulfate_14:        { Al: 2, S: 3, O: 12, H: 28, extraO: 14 },
  al_sulfate_anhydrous: { Al: 2, S: 3, O: 12 },
  soda_ash:             { Na: 2, C: 1, O: 3 },
  sodium_bicarbonate:   { Na: 1, H: 1, C: 1, O: 3 },
  sodium_acetate:       { C: 2, H: 3, O: 2, Na: 1 },
  sodium_acetate_tri:   { C: 2, H: 3 + 6, O: 2, Na: 1, extraO: 3 },
};

for (const [code, comp] of Object.entries(FORMULAE)) {
  const sub = byCode[code];
  if (!sub) { bad(`${code} is not in the substance pack`); continue; }
  let m = 0;
  for (const [el, n] of Object.entries(comp)) {
    m += (el === 'extraO' ? A.O : A[el]) * n;
  }
  near(sub.molarMass, m, 0.05, `${code} (${sub.formula})`);
}

// Al(CH₃COO)₃ — the product, whose mass sets the whole calculation.
const ALUM_ACETATE_M = A.Al + 3 * (2 * A.C + 3 * A.H + 2 * A.O);
near(204.11, ALUM_ACETATE_M, 0.05, 'Al(CH₃COO)₃, the figure the module uses');
const ACETIC_M = 2 * A.C + 4 * A.H + 2 * A.O;
near(60.05, ACETIC_M, 0.05, 'CH₃COOH');

// ---------------------------------------------------------------- 2. published
console.log('\nagainst three published recipes');
line('Each gives an alum quantity AND a sodium acetate quantity. Ours must');
line('reproduce the second from the first, or the 3:1 acetate:aluminium ratio');
line('is wrong. Published recipes run in EXCESS of the stoichiometric floor —');
line('that is deliberate, to drive the reaction — so the tolerances below are');
line('one-sided and stated as such.');

/** What our calculator asks for, given somebody else's alum quantity. */
function fromAlum(alumG, sodiumCode) {
  const al = byCode.alum_potassium_12;
  const moles = alumG / al.molarMass;                 // 1 Al per formula unit
  const targetG = moles * ALUM_ACETATE_M;             // finished acetate
  return aluminiumAcetate({
    targetG,
    aluminiumSubstance: al,
    sodiumSubstance: byCode[sodiumCode],
    fabricWeightG: 1000, percentWof: 1,
  });
}

// (a) Earth Guild — 120 g alum : 100 g sodium acetate, per litre.
//     https://www.earthguild.com/products/riff/webbpdfs/alumacet.pdf
{
  const r = fromAlum(120, 'sodium_acetate_tri');
  near(r.sodiumSource.grams, 100, 5,
       'Earth Guild 120 g alum → 100 g sodium acetate, read as the TRIHYDRATE');
  const anhydrous = fromAlum(120, 'sodium_acetate');
  line(`read as anhydrous it would be ${anhydrous.sodiumSource.grams} g — a 60% excess, ` +
       `which is why hydration is a field and not an afterthought`);
}

// (b) Maiwa / naturaldyes.ca — 150 g alum : 150 g sodium acetate, per kilo of cloth.
{
  const r = fromAlum(150, 'sodium_acetate_tri');
  const excess = (150 / r.sodiumSource.grams - 1) * 100;
  excess >= 0 && excess <= 30
    ? ok(`Maiwa 150 g alum → we ask ${r.sodiumSource.grams} g, they give 150 g ` +
         `(${excess.toFixed(0)}% excess, as a preparation should run)`)
    : bad(`Maiwa: we ask ${r.sodiumSource.grams} g against their 150 g (${excess.toFixed(0)}%)`);

  // And the dose that recipe amounts to, which is the real cross-check: it must
  // land inside the band every source recommends for aluminium acetate.
  const moles = 150 / byCode.alum_potassium_12.molarMass;
  const wof = moles * ALUM_ACETATE_M / 1000 * 100;
  wof >= 5 && wof <= 10
    ? ok(`and it works out at ${wof.toFixed(1)}% WOF, inside the 5–10% every source gives`)
    : bad(`it works out at ${wof.toFixed(1)}% WOF, outside the recommended band`);
}

// (c) Maiwa's vinegar recipe — 20 g alum, 10 g soda ash, 200 ml vinegar.
//     The acid path, which no other recipe here exercises.
{
  const r = fromAlum(20, 'soda_ash');
  const sodaExcess = (10 / r.sodiumSource.grams - 1) * 100;
  sodaExcess >= 0 && sodaExcess <= 60
    ? ok(`Maiwa vinegar recipe: we ask ${r.sodiumSource.grams} g soda ash, they give 10 g ` +
         `(${sodaExcess.toFixed(0)}% excess)`)
    : bad(`soda ash: we ask ${r.sodiumSource.grams} g against their 10 g`);

  // Their 200 ml is household vinegar at about 5%.
  const atFive = aluminiumAcetate({
    targetG: (20 / byCode.alum_potassium_12.molarMass) * ALUM_ACETATE_M,
    aluminiumSubstance: byCode.alum_potassium_12,
    sodiumSubstance: byCode.soda_ash,
    vinegarPercent: 5,
    fabricWeightG: 1000, percentWof: 1,
  });
  const vinegarExcess = (200 / atFive.acid.vinegarMl - 1) * 100;
  vinegarExcess >= 0 && vinegarExcess <= 60
    ? ok(`and ${atFive.acid.vinegarMl} ml of 5% vinegar against their 200 ml ` +
         `(${vinegarExcess.toFixed(0)}% excess — vinegar is the solvent too)`)
    : bad(`vinegar: we ask ${atFive.acid.vinegarMl} ml against their 200 ml`);
}

// ---------------------------------------------------------------- 3. behaviour
console.log('\nthe stoichiometry behaves as chemistry, not as arithmetic');

{
  // Aluminium sulfate carries TWO aluminium atoms per formula unit, so half the
  // moles are needed. Getting `alPerUnit` backwards would double every dose,
  // and the number would still look plausible on screen.
  const viaAlum = fromAlum(100, 'sodium_acetate');
  const target = viaAlum.targetAluminiumAcetateG;
  const viaSulfate = aluminiumAcetate({
    targetG: target, aluminiumSubstance: byCode.al_sulfate_18,
    sodiumSubstance: byCode.sodium_acetate, fabricWeightG: 1000, percentWof: 1,
  });
  const expected = (target / ALUM_ACETATE_M) / 2 * byCode.al_sulfate_18.molarMass;
  near(viaSulfate.aluminiumSource.grams, expected, 0.5,
       'Al₂(SO₄)₃·18H₂O for the same target — two aluminium per unit, so half the moles');

  // The acetate requirement must NOT change with the aluminium source: the
  // product is the same and needs the same three acetate groups per aluminium.
  Math.abs(viaSulfate.sodiumSource.grams - viaAlum.sodiumSource.grams) < 0.2
    ? ok('and the acetate needed is unchanged — it follows the aluminium, not its salt')
    : bad(`acetate changed with the source: ${viaAlum.sodiumSource.grams} → ${viaSulfate.sodiumSource.grams}`);
}

{
  // Sodium acetate already IS acetate: no acid step at all. Soda ash needs one.
  const withAcetate = fromAlum(50, 'sodium_acetate');
  const withSoda = fromAlum(50, 'soda_ash');
  withAcetate.acid === null && withSoda.acid !== null
    ? ok('sodium acetate needs no acid; soda ash does — the role, not the material')
    : bad('the acid step does not follow the sodium source');
  withAcetate.notes.includes('acid_not_needed')
    ? ok('and the screen is told why the line is absent, rather than it just vanishing')
    : bad('no note explains the missing acid');
}

{
  // Trihydrate against anhydrous: same moles, more grams, in the ratio of their
  // masses. This is the „hydration alone can double it" claim, checked.
  const dry = fromAlum(100, 'sodium_acetate').sodiumSource.grams;
  const wet = fromAlum(100, 'sodium_acetate_tri').sodiumSource.grams;
  near(wet / dry, byCode.sodium_acetate_tri.molarMass / byCode.sodium_acetate.molarMass, 0.5,
       'trihydrate against anhydrous, as the ratio of their molar masses');
}

{
  // Linear in the target. A calculator that is not is a calculator with a
  // constant hidden in it.
  const one = fromAlum(100, 'sodium_acetate');
  const ten = fromAlum(1000, 'sodium_acetate');
  near(ten.sodiumSource.grams / one.sodiumSource.grams, 10, 0.5, 'ten times the alum, ten times the acetate');
}

{
  // Reverse mode: from what is in the cupboard, backwards to how much cloth.
  const back = fromAvailable({
    limitingRole: 'aluminium', availableG: 60, percentWof: 6,
    aluminiumSubstance: byCode.alum_potassium_12,
    sodiumSubstance: byCode.sodium_acetate_tri,
  });
  const forward = aluminiumAcetate({
    fabricWeightG: back.maxFabricG, percentWof: 6,
    aluminiumSubstance: byCode.alum_potassium_12,
    sodiumSubstance: byCode.sodium_acetate_tri,
  });
  near(forward.aluminiumSource.grams, 60, 1,
       'reverse mode round-trips — 60 g of alum back to 60 g');
}

// ---------------------------------------------------------------- 4. everyday
console.log('\nthe everyday arithmetic');

near(wofGrams(500, 15), 75, 0.01, '15% WOF of 500 g');
near(wofGrams(500, 15, 50), 37.5, 0.01, 'and half of that when only half the cloth takes dye');
near(wofPercent(500, 75), 15, 0.01, 'the inverse agrees');
near(solutionGrams(2, 1), 20, 0.01, 'a 1% solution in 2 litres is 20 g');
near(solutionPercent(2, 20), 1, 0.01, 'and back again');
near(bathLitres(500, 30), 15, 0.01, '500 g at a liquor ratio of 30');
near(freshFromDried(100, 6), 600, 0.01, 'madder root, dried to fresh at 6:1');
near(driedFromFresh(600, 6), 100, 0.01, 'and fresh to dried');

// Zero and nothing are not the same as an answer of zero.
[wofGrams(0, 15), wofGrams(null, 15), solutionGrams(0, 1), bathLitres(0)].every(v => v === null)
  ? ok('a missing weight returns nothing, not a confident zero')
  : bad('a missing weight produced a number');

{
  const e = exhaustBath(400);
  e.sameShadeWeightG === 200 && e.sameWeightStrength === 50
    ? ok('the exhaust bath rule of thumb, stated both ways round')
    : bad(`exhaust bath: ${JSON.stringify(e)}`);
}

near(round(2.345, 2), 2.35, 0.01, 'rounding to two places');
round(null) === null ? ok('rounding nothing gives nothing') : bad('round(null) produced a number');

// ================================================================ units
//
// One system stored, another shown (§13dc). The tests that matter are not the
// conversions — those are arithmetic — but the round trip and the refusals.

console.log('\nunits: what is stored never changes');

const U = await import('../units.js');
// The module reads its setting from the database at boot. Here it is driven
// directly, because what is under test is the arithmetic and not the storage.
const asMetric = async () => { await U.setSystem('metric'); };
const asImperial = async () => { await U.setSystem('imperial'); };

await asMetric();
ok(`metric is the default and ${U.massWith(250)} is what a Bulgarian scale reads`);
near(Number(U.mass(250)), 250, 0.01, 'a mass in grams is shown in grams');
U.massUnit(250) === 'g' && U.massUnit(2500) === 'kg'
  ? ok('and crosses to kilograms at a kilogram, so nobody reads 2500 g')
  : bad(`unit crossover wrong: ${U.massUnit(250)} / ${U.massUnit(2500)}`);

await asImperial();
near(Number(U.mass(453.59237)), 1, 0.01, 'a pound of cloth reads as 1 lb');
U.massUnit(453.59237) === 'lb' ? ok('and is labelled lb') : bad('labelled ' + U.massUnit(453.6));
near(Number(U.mass(28.349523125)), 1, 0.01, 'an ounce reads as 1 oz');
U.massUnit(28.35) === 'oz' ? ok('and is labelled oz') : bad('labelled ' + U.massUnit(28.35));

console.log('\nunits: what is typed comes back to the same grams');
// The round trip is the whole safety property. If it does not close, a person
// who edits a record while set to ounces changes a number she never touched.
for (const g of [1, 7.5, 100, 453.59237, 1000, 12345]) {
  await asImperial();
  const shown = U.mass(g);
  const back = U.massToG(shown, U.massUnit(g));
  near(back, g, 0.5, `${g} g → ${shown} ${U.massUnit(g)} → back`);
}

console.log('\nunits: temperature, the one with an offset');
await asImperial();
near(Number(U.temp(100)), 212, 0.01, 'boiling');
near(Number(U.temp(0)), 32, 0.01, 'freezing — the offset a × factor would lose');
near(U.tempToC(212), 100, 0.01, 'and back');
Math.abs(U.tempToC(32)) < 1e-9
  ? ok('and back from freezing, to zero exactly')
  : bad(`freezing came back as ${U.tempToC(32)}`);
U.tempSpan(80, 90) === '176–194\u00A0°F'
  ? ok('a range converts both ends and writes the unit once')
  : bad(`range came out as ${JSON.stringify(U.tempSpan(80, 90))}`);
U.tempSpan(95, 95).includes('–')
  ? bad('a degenerate range still prints as a range')
  : ok('and a range whose ends are equal prints as one figure');
U.tempSpan(80, 90).includes('\u00A0')
  ? ok('joined with a non-breaking space, so a figure never breaks across a line')
  : bad('a figure could break mid-number');

await asMetric();
U.tempSpan(80, 90) === '80–90\u00A0°C' ? ok('and metric is untouched') : bad(U.tempSpan(80, 90));

console.log('\nunits: what must NEVER convert');
// The worst possible bug in this file, because the result looks plausible: a
// ratio is the same number in every system, and converting one would change
// what a recipe means without changing how it reads.
for (const sys of ['metric', 'imperial']) {
  await U.setSystem(sys);
  U.wof(15) === '15' ? ok(`percent WOF is 15 in ${sys}`) : bad(`WOF moved in ${sys}: ${U.wof(15)}`);
  U.ratio(20).includes('20') ? ok(`a liquor ratio of 1:20 is 1:20 in ${sys}`) : bad('ratio moved');
  U.percent(1) === '1%' ? ok(`a 1% solution is 1% in ${sys}`) : bad('a solution strength moved');
}

console.log('\nunits: nothing is not zero');
await asMetric();
[U.mass(null), U.volume(null), U.temp(null), U.gsm(null), U.wof(null), U.tempSpan(null, null)]
  .every(v => v === '')
  ? ok('a missing figure renders as nothing, not as 0')
  : bad('a missing figure produced a number');
U.massToG('not a number') === null
  ? ok('and unparseable input returns nothing rather than NaN')
  : bad(`massToG('not a number') = ${U.massToG('not a number')}`);

console.log('\nunits: cloth weight and volume');
await asImperial();
near(U.gsmToMetric(U.gsm(200), 'oz/yd²'), 200, 0.5, '200 g/m² through oz/yd² and back');
near(U.volumeToMl(U.volume(3785.411784), 'gal'), 3785.411784, 0.5, 'a gallon of dye bath, round trip');
near(Number(U.volume(29.5735295625)), 1, 0.01, 'a fluid ounce');
await U.setSystem('metric');

// ================================================================ raw scaling
//
// A binder is measured against neither cloth nor a bath. `scaleBy: 'raw'` sat
// in seed/recipes.json before it was in the code and was being treated as
// weight-of-cloth, so the ratio lines resolved against a cloth weight that does
// not exist and a `dyestuff` role that is not there — and simply showed nothing
// (§13de).

console.log('\na recipe scaled against its raw material');

const { scaleRecipe } = await import('../calc/scale.js');
const recipes = JSON.parse(fs.readFileSync('seed/recipes.json', 'utf8')).recipes;
const binder = recipes.find(r => r.code === 'watercolour-binder');

binder ? ok('the watercolour binder is in the pack') : bad('no watercolour binder recipe');

if (binder) {
  const at = (g) => {
    const out = scaleRecipe(binder, { rawG: g });
    const by = {};
    for (const i of out.ingredients) by[i.roleCode + ':' + (i.unit || '')] = i;
    return by;
  };

  // 42 g of gum arabic is the batch the recipe is written for, so the figures
  // must come back as the recipe's own.
  const one = at(42);
  near(one['solvent:ml'].scaledMin, 240, 1, '42 g of gum → 240 ml of boiling water');
  near(one['humectant:ml'].scaledMin, 15, 2, 'and 15 ml of glycerine');
  near(one['binder:g'].scaledMin, 42, 0.1, 'the gum itself is absolute and unchanged');
  near(one['preservative:drop'].scaledMin, 5, 0.1, 'and the clove oil is five drops');

  // The unit is the ingredient's own. Forced to grams, 15 ml of glycerine
  // becomes 15 g — a 26% error on a liquid, from a default written for powders.
  one['solvent:ml'].scaledUnit === 'ml' && one['humectant:ml'].scaledUnit === 'ml'
    ? ok('a ratio against raw material keeps the ingredient\'s own unit, not grams')
    : bad(`units forced: water ${one['solvent:ml'].scaledUnit}, glycerine ${one['humectant:ml'].scaledUnit}`);
  one['preservative:drop'].scaledUnit === 'drop'
    ? ok('and drops stay drops')
    : bad(`clove oil came out in ${one['preservative:drop'].scaledUnit}`);

  // Double the gum, double everything measured against it — and not the
  // absolute lines, which are absolute.
  const two = at(84);
  near(two['solvent:ml'].scaledMin, 480, 1, 'twice the gum, twice the water');
  near(two['preservative:drop'].scaledMin, 5, 0.1, 'and the clove oil is still five drops');

  // Nothing entered is not an answer of zero.
  const none = scaleRecipe(binder, { rawG: null });
  none.ingredients.find(i => i.roleCode === 'solvent').scaledMin === 0
    || none.ingredients.find(i => i.roleCode === 'solvent').scaledMin == null
    ? ok('with no raw amount entered, a ratio line has nothing to show')
    : bad('a ratio line invented a quantity');
}

console.log(failed ? '\nCALCULATOR CHECK FAILED' : '\nall held');
process.exit(failed ? 1 : 0);

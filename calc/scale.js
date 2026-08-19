// calc/scale.js — scaling a recipe to an actual weight of goods (§9.1).
//
// This is the generic engine that serves every proportional recipe: scouring,
// tannin, mordanting, dyeing, blankets, indigo vats. Fifteen bespoke
// calculators would all have been this function with different constants.

import { round } from './basic.js';
import { aluminiumAcetate } from './alum-acetate.js';

/**
 * @param {object} recipe
 * @param {object} context
 * @param {number} context.weightG          weight of goods
 * @param {string} [context.fibreClass]     drops ingredients that do not apply
 * @param {number} [context.receptiveFraction=100]
 * @param {number} [context.liquorRatio]    overrides the recipe's own
 * @returns {{ ingredients: Array, bathLitres: number|null, dropped: Array }}
 */
// Quantities are ranges far more often than single figures: 8–10% tannin,
// 12–15% alum on wool, 50–100% dried madder. A model that stores one number
// forces the user to throw away half of what the source actually said.
function quantityRange(option, ing) {
  let min = option?.qtyMin ?? ing.quantityMin ?? ing.quantity ?? null;
  let max = option?.qtyMax ?? ing.quantityMax ?? null;

  // Filling only the upper bound used to yield a range starting at zero, which
  // reads as a real claim — "somewhere between nothing and 165 g". A single
  // figure, whichever box it landed in, is an exact quantity.
  if (min == null && max != null) min = max;
  if (max == null) max = min;
  if (min == null) return [null, null];

  return [Number(min), Number(max)];
}

function convert(quantity, basis, ctx) {
  if (quantity == null || Number.isNaN(quantity)) return null;
  switch (basis) {
    case 'percent_wof':
      return ctx.effectiveWeight * (quantity / 100);
    case 'grams_per_litre':
      return ctx.litres != null ? ctx.litres * quantity : null;
    case 'percent_of_bath':
      return ctx.litres != null ? ctx.litres * 1000 * (quantity / 100) : null;
    case 'ratio_to_dyestuff': {
      const dye = (ctx.recipe.ingredients || []).find(x => x.roleCode === 'dyestuff');
      if (!dye) return null;
      const dyeRange = quantityRange(dye.options?.[0], dye);
      const dyeAmount = ctx.effectiveWeight * (dyeRange[0] / 100);
      return dyeAmount * quantity;
    }
    case 'absolute':
    default:
      return quantity;
  }
}

export function scaleRecipe(recipe, {
  weightG,
  fibreClass = null,
  receptiveFraction = 100,
  liquorRatio = null,
  choices = null,        // { [ingredientId]: optionId } — which alternative is used
  bathLitres = null,     // used when the recipe is scaled by volume, not by cloth
  substancesById = null, // needed only by a recipe the chemistry computes (§13ak)
} = {}) {
  if (!recipe) return { ingredients: [], bathLitres: null, dropped: [] };

  const effectiveWeight = (weightG || 0) * (receptiveFraction / 100);

  // Some recipes are not scaled against cloth at all. A chalk finishing bath
  // is a standing solution — 10 g per litre, five litres of it — and the cloth
  // simply goes in. Treating volume as derived from weight distorts these.
  const byVolume = recipe.scaleBy === 'volume';
  const ratio = liquorRatio ?? recipe.liquorRatio ?? null;
  const litres = byVolume
    ? (bathLitres ?? recipe.defaultLitres ?? null)
    : (ratio ? (weightG / 1000) * ratio : null);

  const ingredients = [];
  const dropped = [];

  for (const ing of recipe.ingredients || []) {
    // Conditional ingredients: cream of tartar belongs with wool and nowhere
    // else. Non-matching lines are removed, not greyed out — the output should
    // be the list to weigh, not a list to filter mentally (§5.2).
    if (ing.whenFibreClass?.length && fibreClass && !ing.whenFibreClass.includes(fibreClass)) {
      dropped.push(ing);
      continue;
    }

    // An ingredient is a ROLE with one or more substances that can fill it.
    // "Tannin bath" is one recipe: gallnut at 8–10%, myrobalan at 20%, cutch
    // at 20%. Which one is chosen changes the quantity, not the recipe.
    const options = ing.options?.length ? ing.options : [{}];
    const chosenId = choices?.[ing.id];
    const option = options.find(o => o.id === chosenId) || options[0];

    const range = quantityRange(option, ing);
    const scaled = range.map(q => (q == null ? null : convert(q, ing.basis, {
      effectiveWeight, litres, recipe, fibreClass, choices,
    })));

    ingredients.push({
      ...ing,
      option,
      options,
      quantityMin: range[0],
      quantityMax: range[1],
      scaledMin: round(scaled[0], 2),
      scaledMax: round(scaled[1], 2),
      // A single figure when the range has collapsed, so callers that only
      // want one number do not have to decide which end to show.
      scaledAmount: scaled[0] === scaled[1] ? round(scaled[0], 2) : null,
      scaledUnit: ing.basis === 'absolute' ? (ing.unit || 'g') : 'g',
      basisRefersTo: ing.basisRefersTo || null,
    });
  }

  // A recipe that states a target rather than a set of percentages (§13ak).
  //
  // "Eight per cent aluminium acetate, made from whatever is in the cupboard"
  // is a target and a set of roles, not three stored numbers. Stored as
  // percentages it is a second copy of the chemistry the calculator already
  // does, and the two had already disagreed on screen: the calculator said one
  // thing and the recipe attached to the same cloth said another.
  //
  // So the quantities are not stored. They are computed here, by the same
  // function the calculator calls, from the substances actually chosen.
  if (recipe.computedBy === 'aluminium_acetate' && substancesById) {
    applyAluminiumAcetate(recipe, ingredients, { effectiveWeight, substancesById });
  }

  return { ingredients, bathLitres: round(litres, 2), dropped };
}

// Overwrites the quantities of the three roles the reaction defines. Written as
// an override rather than a separate path so that everything else about a
// recipe — conditional ingredients, alternatives within a role, the steps —
// keeps working unchanged.
function applyAluminiumAcetate(recipe, ingredients, { effectiveWeight, substancesById }) {
  const of = (role) => ingredients.find(i => i.roleCode === role);
  const sub = (ing) => {
    const id = ing?.option?.substanceId || ing?.substanceId;
    return id ? substancesById.get(id) : null;
  };

  const alIng = of('aluminium_source');
  const naIng = of('sodium_source');
  const acidIng = of('acid_source');
  const aluminiumSubstance = sub(alIng);
  const sodiumSubstance = sub(naIng);
  if (!aluminiumSubstance || !sodiumSubstance) return;

  const target = recipe.target || {};
  const percent = Number(target.percentWof ?? 0);
  if (!percent || !effectiveWeight) return;

  // The two bases of §5.1, and the reason a calculator and a book can both be
  // right while disagreeing. `finished_product` fixes the moles of acetate, so
  // the soda and the vinegar do not move when the aluminium salt changes —
  // only the weight of the salt does. `raw_input` fixes the weight of the salt,
  // so the moles of aluminium in it move with the hydration, and the soda and
  // vinegar follow. Published recipes are nearly always the second; packaged
  // acetate is dosed the first way.
  let targetG;
  if ((target.basisRefersTo || 'finished_product') === 'raw_input') {
    const rawG = effectiveWeight * (percent / 100);
    const molesAl = (rawG / aluminiumSubstance.molarMass) * aluminiumSubstance.alPerUnit;
    targetG = molesAl * 204.11;
  } else {
    targetG = effectiveWeight * (percent / 100);
  }

  const made = aluminiumAcetate({
    fabricWeightG: effectiveWeight,
    targetG,
    percentWof: percent,
    aluminiumSubstance,
    sodiumSubstance,
    vinegarPercent: Number(recipe.vinegarPercent ?? acidIng?.strengthPercent ?? 6),
  });
  if (!made) return;

  const set = (ing, value, unit) => {
    if (!ing || value == null) return;
    ing.scaledMin = value;
    ing.scaledMax = value;
    ing.scaledAmount = value;
    ing.scaledUnit = unit;
    ing.computed = true;
  };

  set(alIng, made.aluminiumSource.grams, 'g');
  set(naIng, made.sodiumSource.grams, 'g');
  if (made.acid) set(acidIng, made.acid.vinegarMl, 'ml');
  // Sodium acetate supplies the acetate ready-made, so there is no acid line to
  // fill in. Removing it is not tidying: an ingredient showing "0 ml" reads as
  // an instruction to add none of something that belongs in the recipe.
  else if (acidIng) { acidIng.notNeeded = true; }

  ingredients.targetAluminiumAcetateG = made.targetAluminiumAcetateG;
}

/**
 * Warnings a scaled recipe should raise before anything is weighed.
 * Substances carry ceilings; this is where they are actually enforced.
 * @param {Map<string,object>} substancesById
 */
export function recipeWarnings(recipe, scaled, substancesById = new Map()) {
  const out = [];

  for (const ing of scaled.ingredients) {
    const substanceId = ing.option?.substanceId || ing.substanceId;
    const sub = substanceId ? substancesById.get(substanceId) : null;
    if (!sub) continue;

    if (sub.maxPercentWof != null && ing.basis === 'percent_wof' &&
        Number(ing.quantityMax ?? ing.quantityMin) > sub.maxPercentWof) {
      out.push({
        kind: 'error', code: 'over_max_wof', ingredient: ing,
        limit: sub.maxPercentWof, value: Number(ing.quantityMax ?? ing.quantityMin),
      });
    }

    if (sub.maxTempC != null && recipe.tempC != null && recipe.tempC > sub.maxTempC) {
      out.push({
        kind: 'error', code: 'over_max_temp', ingredient: ing,
        limit: sub.maxTempC, value: recipe.tempC,
      });
    }

    if (sub.suitableFibreClasses?.length && recipe.appliesTo?.length) {
      const overlap = recipe.appliesTo.some(c => sub.suitableFibreClasses.includes(c));
      if (!overlap) out.push({ kind: 'warn', code: 'fibre_mismatch', ingredient: ing });
    }
  }

  return out;
}

/**
 * Scale a whole preparation sequence from one weight (§5.3).
 * Cellulose needs scour → tannin → mordant, always against the same cloth.
 */
export function scaleChain(chain, recipesById, context) {
  return (chain.steps || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(step => {
      const recipe = recipesById.get(step.recipeId);
      return {
        order: step.order,
        recipe,
        note: step.note,
        // Each step carries its OWN choices: the same chain built with
        // myrobalan and with gallnut are two different chains, because they
        // give two different results. The choice is part of the plan, not a
        // preference applied at the moment of scaling.
        // A volume-scaled step carries its own litres: the chalk bath is five
        // litres whether the cloth is 200 g or 400 g, so it cannot inherit a
        // figure derived from the weight of goods.
        scaled: recipe ? scaleRecipe(recipe, {
          ...context,
          choices: step.choices || null,
          bathLitres: step.litres ?? recipe.defaultLitres ?? null,
        }) : null,
      };
    });
}

/**
 * The chain as it must actually be worked: every step of the plan, and after
 * each one, any recipe it is not correct without.
 *
 * `chainFollowOns` used to return the follow-on *recipes* and the view printed
 * their names in a warning at the foot of the page. Nothing scaled them, so the
 * chalk bath's 40 g of calcium carbonate appeared nowhere at all — and §5.4
 * says that bath is mandatory, not advisory. A name in a footnote is advice;
 * you cannot weigh it.
 *
 * A required step is derived here, never stored in the chain. Writing it into
 * the plan would be double entry: the same fact held both as
 * `requiredFollowOn` on the recipe and as a step on every chain that uses it,
 * free to drift apart. It is also not numbered — the numbers belong to the
 * plan the owner built, and renumbering it whenever a mordant changes would
 * make the plan's own numbering unstable.
 *
 * @returns {Array} steps, each `{ order, recipe, note, scaled, required, after }`
 *   where `required` marks an injected step and `after` is the order of the
 *   step that pulled it in.
 */
export function expandChain(chain, recipesById, context) {
  const planned = scaleChain(chain, recipesById, context);

  // A follow-on the owner already placed in the plan herself is hers, and must
  // not appear a second time. Only steps at or after the requiring one count:
  // scouring before mordanting is not the chalk bath that follows it.
  const out = [];
  planned.forEach((step, i) => {
    out.push(step);
    for (const id of step.recipe?.requiredFollowOn || []) {
      const alreadyPlanned = planned.slice(i + 1).some(s => s.recipe?.id === id);
      if (alreadyPlanned) continue;
      if (out.some(s => s.required && s.recipe?.id === id)) continue;

      const recipe = recipesById.get(id);
      if (!recipe) continue;

      out.push({
        order: null,
        recipe,
        note: null,
        required: true,
        after: step.order,
        // An injected step carries no choices of its own: it is not in the
        // plan, so there is nowhere to keep them, and it falls to each role's
        // first option. Every follow-on modelled so far has a single option
        // per role, so the question is theoretical — but a follow-on with a
        // real alternative would need the choice stored on the requiring step
        // before this is honest. §5.4.
        scaled: scaleRecipe(recipe, {
          ...context,
          choices: null,
          // Volume-scaled, and rightly: the chalk bath is five litres whether
          // the cloth is 200 g or 400 g. `scaleRecipe` falls back to the
          // recipe's own figure on its own, so this is belt and braces rather
          // than the thing doing the work — a planned step can be given litres
          // by the chain, and an injected one never can.
          bathLitres: recipe.defaultLitres ?? null,
        }),
      });
    }
  });
  return out;
}

/** Recipes that must follow, gathered across every step, in order, deduplicated. */
export function chainFollowOns(scaledSteps, recipesById) {
  const seen = new Set();
  const out = [];
  for (const st of scaledSteps) {
    for (const id of st.recipe?.requiredFollowOn || []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const rec = recipesById.get(id);
      if (rec) out.push(rec);
    }
  }
  return out;
}

/**
 * Ceilings inside a trial (§13ah).
 *
 * `recipeWarnings()` above has checked recipes since the calculators were
 * written, and a trial checked nothing at all: the application was silent at
 * the one moment the iron is actually being poured. A recipe is a plan and can
 * be reconsidered; a step is a thing being done to cloth that exists.
 *
 * Three checks, and deliberately no more:
 *
 * 1. **The step's own temperature** against the ceiling of every substance in
 *    play — the recipe's ingredients and the substance the medium was modified
 *    with. This is madder above 75 °C, and it is the one the library already
 *    models exactly (`maxTempC`).
 * 2. **The recipe's own ceilings**, by scaling it to this cloth and asking the
 *    tested function. No second implementation of the same rule.
 * 3. **The medium modification**, but *only* when its amount is written as a
 *    plain percentage. The field is free text — "2 г", "около лъжица", "1%" —
 *    and a parser that guesses at the rest would raise warnings against numbers
 *    nobody wrote. Silence on an unparseable amount is honest; a wrong warning
 *    teaches the person to dismiss the right one.
 *
 * Pure and DOM-free, like everything else here.
 */
export function trialStepWarnings(step, { recipe, substancesById = new Map(), weightG } = {}) {
  const out = [];
  if (!step) return out;

  const involved = new Set();
  for (const ing of recipe?.ingredients || []) {
    const id = ing.substanceId || ing.options?.[0]?.substanceId;
    if (id) involved.add(id);
  }
  if (step.mediumMod?.materialId) involved.add(step.mediumMod.materialId);

  if (step.tempC != null) {
    for (const id of involved) {
      const sub = substancesById.get(id);
      if (sub?.maxTempC != null && Number(step.tempC) > sub.maxTempC) {
        // A temperature the person marked as an estimate cannot support a flat
        // statement that the ceiling has been crossed (§13ai). It is still
        // worth saying — "about 78 against a ceiling of 80, put a thermometer
        // in" is useful — but as a caution rather than a verdict.
        out.push({ kind: step.tempApprox ? 'warn' : 'error',
                   code: step.tempApprox ? 'near_max_temp' : 'over_max_temp',
                   substance: sub, approx: !!step.tempApprox,
                   value: Number(step.tempC), limit: sub.maxTempC });
      }
    }
  }

  if (recipe && weightG) {
    const scaled = scaleRecipe(recipe, { weightG });
    for (const w of recipeWarnings(recipe, scaled, substancesById)) {
      // The fibre mismatch belongs to choosing a recipe, not to working a step:
      // by the time the cloth is in the bath it is not news, and a warning that
      // cannot be acted on is noise.
      if (w.code !== 'fibre_mismatch') out.push({ ...w, fromRecipe: true });
    }
  }

  const written = String(step.mediumMod?.amount ?? '').trim();
  const asPercent = /^([\d]+(?:[.,][\d]+)?)\s*%$/.exec(written);
  if (asPercent && step.mediumMod?.materialId) {
    const sub = substancesById.get(step.mediumMod.materialId);
    const value = Number(asPercent[1].replace(',', '.'));
    if (sub?.maxPercentWof != null && value > sub.maxPercentWof) {
      out.push({ kind: 'error', code: 'over_max_wof', substance: sub,
                 value, limit: sub.maxPercentWof });
    }
  }

  return out;
}

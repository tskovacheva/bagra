// calc/scale.js — scaling a recipe to an actual weight of goods (§9.1).
//
// This is the generic engine that serves every proportional recipe: scouring,
// tannin, mordanting, dyeing, blankets, indigo vats. Fifteen bespoke
// calculators would all have been this function with different constants.

import { round } from './basic.js';

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

  return { ingredients, bathLitres: round(litres, 2), dropped };
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

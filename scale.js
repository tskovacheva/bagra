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
export function scaleRecipe(recipe, {
  weightG,
  fibreClass = null,
  receptiveFraction = 100,
  liquorRatio = null,
} = {}) {
  if (!recipe) return { ingredients: [], bathLitres: null, dropped: [] };

  const effectiveWeight = (weightG || 0) * (receptiveFraction / 100);
  const ratio = liquorRatio ?? recipe.liquorRatio ?? null;
  const litres = ratio ? (weightG / 1000) * ratio : null;

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

    let amount = null;
    let unit = ing.unit || 'g';

    switch (ing.basis) {
      case 'percent_wof':
        amount = effectiveWeight * (Number(ing.quantity) / 100);
        unit = 'g';
        break;
      case 'grams_per_litre':
        amount = litres != null ? litres * Number(ing.quantity) : null;
        unit = 'g';
        break;
      case 'percent_of_bath':
        amount = litres != null ? litres * 1000 * (Number(ing.quantity) / 100) : null;
        unit = 'g';
        break;
      case 'ratio_to_dyestuff': {
        const dye = (recipe.ingredients || []).find(x => x.roleCode === 'dyestuff');
        const dyeAmount = dye ? effectiveWeight * (Number(dye.quantity) / 100) : null;
        amount = dyeAmount != null ? dyeAmount * Number(ing.quantity) : null;
        break;
      }
      case 'absolute':
      default:
        amount = Number(ing.quantity);
    }

    ingredients.push({
      ...ing,
      scaledAmount: round(amount, 2),
      scaledUnit: unit,
      // Percentages are ambiguous without this: 5–8% of finished aluminium
      // acetate and 15–20% of raw alum describe the same practice (§5.1).
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
    const sub = ing.substanceId ? substancesById.get(ing.substanceId) : null;
    if (!sub) continue;

    if (sub.maxPercentWof != null && ing.basis === 'percent_wof' &&
        Number(ing.quantity) > sub.maxPercentWof) {
      out.push({
        kind: 'error', code: 'over_max_wof', ingredient: ing,
        limit: sub.maxPercentWof, value: Number(ing.quantity),
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
        scaled: recipe ? scaleRecipe(recipe, context) : null,
      };
    });
}

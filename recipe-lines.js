// recipe-lines.js — what actually went in, for any record that follows a recipe.
//
// WHY THIS FILE EXISTS.
//
// The pigment batch answered a question every worked recipe has: the recipe
// says roles and proportions, and the pot says „I used 47 g, not 50, and I
// swapped the soda for chalk". §13dr gave the batch a list of lines, each
// remembering what the recipe said on the day.
//
// A paste print asks exactly the same thing (§13ee): the recipe leaves the dye
// open on purpose, so „which extract and how much" can only be answered by the
// work. Copying the two functions into `trials.js` would have been a second
// copy of one fact — the most common cause of a fault in this project — so they
// moved here and both modules call them.
//
// Nothing about a BATCH is in this file. `canTakeLines` stayed in `pigments.js`
// because it asks about a batch's own state.

import { uid } from './db.js';
import { text } from './i18n.js';
import { label } from './ui.js';
import { scaleRecipe } from './calc/scale.js';

// A line's standing against the recipe it came from. Computed, never stored
// (§13.6): storing it would be a second copy of a comparison the data already
// answers, and the two would disagree the first time an amount was edited.
export function departureOf(line) {
  if (line.removed) return 'removed';
  const w = line.was;
  // No history means the owner put this line here herself. Tested before the
  // comparison rather than assumed by it: written the other way round the
  // function reads `w.amount` off nothing and throws, which stops the suite
  // with a stack trace instead of a sentence — a guard that crashes reports
  // that something is wrong and not what.
  if (!w) return 'added';
  if (line.amount !== w.amount || (line.unit || '') !== (w.unit || '')) return 'changed';
  if ((line.name || '') !== (w.name || '')) return 'swapped';
  return 'same';
}

// Reading the recipe's lines into the batch, ONCE. Amounts are resolved here
// rather than referenced: the batch has to keep saying 50 g next year even if
// the recipe's percentage is revised, because 50 g is what went in the pot.
export async function linesFromRecipe(recipe, ctx, substances, plants) {
  const byId = new Map(substances.map(sx => [sx.id, sx]));
  const plantsById = new Map(plants.map(p => [p.id, p]));

  const nameOfOption = async (o, roleCode) => {
    if (o?.plantId) {
      const p = plantsById.get(o.plantId);
      const part = o.partCode ? ', ' + await label('plant_part', o.partCode) : '';
      return (p ? text(p.nameCommon) : '—') + part;
    }
    const sub = byId.get(o?.substanceId);
    return sub ? text(sub.name) : ((await label('ingredient_role', roleCode)) || '—');
  };

    // The context a recipe is scaled against. A batch scales by the raw material
  // it started from; a paste is a fixed batch and scales by nothing at all, and
  // passing zeroes there is right — its lines are absolute and come out as
  // printed.
  const scaled = scaleRecipe(recipe, { rawG: ctx.rawG ?? null, weightG: ctx.weightG ?? 0 });
  return Promise.all(scaled.ingredients.map(async ing => {
    const name = await nameOfOption(ing.option, ing.roleCode);
    // A range keeps its lower end as the figure and says so in the note. The
    // batch records one amount because one amount went in; which end of the
    // range it was is the owner's to correct, and she will be looking at the
    // line while she does it.
    const amount = ing.scaledAmount != null ? ing.scaledAmount : ing.scaledMin;
    const unit = ing.scaledUnit || '';
    return {
      id: uid(),
      roleCode: ing.roleCode,
      substanceId: ing.option?.substanceId || '',
      name,
      amount: amount ?? null,
      unit,
      removed: false,
      // What the recipe said on the day. Frozen on purpose (§13dr).
      was: { name, amount: amount ?? null, unit, roleCode: ing.roleCode },
      note: { bg: '', en: '' },
    };
  }));
}

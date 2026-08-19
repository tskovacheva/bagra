// calc/basic.js — the everyday arithmetic (§9).
//
// Pure functions, no DOM, no storage. Every one of these is something that
// would otherwise be done on paper before each dye session, which is exactly
// where the errors come from.

/**
 * Grams of a substance at a given percentage of the weight of fibre.
 * @param {number} fabricWeightG  weight of goods
 * @param {number} percentWof     e.g. 15 for 15% WOF
 * @param {number} [receptiveFraction=100]  share of the cloth that takes dye
 *        at all; synthetic content does not. Pass 99 for 99% cotton + 1%
 *        elastane and the dose follows the fibre that can actually use it.
 */
export function wofGrams(fabricWeightG, percentWof, receptiveFraction = 100) {
  if (!fabricWeightG || percentWof == null) return null;
  const effective = fabricWeightG * (receptiveFraction / 100);
  return round(effective * (percentWof / 100));
}

/** The inverse: what percentage does a given amount represent? */
export function wofPercent(fabricWeightG, grams, receptiveFraction = 100) {
  if (!fabricWeightG || grams == null) return null;
  const effective = fabricWeightG * (receptiveFraction / 100);
  return effective ? round((grams / effective) * 100, 2) : null;
}

/**
 * Grams of substance needed for a solution of a given strength.
 * A "1% iron solution" means 1 g per 100 ml — 10 g per litre.
 */
export function solutionGrams(litres, percent) {
  if (!litres || percent == null) return null;
  return round(litres * percent * 10);
}

/** The inverse: what strength does this much substance give in this much water? */
export function solutionPercent(litres, grams) {
  if (!litres || grams == null) return null;
  return round(grams / (litres * 10), 2);
}

/**
 * Water needed for a given weight of goods at a chosen liquor ratio.
 * A ratio of 30 means 30 litres per kilo — the usual range is 20–40.
 */
export function bathLitres(fabricWeightG, liquorRatio = 30) {
  if (!fabricWeightG) return null;
  return round((fabricWeightG / 1000) * liquorRatio, 2);
}

/**
 * Rescale material between fresh and dried state.
 * Drying reduces madder root roughly sixfold, so a recipe written for dried
 * material needs a very different quantity when the plant comes in fresh.
 * @param {number} ratio  fresh weight ÷ dried weight (6 for madder root)
 */
export function freshFromDried(driedG, ratio) {
  if (!driedG || !ratio) return null;
  return round(driedG * ratio);
}

export function driedFromFresh(freshG, ratio) {
  if (!freshG || !ratio) return null;
  return round(freshG / ratio);
}

export function round(n, places = 1) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}


/**
 * Exhaust bath — what is left in the pot after the first dyeing.
 *
 * This is a rule of thumb, not a computation, and the app says so. Roughly
 * half the strength remains after a well-exhausted first bath, but the real
 * figure depends on how thoroughly the first one was used up: a short, cool
 * first dyeing leaves far more behind than a long, hot one.
 *
 * @param {number} firstWeightG  weight of goods dyed in the first bath
 * @param {number} [remainingStrength=50]  percent of the original strength
 * @returns {{ sameShadeWeightG:number, sameWeightStrength:number, remainingStrength:number }}
 */
export function exhaustBath(firstWeightG, remainingStrength = 50) {
  if (!firstWeightG) return null;
  return {
    // Either a full shade on proportionally less cloth…
    sameShadeWeightG: round(firstWeightG * (remainingStrength / 100)),
    // …or the same weight of cloth at a correspondingly lighter shade.
    sameWeightStrength: round(remainingStrength),
    remainingStrength,
  };
}

// calc/alum-acetate.js — preparing aluminium acetate from an aluminium salt.
//
// This is the calculator that proves whether ingredient roles are modelled
// correctly (§5.1). A recipe here specifies ROLES — an aluminium source, a
// sodium source, sometimes an acid source — and the choice of material within
// a role changes the quantities of the others. Hydration state alone can
// double the soda and vinegar required.
//
// IMPORTANT: the stoichiometry below is stated openly so it can be checked
// rather than trusted. Verify against a known-good source before relying on
// it for a large batch. The failure mode is wasted materials, not danger.

import { round } from './basic.js';

const ACETIC_ACID_M = 60.05;          // CH₃COOH
const ALUMINIUM_ACETATE_M = 204.11;   // Al(CH₃COO)₃

// Substances are NOT defined here. Formulas, molar masses and hydration states
// live in the Substances module, seeded from seed/substances.json — keeping a
// second copy in the calculator would guarantee the two drift apart.
//
// A substance qualifies as an aluminium source when it declares `alPerUnit`
// (how many aluminium atoms one formula unit carries), and as a sodium source
// when it declares `naPerUnit`.

export const isAluminiumSource = (sub) => !!(sub?.alPerUnit && sub?.molarMass);
export const isSodiumSource    = (sub) => !!(sub?.naPerUnit && sub?.molarMass);

/**
 * How much of everything, to end up with a target amount of aluminium acetate.
 *
 * Per mole of aluminium: three acetate groups are needed, so three moles of
 * acetate — supplied either directly by sodium acetate, or made in place from
 * a carbonate plus acetic acid.
 *
 * @param {object} o
 * @param {number} o.fabricWeightG       weight of goods
 * @param {number} o.percentWof          target, expressed as FINISHED aluminium acetate
 * @param {string} o.aluminiumSource     key of ALUMINIUM_SOURCES
 * @param {string} o.sodiumSource        key of SODIUM_SOURCES
 * @param {number} [o.vinegarPercent=9]  strength of the vinegar, if acid is needed
 * @param {number} [o.receptiveFraction=100]
 */
export function aluminiumAcetate({
  fabricWeightG,
  percentWof,
  targetG: targetOverride = null,   // grams of finished acetate, when known directly
  aluminiumSubstance,
  sodiumSubstance,
  vinegarPercent = 9,
  receptiveFraction = 100,
}) {
  if (!isAluminiumSource(aluminiumSubstance) || !isSodiumSource(sodiumSubstance)) return null;
  if (targetOverride == null && (!fabricWeightG || !percentWof)) return null;

  const effectiveWeight = (fabricWeightG || 0) * (receptiveFraction / 100);

  // Target, stated as finished product (§5.1 — basisRefersTo). In a chain the
  // figure comes from whatever step will consume it, rather than from a
  // percentage: the preparation exists to serve the mordanting that follows.
  const targetG = targetOverride != null
    ? targetOverride
    : effectiveWeight * (percentWof / 100);
  const molesAcetate = targetG / ALUMINIUM_ACETATE_M;   // = moles of aluminium
  const molesAlSource = molesAcetate / aluminiumSubstance.alPerUnit;
  const aluminiumG = molesAlSource * aluminiumSubstance.molarMass;

  // Three acetate groups per aluminium.
  const acetateEquivalents = molesAcetate * 3;

  const molesNaSource = acetateEquivalents / sodiumSubstance.naPerUnit;
  const sodiumG = molesNaSource * sodiumSubstance.molarMass;

  let acid = null;
  if (sodiumSubstance.needsAcid) {
    const aceticAcidG = acetateEquivalents * ACETIC_ACID_M;
    acid = {
      aceticAcidG: round(aceticAcidG),
      // Vinegar is close enough to the density of water at these strengths.
      vinegarMl: round(aceticAcidG / (vinegarPercent / 100)),
      vinegarPercent,
    };
  }

  return {
    targetAluminiumAcetateG: round(targetG),
    aluminiumSource: { id: aluminiumSubstance.id, formula: aluminiumSubstance.formula, grams: round(aluminiumG) },
    sodiumSource: { id: sodiumSubstance.id, formula: sodiumSubstance.formula, grams: round(sodiumG) },
    acid,
    // Choosing sodium acetate removes the acid line entirely: the conversion
    // has already happened. A recipe is a set of roles, not a fixed list.
    notes: sodiumSubstance.needsAcid ? [] : ['acid_not_needed'],
  };
}

/**
 * Reverse mode — scale from whatever is actually in the cupboard (§9).
 * Given how much of one ingredient is available, how much cloth can it mordant?
 *
 * @param {string} limitingRole  'aluminium' | 'sodium'
 */
export function fromAvailable({
  limitingRole,
  availableG,
  percentWof,
  aluminiumSubstance,
  sodiumSubstance,
  vinegarPercent = 9,
}) {
  if (!availableG || !percentWof) return null;

  // Compute against an arbitrary reference weight, then scale linearly.
  const reference = 1000;
  const base = aluminiumAcetate({
    fabricWeightG: reference, percentWof, aluminiumSubstance, sodiumSubstance, vinegarPercent,
  });
  if (!base) return null;

  const per = limitingRole === 'sodium' ? base.sodiumSource.grams : base.aluminiumSource.grams;
  if (!per) return null;

  const maxFabricG = (availableG / per) * reference;

  return {
    maxFabricG: round(maxFabricG),
    recipe: aluminiumAcetate({
      fabricWeightG: maxFabricG, percentWof, aluminiumSubstance, sodiumSubstance, vinegarPercent,
    }),
  };
}

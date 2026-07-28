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

const M = {
  aluminium_acetate: 204.11,   // Al(CH₃COO)₃
  sodium_carbonate: 105.99,    // Na₂CO₃, soda ash
  sodium_bicarbonate: 84.01,   // NaHCO₃
  sodium_acetate: 82.03,       // CH₃COONa, anhydrous
  sodium_acetate_tri: 136.08,  // CH₃COONa·3H₂O
  acetic_acid: 60.05,          // CH₃COOH
};

// Aluminium sources, with how many aluminium atoms each formula unit carries.
export const ALUMINIUM_SOURCES = {
  alum_potassium_12:   { molarMass: 474.39, alPerUnit: 1, label: 'KAl(SO₄)₂·12H₂O' },
  alum_ammonium_12:    { molarMass: 453.33, alPerUnit: 1, label: 'NH₄Al(SO₄)₂·12H₂O' },
  al_sulfate_18:       { molarMass: 666.42, alPerUnit: 2, label: 'Al₂(SO₄)₃·18H₂O' },
  al_sulfate_16:       { molarMass: 630.39, alPerUnit: 2, label: 'Al₂(SO₄)₃·16H₂O' },
  al_sulfate_14:       { molarMass: 594.36, alPerUnit: 2, label: 'Al₂(SO₄)₃·14H₂O' },
  al_sulfate_anhydr:   { molarMass: 342.15, alPerUnit: 2, label: 'Al₂(SO₄)₃' },
};

export const SODIUM_SOURCES = {
  soda_ash:            { molarMass: M.sodium_carbonate,   naPerUnit: 2, needsAcid: true,  label: 'Na₂CO₃' },
  bicarbonate:         { molarMass: M.sodium_bicarbonate, naPerUnit: 1, needsAcid: true,  label: 'NaHCO₃' },
  sodium_acetate:      { molarMass: M.sodium_acetate,     naPerUnit: 1, needsAcid: false, label: 'CH₃COONa' },
  sodium_acetate_tri:  { molarMass: M.sodium_acetate_tri, naPerUnit: 1, needsAcid: false, label: 'CH₃COONa·3H₂O' },
};

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
  aluminiumSource = 'al_sulfate_18',
  sodiumSource = 'soda_ash',
  vinegarPercent = 9,
  receptiveFraction = 100,
}) {
  const alSrc = ALUMINIUM_SOURCES[aluminiumSource];
  const naSrc = SODIUM_SOURCES[sodiumSource];
  if (!alSrc || !naSrc || !fabricWeightG || !percentWof) return null;

  const effectiveWeight = fabricWeightG * (receptiveFraction / 100);

  // Target, stated as finished product (§5.1 — basisRefersTo).
  const targetG = effectiveWeight * (percentWof / 100);
  const molesAcetate = targetG / M.aluminium_acetate;   // = moles of aluminium
  const molesAlSource = molesAcetate / alSrc.alPerUnit;
  const aluminiumG = molesAlSource * alSrc.molarMass;

  // Three acetate groups per aluminium.
  const acetateEquivalents = molesAcetate * 3;

  // The sodium source supplies sodium; a carbonate needs acid to become acetate.
  const molesNaSource = acetateEquivalents / naSrc.naPerUnit;
  const sodiumG = molesNaSource * naSrc.molarMass;

  let aceticAcidG = null;
  let vinegarMl = null;
  if (naSrc.needsAcid) {
    aceticAcidG = acetateEquivalents * M.acetic_acid;
    // Vinegar is roughly the density of water at these strengths.
    vinegarMl = aceticAcidG / (vinegarPercent / 100);
  }

  return {
    targetAluminiumAcetateG: round(targetG),
    aluminiumSource: { key: aluminiumSource, label: alSrc.label, grams: round(aluminiumG) },
    sodiumSource:    { key: sodiumSource, label: naSrc.label, grams: round(sodiumG) },
    acid: naSrc.needsAcid
      ? { aceticAcidG: round(aceticAcidG), vinegarMl: round(vinegarMl), vinegarPercent }
      : null,
    // Choosing sodium acetate removes the acid line entirely: the conversion
    // has already happened. A recipe is a set of roles, not a fixed list.
    notes: naSrc.needsAcid ? [] : ['acid_not_needed'],
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
  aluminiumSource = 'al_sulfate_18',
  sodiumSource = 'soda_ash',
  vinegarPercent = 9,
}) {
  if (!availableG || !percentWof) return null;

  // Compute the recipe for an arbitrary reference weight, then scale linearly.
  const reference = 1000;
  const base = aluminiumAcetate({
    fabricWeightG: reference, percentWof, aluminiumSource, sodiumSource, vinegarPercent,
  });
  if (!base) return null;

  const per = limitingRole === 'sodium'
    ? base.sodiumSource.grams
    : base.aluminiumSource.grams;
  if (!per) return null;

  const maxFabricG = (availableG / per) * reference;

  return {
    maxFabricG: round(maxFabricG),
    recipe: aluminiumAcetate({
      fabricWeightG: maxFabricG, percentWof, aluminiumSource, sodiumSource, vinegarPercent,
    }),
  };
}

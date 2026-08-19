// stock-logic.js — what a jar says about a material (§11b).
//
// Kept out of the module because four things ask the same question — the
// materials list, the material record, the dashboard counters and the alum
// acetate calculator — and four copies of "running low" is four thresholds
// that drift apart.

/**
 * The state of one jar.
 *
 *   wanted   no jar at all; it is on the list to buy. Cannot be derived —
 *            the absence of a jar does not describe itself (§11b), so it is
 *            written as a named `status`, not inferred from an empty record.
 *   empty    a jar at zero.
 *   low      a jar near the end.
 *   have     a jar with something in it.
 *
 * `lowBelow` is the amount the owner wants to be warned under, in the jar's
 * own unit. Left empty it falls back to a fraction of the original quantity:
 * fifteen percent is arbitrary, but a jar three-quarters gone is worth noticing
 * before the session rather than during it. The fallback needs an original
 * quantity to be a fraction OF — without one there is no threshold, and
 * guessing would be worse than staying quiet.
 */
export const LOW_FRACTION = 0.15;

export function jarState(jar) {
  if (!jar) return null;
  if (jar.status === 'wanted') return 'wanted';

  const left = jar.remaining?.value ?? jar.quantity?.value;
  if (left == null) return 'have';
  if (left <= 0) return 'empty';

  const floor = jar.lowBelow != null && jar.lowBelow !== ''
    ? Number(jar.lowBelow)
    : (jar.quantity?.value ? jar.quantity.value * LOW_FRACTION : null);

  if (floor != null && left <= floor) return 'low';
  return 'have';
}

/** Every jar of one material, newest acquisition first. */
export const jarsFor = (stock, substanceId) =>
  stock
    .filter(j => j.substanceId === substanceId)
    .sort((a, b) => (b.acquiredDate || '').localeCompare(a.acquiredDate || ''));

/**
 * The state of a material, from its jars.
 *
 * The best jar wins: one full bag and one scraped-out one means she has it.
 * `wanted` is not a fifth degree of having — it is what is said when there is
 * nothing, so a wanted entry beside a real jar is ignored rather than shown.
 *
 * Returns null for "nothing said", which is most of the seeded library and
 * must stay silent: a chip on every row saying "unknown" is noise on four
 * hundred rows.
 */
export function stateOfSubstance(jars) {
  if (!jars.length) return null;
  const states = jars.map(jarState);
  for (const s of ['have', 'low', 'empty']) if (states.includes(s)) return s;
  return states.includes('wanted') ? 'wanted' : null;
}

/** The order the filter offers them in: from "on the shelf" to "not here". */
export const STOCK_STATES = ['have', 'low', 'empty', 'wanted'];

/** What is left in a jar, as a number and a unit, or null when unsaid. */
export function jarLeft(jar) {
  const value = jar.remaining?.value ?? jar.quantity?.value;
  if (value == null) return null;
  return { value, unit: jar.quantity?.unit || jar.remaining?.unit || '' };
}

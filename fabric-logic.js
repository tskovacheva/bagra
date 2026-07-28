// fabric-logic.js — the arithmetic behind a fabric record (§13.3).
//
// Pure functions, no DOM. `fibreClass` and `dyeReceptiveFraction` are DERIVED
// from composition and never stored: storing them would let them drift out of
// step with the composition they describe.

export const CELLULOSE = ['cotton', 'linen', 'hemp', 'ramie', 'viscose'];
export const PROTEIN    = ['silk', 'wool'];
export const SYNTHETIC  = ['elastane', 'polyester'];

export function compositionTotal(composition = []) {
  return composition.reduce((sum, c) => sum + (Number(c.percent) || 0), 0);
}

export function fractions(composition = []) {
  let cellulose = 0, protein = 0, synthetic = 0;
  for (const c of composition) {
    const p = Number(c.percent) || 0;
    if (CELLULOSE.includes(c.fibreCode)) cellulose += p;
    else if (PROTEIN.includes(c.fibreCode)) protein += p;
    else if (SYNTHETIC.includes(c.fibreCode)) synthetic += p;
  }
  return { cellulose, protein, synthetic };
}

// The share of the cloth that can take natural dye at all. Synthetic content
// does not, which is why composition is stored as numbers rather than as a
// label: this figure qualifies every % WOF calculation downstream.
export function dyeReceptiveFraction(composition = []) {
  const f = fractions(composition);
  return f.cellulose + f.protein;
}

export function fibreClass(composition = []) {
  const f = fractions(composition);
  if (f.cellulose > 0 && f.protein > 0) return 'mixed';
  if (f.synthetic > 0 && (f.cellulose > 0 || f.protein > 0)) return 'part_synthetic';
  if (f.protein > 0) return 'protein';
  if (f.cellulose > 0) return 'cellulose';
  return null;
}

// A cellulose-protein cloth takes mordant and colour differently in its two
// fractions. The app says so rather than pretending one route serves both.
export function compositionWarnings(composition = []) {
  const out = [];
  const total = compositionTotal(composition);
  const f = fractions(composition);

  if (composition.length && Math.round(total) !== 100) {
    out.push({ kind: 'error', code: 'total', total });
  }
  if (f.cellulose > 0 && f.protein > 0) {
    out.push({ kind: 'warn', code: 'mixed' });
  }
  if (f.synthetic >= 50) {
    out.push({ kind: 'warn', code: 'synthetic_major', percent: f.synthetic });
  }
  return out;
}

// The boxes on the shelf, in order. Pieces may skip states.
export const STATE_ORDER =
  ['unwashed', 'scoured', 'tanned', 'mordanted', 'dyed', 'finished'];

// State follows the Глина single-owner rule: when state events exist they own
// the state; otherwise the value set at creation does.
export function currentState(fabric) {
  const events = fabric.stateEvents || [];
  if (!events.length) return fabric.state || 'unwashed';
  const sorted = [...events].sort((a, b) =>
    (a.date || '').localeCompare(b.date || '') ||
    (a.createdAt || '').localeCompare(b.createdAt || ''));
  return sorted[sorted.length - 1].stateCode;
}

export function stateHistory(fabric) {
  return [...(fabric.stateEvents || [])].sort((a, b) =>
    (a.date || '').localeCompare(b.date || ''));
}

// Days since the piece was mordanted — mordanted cloth benefits from curing,
// and knowing how long it has rested is part of reading the result.
export function daysSinceMordanted(fabric) {
  const ev = stateHistory(fabric).filter(e => e.stateCode === 'mordanted').pop();
  if (!ev || !ev.date) return null;
  const ms = Date.now() - new Date(ev.date).getTime();
  return Math.floor(ms / 86400000);
}

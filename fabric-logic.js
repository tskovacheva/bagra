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

// The story of a piece in photographs (§8.0c).
//
// Photographs about one cloth are scattered across five places: the fabric's
// own shot, a plan diagram, the placements, the steps, and the finished
// result. Shown as separate blocks — which is how they were shown — they can
// state a before and an after but never a middle, and the middle is where eco
// print actually happens.
//
// Pure and DOM-free: it returns what to show and in what order, and leaves the
// wording to the view. `kind` and `stageCode` are codes, not labels.
export function photoTimeline(fabric, trials = []) {
  const items = [];

  if (fabric.photoData) {
    items.push({
      src: fabric.photoData,
      date: fabric.createdAt ? String(fabric.createdAt).slice(0, 10) : '',
      kind: 'fabric', rank: 0,
    });
  }

  for (const tr of trials) {
    const on = tr.date || '';
    const push = (src, kind, rank, extra = {}) =>
      src && items.push({ src, date: extra.date || on, kind, rank,
                          trialId: tr.id, trialTitle: tr.title, ...extra });

    for (const src of tr.planPhotos || []) push(src, 'plan', 1);
    for (const pl of tr.placements || []) push(pl.photo, 'placement', 2);

    (tr.steps || []).forEach((st, i) => {
      for (const src of st.photos || []) {
        push(src, 'step', 10 + i, { date: st.date || on, stageCode: st.stageCode });
      }
    });

    for (const src of tr.resultPhotos || []) push(src, 'result', 9000);
  }

  // By date first, because that is the order they were taken in. Rank breaks
  // ties within a day, which is most of them: a trial's plan, placements,
  // steps and result usually share one date, and only rank keeps the roll
  // from appearing before the leaves were laid out.
  return items.sort((a, b) =>
    (a.date || '').localeCompare(b.date || '') || a.rank - b.rank);
}

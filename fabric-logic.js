// fabric-logic.js — the arithmetic behind a fabric record (§13.3).
//
// Pure functions, no DOM. `fibreClass` and `dyeReceptiveFraction` are DERIVED
// from composition and never stored: storing them would let them drift out of
// step with the composition they describe.

import { movesBox, boxAfter, ACTION_FOR_STATE } from './migrate-actions.js';

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
//
// `tanned` is not here (§13bd): tannin is a treatment a piece carries, not a
// shelf it sits on. The last two are not shelves either — they are what has
// become of the piece — but they are states and they filter, so they stay.
export const STATE_ORDER =
  ['unwashed', 'scoured', 'mordanted', 'dyed', 'finished'];

// The box a piece is in, read from its actions (§13bd).
//
// Only a box-moving action counts. Under the old rule the latest event of any
// kind owned the state, so an iron afterbath on a dyed piece would have
// reported the piece as being in a box called "iron bath". Now the five
// non-moving actions are labels and change nothing about where the cloth lies.
//
// Falls back to `stateEvents` for a record that has not been migrated, and to
// the field set at creation for one that has no history at all — the Глина
// single-owner rule, one layer deeper than it was.
export function currentState(fabric) {
  const acts = (fabric.actions || []).filter(a => movesBox(a.actionCode));
  if (acts.length) {
    const sorted = [...acts].sort(byDateThenCreated);
    return boxAfter(sorted[sorted.length - 1].actionCode);
  }
  if (fabric.actions) return fabric.state || 'unwashed';

  const events = fabric.stateEvents || [];
  if (!events.length) return fabric.state || 'unwashed';
  const sorted = [...events].sort(byDateThenCreated);
  return sorted[sorted.length - 1].stateCode;
}

const byDateThenCreated = (a, b) =>
  (a.date || '').localeCompare(b.date || '') ||
  (a.createdAt || '').localeCompare(b.createdAt || '');

// Everything that has happened to the piece, oldest first. Both box moves and
// the treatments that did not move it: one biography, not two.
export function actionHistory(fabric) {
  if (fabric.actions) return [...fabric.actions].sort(byDateThenCreated);
  return [...(fabric.stateEvents || [])].sort(byDateThenCreated);
}

// Kept under its old name because five call sites read it as history to
// display, and renaming it would touch them all for no gain.
export const stateHistory = actionHistory;

// The treatments a piece carries that did not move it between boxes — the
// small labels beside the box chip. Distinct, in the order first applied.
//
// This is what makes a tanned piece legible: it is in the washed box and it
// carries tannin, which is enough to decide it is ready for an eco print even
// though it will never be ready for a madder bath.
export function treatmentsOf(fabric) {
  const seen = [];
  for (const a of actionHistory(fabric)) {
    const code = a.actionCode;
    if (!code || code === 'other' || movesBox(code)) continue;
    if (!seen.includes(code)) seen.push(code);
  }
  return seen;
}

// Days since the piece was mordanted — mordanted cloth benefits from curing,
// and knowing how long it has rested is part of reading the result.
export function daysSinceMordanted(fabric) {
  const ev = actionHistory(fabric)
    .filter(e => (e.actionCode || ACTION_FOR_STATE[e.stateCode]) === 'mordant')
    .pop();
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
  // The cloth as it arrived is the beginning of the piece by definition, and it
  // is sorted there rather than by its date. `createdAt` is when the *record*
  // was made, not when the cloth was bought: entering a piece of cloth today
  // and then recording the work done to it in June put the raw shot last, so
  // "the most recent photograph" (§13ag) came back as the blank cloth. Found by
  // the guard for §13am, on a fixture that had made exactly that mistake
  // because it is the ordinary way to enter past work.
  return items.sort((a, b) =>
    (a.kind === 'fabric' ? 0 : 1) - (b.kind === 'fabric' ? 0 : 1)
    || (a.date || '').localeCompare(b.date || '')
    || a.rank - b.rank);
}

/**
 * The one picture that stands for a piece of work: the most recent one taken.
 *
 * Not a rule of its own — the last item of the timeline above. Which means the
 * fallback falls out rather than being written: a trial with no photographs of
 * its own has only the cloth's own shot in its timeline, so "the cloth first,
 * then whatever was added last" needs no second branch. §13ag.
 *
 * The list used to show `planPhotos[0]` for running work and `resultPhotos[0]`
 * for finished — the plan, and the *first* result rather than the last. So the
 * diary was illustrated with what was intended instead of what happened.
 */
export function coverPhoto(fabric, trial) {
  const shots = photoTimeline(fabric || {}, trial ? [trial] : []);
  return shots.length ? shots[shots.length - 1].src : null;
}

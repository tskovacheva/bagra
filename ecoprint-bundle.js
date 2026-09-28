// ecoprint-bundle.js — the eco-print bundle as a stack of layers (§13fl).
//
// Pure functions, no database and no DOM, so the migration, the trial screen
// and the checks all read the same rules.
//
// A bundle is listed FROM THE BOTTOM UP. Nothing here assumes which layer comes
// first: foil under a blanket under leaves under silk is one real bundle, and
// silk under leaves under a blanket is another.

// The step types a bundle replaces on an eco-print trial. The steps stay in the
// record — the bundle is built from them, not instead of them — and the screen
// stops listing them, so one gesture is not shown twice.
export const BUNDLE_STEP_TYPES = ['lay_base', 'arrange', 'lay_blanket', 'bundle'];

// A layer that is a cloth made ready before it goes in: the blanket soaked in
// iron, a printing cloth dipped in dye. Only these carry a preparation.
export const PREPARED_KINDS = ['carrier_blanket', 'printing_cloth'];

const KINDS = ['barrier', 'carrier_blanket', 'printing_cloth', 'plants', 'receiving_cloth', 'other'];

export const blankPrep = () => ({ washed: false, treatment: '', duration: '', bath: '', note: '' });
export const blankLayer = (kind = '') => ({ id: '', kind, what: '', note: '', stepId: null,
  prep: PREPARED_KINDS.includes(kind) ? blankPrep() : null });

/**
 * The bundle an older eco-print trial already describes, read from its steps.
 *
 * DETERMINISTIC. Each construction step becomes one layer, in step order:
 * `arrange` is the plants; a laying step is the layer its `roleCode` names, and
 * a laying step with no role is `other` — its words are kept, its kind is not
 * guessed. The `bundle` step is not a layer: its words become how the bundle
 * was rolled. A layer keeps the id of the step it came from, so the step's
 * photographs are shown beside it without being copied.
 *
 * `newId` is passed in so the function stays pure and testable.
 */
export function bundleFromSteps(steps, newId) {
  const layers = [];
  const roll = [];
  for (const st of Array.isArray(steps) ? steps : []) {
    if (!st || !BUNDLE_STEP_TYPES.includes(st.typeCode)) continue;
    if (st.typeCode === 'bundle') {
      for (const w of [st.what, st.note]) if (String(w || '').trim()) roll.push(String(w).trim());
      continue;
    }
    const kind = st.typeCode === 'arrange' ? 'plants'
      : KINDS.includes(st.roleCode) ? st.roleCode : 'other';
    layers.push({ ...blankLayer(kind), id: newId(), what: String(st.what || ''),
                  note: String(st.note || ''), stepId: st.id || null });
  }
  return { layers, roll: roll.join('; ') };
}

/**
 * Which side of a leaf faced the receiving cloth, as far as the record says.
 *
 *   { code, how }   how = 'set'     — chosen in the relative terms (`printSide`)
 *                        'derived' — an older `facing`, read against the bundle
 *                        'legacy'  — an older `facing` the bundle cannot settle
 *                        'none'    — nothing recorded
 *
 * An older `face_down` means the face pointed DOWN. Whether that is toward the
 * receiving cloth depends on where the receiving cloth lay, so it is read only
 * when the bundle has exactly one plants layer and exactly one receiving cloth.
 * Anything else — none, two receiving cloths, no bundle — and the old words are
 * shown as they were written, with no meaning added.
 */
export function printSideOf(placement, layers) {
  if (placement?.printSide) return { code: placement.printSide, how: 'set' };
  const facing = placement?.facing;
  if (!facing) return { code: '', how: 'none' };
  if (facing !== 'face_down' && facing !== 'face_up') return { code: facing, how: 'legacy' };
  const list = Array.isArray(layers) ? layers : [];
  const plants = list.map((l, i) => l?.kind === 'plants' ? i : -1).filter(i => i >= 0);
  const receiving = list.map((l, i) => l?.kind === 'receiving_cloth' ? i : -1).filter(i => i >= 0);
  if (plants.length !== 1 || receiving.length !== 1) return { code: facing, how: 'legacy' };
  const receivingAbove = receiving[0] > plants[0];
  const faceTowardReceiving = (facing === 'face_up') === receivingAbove;
  return { code: faceTowardReceiving ? 'face_to_receiving' : 'back_to_receiving', how: 'derived', from: facing };
}

// modules/season.js — what is worth gathering this month.
//
// The home screen's answer to "what should I do today", and the replacement for
// the reliability panel removed in Part A6 (§13cd). That one counted claims
// awaiting testing: it addressed the owner of a private notebook, and to someone
// who had paid for a library the first thing the application said about itself
// was a number of things it was unsure of. This one says something true on the
// day it is opened, to either reader.
//
// A QUERY, NOT AN ENGINE. Plants whose parts have a gathering window containing
// this month. No new store, no derived record, nothing to keep in step.
//
// Kept out of dashboard.js because the month is the one input that cannot be
// clicked: a panel that only ever renders for today is a panel that is only ever
// tested in August. Everything here takes the month as an argument.

import { all } from '../db.js';
import { t, text } from '../i18n.js';
import { label, esc } from '../ui.js';

// Four cards. Five fit the wide column, but the phone is where this screen is
// actually read — in the garden — and four is what stays legible there without
// the panel becoming two different layouts.
export const CARDS = 4;

/**
 * Which months a part is worth gathering in, and whether that is really the
 * part's own answer.
 *
 * WHILE THE MIGRATION IS HALF DONE. `harvestMonths` is moving from the plant to
 * the part (§13cd), because walnut leaf is May–September and the green husks are
 * August–October — one list per plant cannot say that. Until the workbook comes
 * back, most plants have only the old plant-level list.
 *
 * Falling back to it silently would be the worst of both: a walnut with three
 * parts would show all three as in season in August, which is plausible, wrong,
 * and indistinguishable from a real answer. So the fallback is carried in the
 * open — `viaPlant` — and the card says less when it is set: the plant appears,
 * but it does not name parts it cannot vouch for.
 */
export function windowOf(plant, part) {
  if (Array.isArray(part.harvestMonths) && part.harvestMonths.length)
    return { months: part.harvestMonths, viaPlant: false };
  if (Array.isArray(plant.harvestMonths) && plant.harvestMonths.length)
    return { months: plant.harvestMonths, viaPlant: true };
  return null;
}

/**
 * How soon this plant's window closes, counting forward from `month`.
 *
 * The panel's order. Not alphabetical — that puts walnut last for no reason —
 * and not random, which makes the panel look broken when it changes on reload.
 * Green husks that end this month come before leaves that run to October,
 * because that is the ordering that makes the panel worth opening twice in a
 * season. It needs no data that is not already there.
 */
export function monthsLeft(months, month) {
  if (!Array.isArray(months)) return 0;
  let n = 0;
  for (let step = 0; step < 12; step++) {
    const m = ((month - 1 + step) % 12) + 1;
    if (!months.includes(m)) break;
    n++;
  }
  return n;
}

/**
 * The plants worth gathering in `month`, in the order the panel shows them.
 *
 * `month` is 1–12 and is always passed in. Reading the clock in here would make
 * every test a test of today.
 */
export async function inSeason(month, plants = null) {
  const list = plants || await all('plants');
  const out = [];

  for (const p of list) {
    const parts = [];
    let viaPlant = false;

    for (const part of p.parts || []) {
      // Bought rather than gathered — brazilwood, cutch, henna. The panel is
      // about going outside, so these never appear.
      //
      // NOT decided from `habitat: 'imported'`. That vocabulary is wild | garden
      // | imported and answers WHERE IT GROWS: sumac is native here and also
      // arrives in a bag, and both are true at once. Where something is bought
      // is a separate fact and this is its field.
      if (part.sourcedNotGathered) continue;

      const w = windowOf(p, part);
      if (!w || !w.months.includes(month)) continue;
      if (w.viaPlant) viaPlant = true;
      // The window that MATCHED is carried along. The first version pushed the
      // part and then re-derived its months from `part.harvestMonths` further
      // down — two computations of one thing, and when a broken `windowOf` made
      // them disagree the panel threw rather than misreported. Deriving a value
      // twice is how a check ends up testing a different value from the screen.
      else parts.push({ part, months: w.months });
    }

    // A plant that lists NO parts at all, but whose own months contain this
    // month, still belongs in the panel.
    //
    // The guard found this: a plant carrying real months and no parts vanished
    // entirely. It never entered the loop, nothing was ever set, and it dropped
    // out in silence — membership was being decided inside a loop over parts,
    // which made a plant's own months depend on it having some.
    //
    // The test is `parts.length === 0`, not "no part matched". A plant whose
    // every part is bought rather than gathered also matches nothing, and it
    // must stay out — the first version of this fix used the looser test and
    // put cutch back on the panel.
    if (!parts.length && !viaPlant
        && !(p.parts || []).length
        && (p.harvestMonths || []).includes(month))
      viaPlant = true;

    if (!parts.length && !viaPlant) continue;

    // How soon it closes: the tightest window among the parts actually in
    // season, since that is the one there is least time to act on.
    const windows = parts.length
      ? parts.map(x => monthsLeft(x.months, month))
      : [monthsLeft(p.harvestMonths || [], month)];

    out.push({
      plant: p,
      // Empty when the answer came from the plant rather than the part: the
      // card then names no part, rather than naming all of them.
      parts: parts.map(x => x.part.partCode),
      viaPlant: !parts.length,
      closesIn: Math.min(...windows),
    });
  }

  // Ties broken by the library's own order, so the panel does not reshuffle
  // between reloads on the same day.
  const order = new Map(list.map((p, i) => [p.id, i]));
  out.sort((a, b) => a.closesIn - b.closesIn
                  || order.get(a.plant.id) - order.get(b.plant.id));
  return out;
}

/** Does this plant need the warning mark on its card? */
export const warns = (p) =>
  ['caution', 'elevated'].includes((p.toxicity || {}).level);

async function card(entry) {
  const p = entry.plant;

  // Which parts, THIS month — not all the plant's parts. If the bark is a winter
  // job it has no business on an August card.
  const parts = (await Promise.all(entry.parts.map(c => label('plant_part', c))))
    .filter(Boolean).join(' · ');

  // At most two colours. A card that lists six says nothing.
  //
  // The swatch is the plant's own recorded hex — data, not decoration, and the
  // one place a green may legitimately appear on this screen, because a plant
  // that dyes green is the subject rather than the chrome.
  const colours = (p.colours || []).slice(0, 2).map(c => `
    <span class="seasonswatch"${c.hex ? ` style="background:${esc(c.hex)}"` : ''}></span>
    <span>${esc(text(c.name))}</span>`).join('');

  // The mark ACCOMPANIES and never replaces (§13ac). Nothing is hidden, greyed
  // or reordered — the plant's name and part stay exactly as they are. It says
  // read before you pick, not do not pick.
  //
  // On the card rather than one press away, because this panel is an invitation
  // in a way a library listing is not: eleven of the plants that appear in
  // August carry a warning, and tansy and alder buckthorn are `elevated`.
  const mark = warns(p) ? `<span class="seasonwarn" title="${esc(t('season.careTitle'))}"
      aria-label="${esc(t('season.careTitle'))}">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" aria-hidden="true"><use href="#i-alert"></use></svg>
    </span>` : '';

  return `
    <button class="seasoncard" data-plant="${esc(p.id)}">
      <span class="seasonphoto">${p.photoData
        ? `<img src="${esc(p.photoData)}" alt="" loading="lazy">`
        : ''}${mark}</span>
      <span class="seasonname">${esc(text(p.nameCommon))}</span>
      <span class="seasonpart">${esc(
        entry.viaPlant ? t('season.partsUnsaid') : parts)}</span>
      <span class="seasoncolours">${colours}</span>
    </button>`;
}

/**
 * The panel's inner HTML for `month`, or the empty-state wording.
 *
 * Two different empties, and they must not share words. „Nothing is gathered in
 * January" is a fact about January; „no gathering months have been recorded yet"
 * is a fact about the library. Not-yet-filled must never read as
 * nothing-to-pick.
 */
export async function seasonPanel(month, plants = null) {
  const list = plants || await all('plants');
  const found = await inSeason(month, list);
  const monthName = t('month.' + month);

  const anyRecorded = list.some(p =>
    (p.harvestMonths || []).length
    || (p.parts || []).some(x => (x.harvestMonths || []).length));

  const head = `
    <div class="seasonhead">
      <div>
        <h2>${t('season.title')}</h2>
        <p class="hint">${esc(monthName)}${found.length
          ? ' · ' + esc(t('season.count', { n: found.length }))
          : ''}</p>
      </div>
      ${found.length > CARDS
        ? `<a class="seasonall" href="#/plants?month=${month}">${t('season.all')}</a>`
        : ''}
    </div>`;

  // The panel does NOT disappear when there is nothing. A panel that vanishes
  // reads as something broken, and January is a real month rather than an edge
  // case — bark, roots, a few lichens, and some years nothing at all.
  if (!found.length) {
    return head + `<p class="seasonempty">${
      anyRecorded
        ? t('season.emptyMonth', { month: monthName })
        : t('season.emptyLibrary')}</p>`;
  }

  const cards = (await Promise.all(found.slice(0, CARDS).map(card))).join('');
  return head + `<div class="seasoncards">${cards}</div>`;
}

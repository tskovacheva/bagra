// modules/dashboard.js — what you see when you open Багра.
//
// The screen used to be eleven tiles with counts: navigation wearing the clothes
// of a summary. It answered "where can I go", which is not what anyone asks on
// opening an application they were in yesterday. It now answers "what was I
// doing", and the navigation stays underneath, because the counts do inform on
// the way past — „Растения 57" is worth reading (§13cf).
//
// The order is argued and fixed:
//
//   1. attention, and ONLY when there is something to say
//   2. Продължи — what you came back for
//   3. the season and the shelf, side by side: outside and inside
//   4. quick actions and the reference — where you go deliberately
//
// NOTHING HERE DERIVES A VALUE THE MODEL CANNOT STATE. That rule cost this
// design its most attractive line; see `nextStep`.

import { all, count } from '../db.js';
import { backupState } from '../backup.js';
import { t, text, plural } from '../i18n.js';
import { page, panel, label, esc, note } from '../ui.js';
import { currentState, STATE_ORDER } from '../fabric-logic.js';
import { seasonPanel } from './season.js';
import { workTitle } from './trials.js';

const REFERENCE_TILES = [
  { id: 'reference',  icon: 'i-reference', store: 'combinations' },
  { id: 'plants',     icon: 'i-plant',     store: 'plants' },
  { id: 'recipes',    icon: 'i-recipe',    store: 'recipes' },
  { id: 'substances', icon: 'i-substance', store: 'substances' },
  { id: 'techniques', icon: 'i-technique', store: 'techniques' },
  { id: 'materials',  icon: 'i-stock',     store: 'stock' },
  { id: 'tools',      icon: 'i-tools',     store: null },
  { id: 'sources',    icon: 'i-source',    store: 'sources' },
];

const ALL_STORES = [...REFERENCE_TILES, { id: 'fabrics', store: 'fabrics' },
  { id: 'trials', store: 'trials' }];

// Named actions, and only what actually starts a record. „Еко принт" from the
// mock-up is a technique inside a trial and not a kind of record; a button for
// it would promise a screen that does not exist. There is no free-standing note
// either — notes live on the things they are about.
//
// Three named actions rather than one unnamed `+`: the central button in the
// mock-up does not say what it makes, and giving it a menu turns it into this
// row a second time.
const QUICK = [
  { id: 'trial',  icon: 'i-trial',  go: 'trials/new' },
  { id: 'fabric', icon: 'i-fabric', go: 'fabrics/new' },
  { id: 'plant',  icon: 'i-plant',  go: 'plants/new' },
];

// Four, matching the seasonal panel below so the two rows agree, and four is
// what stays legible in a scrolling row on a phone.
const CARDS = 4;

// Mordanted cloth does not keep indefinitely. Two weeks is when it is worth
// mentioning and not so soon that the line is always there — a warning that is
// always present stops being read.
const WAITING_DAYS = 14;

const icon = (id) => `<span class="tileplate"><svg width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${id}"></use></svg></span>`;

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');
const inOrder = (steps) => [...(steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

/**
 * The step to carry on with: the first one not yet done.
 *
 * DERIVABLE FOR A TRIAL, NOT FOR A PIECE OF CLOTH. A trial's steps are a written
 * plan and each carries `done`, so "the next thing" is a fact the record states.
 * The shelf — unwashed, scoured, mordanted, dyed, finished — is not a sequence:
 * §13bd says plainly that pieces may skip states, because the process is a base
 * type plus a set of enhancements. There is no such thing as the next state of a
 * piece, and a card naming one would be inventing on the first screen, where it
 * is likeliest to be believed.
 *
 * That is why this carousel is built from trials and not from cloth.
 *
 * Returns null when every step is done, and the caller then says something ELSE
 * — never „—", never the last step repeated. A trial in progress with all steps
 * done is a trial waiting to be assessed: a different sentence and a different
 * action.
 */
export function nextStep(trial) {
  return inOrder(trial.steps).find(s => !s.done) || null;
}

/** Where the work has actually got to: the last step marked done. */
export function reachedStep(trial) {
  return [...inOrder(trial.steps)].reverse().find(s => s.done) || null;
}

/** The work's own most recent photograph. Never a stock image. */
export function ownPhoto(trial) {
  for (const s of [...inOrder(trial.steps)].reverse())
    if ((s.photos || []).length) return s.photos[s.photos.length - 1];
  return (trial.resultPhotos || [])[0] || null;
}

const lastActionDate = (f) =>
  (f.actions || []).map(a => a.date || '').filter(Boolean).sort().pop() || '';

function daysSince(date) {
  if (!date) return 0;
  const then = Date.parse(date + 'T00:00:00');
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

export async function continueCards(trials, fabrics) {
  const working = trials
    .filter(tr => (tr.status || 'complete') === 'in_progress')
    .sort(byDateDesc)
    .slice(0, CARDS);

  return (await Promise.all(working.map(async tr => {
    const reached = reachedStep(tr);
    const next = nextStep(tr);
    const photo = ownPhoto(tr);

    const nameOf = async (st) => st
      ? (await label('step_type', st.typeCode))
        || (await label('trial_stage', st.stageCode)) || ''
      : '';

    // The whole design rests on this branch. With an undone step the card says
    // what it is and offers to carry on; with none it says the work is waiting
    // to be assessed and offers that instead. It never fills the line with a
    // dash to keep the shape.
    const line = next
      ? `<span class="contlabel">${t('dash.next')}</span> <b>${
          esc(await nameOf(next) || t('dash.nextUnnamed'))}</b>`
      : `<span class="contlabel">${t('dash.awaiting')}</span>`;

    // „Продължи" is a promise about where you arrive, so it lands on the step
    // rather than at the top of the record.
    const go = next ? `trials/${tr.id}/step/${next.id}` : `trials/${tr.id}`;

    return `
      <div class="contcard">
        <div class="contphoto">${photo
          ? `<img src="${esc(photo)}" alt="" loading="lazy">` : ''}</div>
        <div class="contbody">
          <h3>${esc(workTitle(tr, fabrics) || t('dash.untitledWork'))}</h3>
          <p class="hint">${[esc(await nameOf(reached)), esc(tr.date || '')]
            .filter(Boolean).join(' · ')}</p>
          <p class="contnext">${line}</p>
          <button class="btn primary" data-go="${esc(go)}">${
            next ? t('dash.continue') : t('dash.assess')}</button>
        </div>
      </div>`;
  }))).join('');
}

export default {
  id: 'dashboard',
  title: () => t('dashboard.title'),
  sub: () => t('dashboard.sub'),

  async render(root) {
    const counts = {};
    for (const tile of ALL_STORES) {
      if (tile.store) counts[tile.id] = await count(tile.store);
    }

    const trials = await all('trials');
    const fabrics = await all('fabrics');

    // ------------------------------------------------------- first launch
    //
    // No trials, no cloth, and until the packs are installed no plants either.
    // Every block below would be a heading over nothing, and this is the first
    // impression of a paid library.
    //
    // NO WARNINGS HERE. „Няма архив" is true of an empty installation and means
    // nothing to someone who has not yet written anything; showing it makes the
    // application open by complaining about work that does not exist.
    if (!counts.trials && !counts.fabrics) {
      root.innerHTML = page({
        title: t('dashboard.title'),
        sub: t('dashboard.sub'),
        body: panel(`
          <h2>${t('dash.welcome')}</h2>
          <p>${t('dash.welcomeSub')}</p>
          <p class="hint">${counts.plants
            ? t('dash.libraryHas', { plants: counts.plants,
                combinations: counts.reference, sources: counts.sources })
            : t('dash.libraryEmpty')}</p>
          <div class="btnrow">
            ${counts.plants
              ? `<button class="btn primary" data-go="plants">${t('dash.browsePlants')}</button>`
              : `<button class="btn primary" data-go="tools">${t('dash.installPacks')}</button>`}
            <button class="btn quiet" data-go="trials/new">${t('dash.quick.trial')}</button>
          </div>`),
      });
      return;
    }

    // ---------------------------------------------------------- attention
    //
    // Above everything, and absent when there is nothing to say. This is the
    // only thing on the screen that can cost work which cannot be got back, so
    // it is never below the fold.
    const alerts = [];
    const b = await backupState();
    const mark = `<span class="notemark" aria-hidden="true">!</span>`;
    const goBackup = `<button class="btn quiet" data-go="tools">${t('dash.goBackup')}</button>`;

    if (b.never && (counts.plants || counts.fabrics)) {
      const photos = await count('photos');
      const lost = [];
      const say = (n, key) => plural(n, t(`${key}.one`), t(`${key}.many`));
      if (counts.trials) lost.push(say(counts.trials, 'dash.lostTrials'));
      if (photos) lost.push(say(photos, 'dash.lostPhotos'));
      if (counts.fabrics) lost.push(say(counts.fabrics, 'dash.lostFabrics'));
      alerts.push(note(
        `${mark}<b>${t('dash.backupNever')}</b> ${lost.length
          ? t('dash.wouldLose', { what: lost.join(' · ') }) : ''} ${goBackup}`, 'danger'));
    } else if (!b.never && (b.days > 14 || b.changes > 40)) {
      alerts.push(note(
        `${mark}${t('dash.backupOld', { n: b.days, c: b.changes })} ${goBackup}`, 'danger'));
    }

    // Cloth prepared and then forgotten is the most avoidable waste in the
    // studio. The trials module has computed this for a while and the home
    // screen never said it. It belongs with the backup warning rather than in a
    // panel of its own: both are "this costs you something if you do not look",
    // and a third panel competing for the top of the screen weakens both.
    const busy = new Set(trials
      .filter(tr => (tr.status || 'complete') === 'in_progress')
      .flatMap(tr => tr.fabricIds || []));
    const waiting = fabrics
      .filter(f => !busy.has(f.id) && currentState(f) === 'mordanted')
      .map(f => ({ f, days: daysSince(lastActionDate(f)) }))
      .filter(x => x.days >= WAITING_DAYS)
      .sort((x, y) => y.days - x.days);

    if (waiting.length) {
      const w = waiting[0];
      alerts.push(note(
        `${mark}${t('dash.waiting', {
          name: esc(w.f.name || w.f.label || t('dash.untitledCloth')), n: w.days })}${
        waiting.length > 1 ? ' ' + t('dash.waitingMore', { n: waiting.length - 1 }) : ''}
        <button class="btn quiet" data-go="fabrics/${esc(w.f.id)}">${t('dash.goCloth')}</button>`,
        'warn'));
    }

    if (!counts.plants) alerts.push(note(t('dash.emptyLibrary'), 'warn'));

    // ------------------------------------------------------------- blocks
    const cards = await continueCards(trials, fabrics);

    const boxCounts = {};
    for (const f of fabrics) {
      const st = currentState(f);
      boxCounts[st] = (boxCounts[st] || 0) + 1;
    }
    const boxes = (await Promise.all(STATE_ORDER
      .filter(code => boxCounts[code])
      .map(async code => `
        <button class="box" data-go="fabrics">
          <span class="boxname">${esc(await label('fabric_state', code))}</span>
          <span class="boxcount">${boxCounts[code]}</span>
        </button>`))).join('');

    const tiles = REFERENCE_TILES.map(tile => `
      <button class="tile" data-go="${tile.id}">
        ${icon(tile.icon)}
        <span class="tilename">${t('nav.' + tile.id)}</span>
        ${tile.store ? `<span class="tilecount">${counts[tile.id]}</span>` : ''}
      </button>`).join('');

    const quick = QUICK.map(q => `
      <button class="tile quickact" data-go="${q.go}">
        ${icon(q.icon)}
        <span class="tilename">${t('dash.quick.' + q.id)}</span>
      </button>`).join('');

    root.innerHTML = page({
      title: t('dashboard.title'),
      sub: t('dashboard.sub'),
      body: `
        ${alerts.length ? panel(alerts.join('')) + '<div class="gap"></div>' : ''}

        ${panel(`
          <div class="seasonhead">
            <div><h2>${t('dash.continueTitle')}</h2></div>
            ${cards ? `<a class="seasonall" href="#/trials">${t('dash.allWork')}</a>` : ''}
          </div>
          ${cards
            ? `<div class="contcards">${cards}</div>`
            : `<p class="seasonempty">${t('dash.nothingRunning')}</p>
               <div class="btnrow"><button class="btn primary" data-go="trials/new">${
                 t('dash.quick.trial')}</button></div>`}`)}

        <div class="gap"></div>

        <div class="cols">
          <div class="col">${panel(await seasonPanel(new Date().getMonth() + 1), 'season')}</div>
          <div class="col">
            ${panel(`
              <h2>${t('dash.boxes')}</h2>
              ${boxes ? `<div class="boxes">${boxes}</div>`
                      : `<p class="hint">${t('dash.noFabrics')}</p>`}
            `)}
            ${panel(`
              <h2>${t('dash.quickTitle')}</h2>
              <div class="tiles">${quick}</div>
            `)}
          </div>
        </div>

        <div class="gap"></div>

        ${panel(`
          <h2>${t('nav.group.reference')}</h2>
          <div class="tiles">${tiles}</div>
        `)}`,
    });
  },
};

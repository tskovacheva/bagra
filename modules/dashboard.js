// modules/dashboard.js — the way in, and the state of things.
//
// A grid of every module doubles as navigation, which matters on a phone where
// the bottom bar holds only four. But tiles carrying counts inform as well as
// route: "Plants 48" and "Mordanted 3" answer questions on the way past, and a
// home screen that is only buttons wastes the best screen in the app.

import { all, count } from '../db.js';
import { backupState } from '../backup.js';
import { t, plural } from '../i18n.js';
import { page, panel, label, esc, note } from '../ui.js';
import { currentState, STATE_ORDER } from '../fabric-logic.js';
import { seasonPanel } from './season.js';

// The navigation is already in two labelled halves, and the home screen was one
// undifferentiated heap of eleven. It reads as the same two halves now: the
// reference is what you read, the diary is what you write. §13u.
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

const icon = (id) => `<span class="tileplate"><svg width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${id}"></use></svg></span>`;

export default {
  id: 'dashboard',
  title: () => t('dashboard.title'),
  sub: () => t('dashboard.sub'),

  async render(root) {
    const counts = {};
    for (const tile of ALL_STORES) {
      if (tile.store) counts[tile.id] = await count(tile.store);
    }

    // Attention comes first and only when there is something to say. A panel
    // that is always present stops being read.
    const alerts = [];
    const b = await backupState();
    const mark = `<span class="notemark" aria-hidden="true">!</span>`;
    const goBackup = `<button class="btn quiet" data-go="tools">${t('dash.goBackup')}</button>`;

    // A warning says what will actually be lost, with a number (§13s). "No
    // backup for a while" is a notice; "losing this device now loses 3 trials
    // and 5 photographs" is a prompt. With no backup at all, everything goes,
    // and the totals are exactly right. With a stale one, only the work since
    // is at risk — and the change counter is all that is known about it, so
    // that is all it claims.
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
    if (!counts.plants) {
      alerts.push(note(t('dash.emptyLibrary'), 'warn'));
    }

    const fabrics = await all('fabrics');
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

    // The diary counts states, not modules. "Trials 3" is not a question anyone
    // asks; "how much have I got on the go" is. §13u.
    const trials = await all('trials');
    const byStatus = {};
    for (const tr of trials) byStatus[tr.status || 'planned'] = (byStatus[tr.status || 'planned'] || 0) + 1;
    const diaryTiles = (await Promise.all(
      ['in_progress', 'planned', 'complete'].map(async code => `
        <button class="tile" data-go="trials">
          ${icon('i-trial')}
          <span class="tilename">${esc(await label('trial_status', code))}</span>
          <span class="tilecount">${byStatus[code] || 0}</span>
        </button>`)))
      .concat(`
        <button class="tile" data-go="fabrics">
          ${icon('i-fabric')}
          <span class="tilename">${t('nav.fabrics')}</span>
          <span class="tilecount">${counts.fabrics}</span>
        </button>`).join('');

    root.innerHTML = page({
      title: t('dashboard.title'),
      sub: t('dashboard.sub'),
      body: `
        ${alerts.length ? panel(`<h2>${t('dash.attention')}</h2>${alerts.join('')}`) + '<div class="gap"></div>' : ''}

        <div class="cols">
          <div class="col">
            ${panel(`
              <h2>${t('nav.group.reference')}</h2>
              <div class="tiles">${tiles}</div>
            `)}
            ${panel(`
              <h2>${t('nav.group.diary')}</h2>
              <div class="tiles">${diaryTiles}</div>
            `)}
          </div>

          <div class="col">
            ${panel(`
              <h2>${t('dash.boxes')}</h2>
              ${boxes ? `<div class="boxes">${boxes}</div>` : `<p class="hint">${t('dash.noFabrics')}</p>`}
            `)}

            <div class="gap"></div>
            ${panel(await seasonPanel(new Date().getMonth() + 1), 'season')}

            ${''/* The reliability panel used to live here: a count of claims
                    awaiting testing, headed "Confidence".

                    It is addressed to the owner of a private notebook, and it
                    reads very differently to someone who has paid for the
                    library — the first thing the application says about itself
                    is a number of things it is not sure of. Removed from the
                    home screen for that reason (Part A6); the same count still
                    belongs inside the reference module, where it is a filter
                    for finding what to test rather than a greeting. */}
          </div>
        </div>`,
    });
  },
};

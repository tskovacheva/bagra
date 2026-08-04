// modules/dashboard.js — the way in, and the state of things.
//
// A grid of every module doubles as navigation, which matters on a phone where
// the bottom bar holds only four. But tiles carrying counts inform as well as
// route: "Plants 48" and "Mordanted 3" answer questions on the way past, and a
// home screen that is only buttons wastes the best screen in the app.

import { all, count } from '../db.js';
import { backupState } from '../backup.js';
import { t } from '../i18n.js';
import { page, panel, label, esc, note } from '../ui.js';
import { currentState, STATE_ORDER } from '../fabric-logic.js';

const TILES = [
  { id: 'reference',  icon: 'i-reference', store: 'combinations' },
  { id: 'plants',     icon: 'i-plant',     store: 'plants' },
  { id: 'fabrics',    icon: 'i-fabric',    store: 'fabrics' },
  { id: 'recipes',    icon: 'i-recipe',    store: 'recipes' },
  { id: 'trials',     icon: 'i-trial',     store: 'trials' },
  { id: 'substances', icon: 'i-tools',     store: 'substances' },
  { id: 'materials',  icon: 'i-packs',     store: 'stock' },
  { id: 'techniques', icon: 'i-technique', store: 'techniques' },
  { id: 'tools',      icon: 'i-tools',     store: null },
  { id: 'sources',    icon: 'i-recipe',    store: 'sources' },
  { id: 'packs',      icon: 'i-packs',     store: null },
];

const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;

export default {
  id: 'dashboard',
  title: () => t('dashboard.title'),
  sub: () => t('dashboard.sub'),

  async render(root) {
    const counts = {};
    for (const tile of TILES) {
      if (tile.store) counts[tile.id] = await count(tile.store);
    }

    // Attention comes first and only when there is something to say. A panel
    // that is always present stops being read.
    const alerts = [];
    const b = await backupState();
    if (b.never && (counts.plants || counts.fabrics)) {
      alerts.push(note(`${t('dash.backupNever')} <button class="btn quiet" data-go="tools">${t('dash.goBackup')}</button>`, 'warn'));
    } else if (!b.never && (b.days > 14 || b.changes > 40)) {
      alerts.push(note(`${t('dash.backupOld', { n: b.days, c: b.changes })} <button class="btn quiet" data-go="tools">${t('dash.goBackup')}</button>`, 'warn'));
    }
    if (!counts.plants) {
      alerts.push(note(t('dash.emptyLibrary'), 'warn'));
    }

    // How much of the reference is still somebody else's word.
    const plants = await all('plants');
    const combos = await all('combinations');
    const unverified =
      plants.reduce((n, p) => n + Object.values(p.confidence || {}).filter(v => v === 'unverified').length, 0) +
      combos.filter(c => c.confidence === 'unverified').length;

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

    const tiles = TILES.map(tile => `
      <button class="tile" data-go="${tile.id}">
        ${icon(tile.icon)}
        <span class="tilename">${t('nav.' + tile.id)}</span>
        ${tile.store ? `<span class="tilecount">${counts[tile.id]}</span>` : ''}
      </button>`).join('');

    root.innerHTML = page({
      title: t('dashboard.title'),
      sub: t('dashboard.sub'),
      body: `
        ${alerts.length ? panel(`<h2>${t('dash.attention')}</h2>${alerts.join('')}`) + '<div class="gap"></div>' : ''}

        ${panel(`
          <h2>${t('dash.modules')}</h2>
          <div class="tiles">${tiles}</div>
        `)}

        <div class="gap"></div>

        ${panel(`
          <h2>${t('dash.boxes')}</h2>
          ${boxes ? `<div class="boxes">${boxes}</div>` : `<p class="hint">${t('dash.noFabrics')}</p>`}
          ${unverified ? `<p class="hint" style="margin-top:14px">${t('dash.needsTesting', { n: unverified })} — ${t('dash.needsTestingHint')}</p>` : ''}
        `)}`,
    });
  },
};

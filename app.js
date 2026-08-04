// app.js — bootstrap, routing, navigation.
//
// One render pattern for all modules, fixed here at the outset: each module
// exports { id, title(), sub(), render(root) } and owns nothing outside the
// element it is handed. With seven modules this consistency is the difference
// between one application and seven.

import { open, all, put, count, getSetting } from './db.js';
import { initLang, setLang, getLang, t } from './i18n.js';
import { VOCABULARY, BANDS } from './vocab.js';
import { loadPack } from './seed.js';
import { VERSION } from './version.js';

import dashboard  from './modules/dashboard.js';
import reference  from './modules/reference.js';
import plants     from './modules/plants.js';
import fabrics    from './modules/fabrics.js';
import materials  from './modules/materials.js';
import substances from './modules/substances.js';
import recipes    from './modules/recipes.js';
import techniques from './modules/techniques.js';
import trials     from './modules/trials.js';
import tools      from './modules/tools.js';
import packs      from './modules/packs.js';
import sources    from './modules/sources.js';

const MODULES = {
  dashboard, reference, plants, fabrics, substances, materials,
  recipes, techniques, trials, tools, packs, sources,
};

// Sidebar carries everything; the phone bar carries the five that matter in
// the studio and the garden (§11.3). Laptop is the primary form.
const NAV = [
  { id: 'dashboard',  icon: 'i-home' },
  { id: 'reference',  icon: 'i-reference' },
  { id: 'plants',     icon: 'i-plant' },
  { id: 'fabrics',    icon: 'i-fabric' },
  { id: 'substances', icon: 'i-tools' },
  { id: 'materials',  icon: 'i-packs' },
  { id: 'recipes',    icon: 'i-recipe' },
  { id: 'techniques', icon: 'i-technique' },
  { id: 'trials',     icon: 'i-trial' },
  { id: 'tools',      icon: 'i-tools' },
  { id: 'sources',    icon: 'i-recipe' },
  { id: 'packs',      icon: 'i-packs' },
];

// Four modules earn a permanent place on a phone; the rest are one tap away
// behind "more". A bar of five fixed entries left seven modules — the backup
// among them — unreachable on the device most likely to be lost or replaced.
const PHONE_NAV = ['dashboard', 'reference', 'plants', 'recipes'];

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (id) => `<svg width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${id}"></use></svg>`;

function currentRoute() {
  const id = location.hash.replace(/^#\/?/, '') || 'dashboard';
  return MODULES[id] ? id : 'dashboard';
}

function renderNav() {
  const active = currentRoute();

  $('#sidebar').innerHTML =
    `<div class="brand"><b>${t('app.name')}</b><span>${t('app.tagline')}</span></div>` +
    NAV.map(n => `
      <button class="navitem" data-go="${n.id}"
        ${n.id === active ? 'aria-current="page"' : ''}>
        ${icon(n.icon)}<span>${t('nav.' + n.id)}</span>
      </button>`).join('') +
    `<div class="navgap"></div>
     <div class="langrow">
       <button class="langbtn" data-lang="bg" aria-pressed="${getLang() === 'bg'}">${t('lang.bg')}</button>
       <button class="langbtn" data-lang="en" aria-pressed="${getLang() === 'en'}">${t('lang.en')}</button>
       <span class="version" title="${esc(t('app.version'))}">v${VERSION}</span>
     </div>`;

  const inSheet = !PHONE_NAV.includes(active);
  $('#bottomnav').innerHTML = PHONE_NAV.map(id => {
    const n = NAV.find(x => x.id === id);
    return `<button data-go="${id}" ${id === active ? 'aria-current="page"' : ''}>
      ${icon(n.icon)}<span>${t('nav.' + id)}</span></button>`;
  }).join('') +
    `<button data-more ${inSheet ? 'aria-current="page"' : ''}>
      ${icon('i-more')}<span>${t('nav.more')}</span></button>`;
}

async function renderView(fresh = false) {
  const id = currentRoute();
  const view = $('#view');
  // Entering a module from the navigation starts at its list; a plain redraw
  // (language switch, hash change within the module) leaves state alone.
  if (fresh) MODULES[id].reset?.();
  await MODULES[id].render(view);
  view.focus({ preventScroll: true });
  document.title = `${t('nav.' + id)} · ${t('app.name')}`;
}

function renderSheet() {
  const active = currentRoute();
  const sheet = $('#moresheet');
  sheet.innerHTML = `
    <div class="morepanel" role="dialog" aria-modal="true" aria-label="${esc(t('nav.more'))}">
      <div class="morehead">
        <h2>${t('nav.more')}</h2>
        <button class="btn quiet" data-closemore>${t('common.close')}</button>
      </div>
      <div class="moregrid">
        ${NAV.map(n => `<button class="moreitem" data-go="${n.id}"
            ${n.id === active ? 'aria-current="page"' : ''}>
            ${icon(n.icon)}<span>${t('nav.' + n.id)}</span></button>`).join('')}
      </div>
      <div class="morelang">
        <button class="langbtn" data-lang="bg" aria-pressed="${getLang() === 'bg'}">${t('lang.bg')}</button>
        <button class="langbtn" data-lang="en" aria-pressed="${getLang() === 'en'}">${t('lang.en')}</button>
        <span class="version">v${VERSION}</span>
      </div>
    </div>`;
}

function openSheet() { renderSheet(); $('#moresheet').hidden = false; }
function closeSheet() { $('#moresheet').hidden = true; }

async function route(fresh = false) {
  renderNav();
  await renderView(fresh);
}

// Vocabularies and bands ship as seed data (§13.10). Seeding only ever adds:
// a term already present is left alone, so the user's edits survive.
// The reference library ships as JSON, not as code (§14.2), so the initial
// load is simply the import of a base pack — one mechanism, not two.
async function seedIfEmpty() {
  if (await count('vocabulary') === 0) {
    for (const v of VOCABULARY) await put('vocabulary', { ...v, origin: 'seed' });
  }
  if (await count('bands') === 0) {
    for (const b of BANDS) await put('bands', { ...b, origin: 'seed' });
  }
}

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-doupdate]')) {
    if (waitingWorker) waitingWorker.postMessage('skip-waiting');
    else location.reload();
    return;
  }
  if (e.target.closest('[data-dismissupdate]')) {
    document.getElementById('updatebar')?.remove();
    return;
  }

  if (e.target.closest('[data-more]')) { openSheet(); return; }
  if (e.target.closest('[data-closemore]') || e.target.id === 'moresheet') { closeSheet(); return; }

  const go = e.target.closest('[data-go]');
  if (go) {
    closeSheet();
    const target = '#/' + go.dataset.go;
    // Setting an unchanged hash fires no event, so the click would do nothing —
    // which is exactly what happened when returning to a module from a detail.
    if (location.hash === target) await route(true);
    else location.hash = target;
    return;
  }

  const lang = e.target.closest('[data-lang]');
  if (lang) {
    await setLang(lang.dataset.lang);
    if (!$('#moresheet').hidden) renderSheet();
    await route();
  }
});

window.addEventListener('hashchange', () => route(true));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// ---------------------------------------------------------------- updates
//
// Waiting for a browser to notice a new version on its own is the difference
// between a deploy and a deploy that anyone sees. An installed PWA in
// particular may not reload for days. So: check often, and when something new
// is ready, say so and let the person choose the moment.

let waitingWorker = null;

function showUpdateBar() {
  if (document.getElementById('updatebar')) return;
  const bar = document.createElement('div');
  bar.id = 'updatebar';
  bar.className = 'updatebar';
  bar.innerHTML = `
    <span>${esc(t('update.available'))}</span>
    <button class="btn primary" data-doupdate>${esc(t('update.reload'))}</button>
    <button class="btn quiet" data-dismissupdate aria-label="${esc(t('common.close'))}">×</button>`;
  document.body.appendChild(bar);
}

async function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    // updateViaCache:'none' keeps the browser from serving a stale sw.js,
    // which would hide every later change behind an HTTP cache.
    const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });

    if (reg.waiting && navigator.serviceWorker.controller) {
      waitingWorker = reg.waiting;
      showUpdateBar();
    }

    reg.addEventListener('updatefound', () => {
      const fresh = reg.installing;
      if (!fresh) return;
      fresh.addEventListener('statechange', () => {
        // A controller already present means this is an update, not a first install.
        if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = fresh;
          showUpdateBar();
        }
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });

    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    window.addEventListener('online', check);
    setInterval(check, 15 * 60 * 1000);
    window.bagraCheckUpdate = check;
  } catch { /* offline, or no worker support; the app runs regardless */ }
}

(async function start() {
  await open();
  await initLang();
  await seedIfEmpty();
  // Failing to seed must not take the whole app down with it.
  for (const name of ['substances', 'plants', 'techniques', 'combinations']) {
    try { await loadPack(name); }
    catch (err) { console.warn('seed failed:', name, err); }
  }
  await route();

  registerWorker();
})();

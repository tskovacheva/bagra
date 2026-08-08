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
import * as dirty from './dirty.js';

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

// The sidebar carries everything, in two halves plus a footer (§11.3).
//
// Twelve flat entries told nobody what shape the application has. The split is
// the one the data already makes: **the reference** is knowledge that is true
// whether or not this particular person owns anything, ships in seed packs and
// is read at the desk; **the diary** is her own work, never distributed. What
// belongs to neither — the backup, the packs — sits under a rule at the bottom
// rather than being filed with one half for want of anywhere else.
//
// `heading` marks a label rather than a destination; `footer` marks the rule.
// An entry may carry an explicit `route` and `label`, which is how the backup
// and the calculators reach one module at two addresses.
const NAV = [
  { id: 'dashboard',  icon: 'i-home' },

  { heading: 'reference' },
  { id: 'reference',  icon: 'i-reference' },
  { id: 'plants',     icon: 'i-plant' },
  { id: 'recipes',    icon: 'i-recipe' },
  { id: 'substances', icon: 'i-tools' },
  // Stays beside Substances rather than moving to the diary, because that is
  // where it is going: folded into the substance record once that has a read
  // view. Moving it to the diary first would move it twice.
  { id: 'materials',  icon: 'i-packs' },
  { id: 'techniques', icon: 'i-technique' },
  { id: 'tools',      icon: 'i-tools', label: 'nav.calculators' },
  { id: 'sources',    icon: 'i-recipe' },

  { heading: 'diary' },
  { id: 'trials',     icon: 'i-trial' },
  { id: 'fabrics',    icon: 'i-fabric' },

  { footer: true },
  // The backup was the first of nine buttons in the calculator picker, chosen
  // from the same row as the WOF conversion. One module trying to be two
  // things — the same fault as the original "material" record (§13.4). Split
  // in the navigation rather than in the code: two addresses, one module.
  { id: 'tools',      icon: 'i-packs', route: 'tools/backup', label: 'nav.backup' },
  { id: 'packs',      icon: 'i-packs' },
];

const navItems = () => NAV.filter(n => n.id);
const navRoute = (n) => n.route || n.id;
const navLabel = (n) => t(n.label || 'nav.' + n.id);

export const MODULE_IDS = Object.keys(MODULES);

// The diary earns the phone, not the reference. The bar carried Reference and
// Recipes — both read at the desk — while Trials and Fabrics sat behind "more",
// on the one device where the work is actually recorded. Plants stays: that one
// is read standing in front of the bed.
const PHONE_NAV = ['dashboard', 'trials', 'plants', 'fabrics'];

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (id) => `<svg width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${id}"></use></svg>`;

// A route may name a record: `#/trials/<id>`, or `#/trials/new`. This is how
// one module hands off to another — the cloth saying "continue this story"
// (§8.0c) — and it goes through the address rather than through a shared
// variable so that the back button, a reload and a bookmark all still work.
function parseRoute() {
  const [id, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  return MODULES[id] ? { id, args } : { id: 'dashboard', args: [] };
}

function currentRoute() { return parseRoute().id; }

// Which navigation entry is lit. Two entries point at `tools`, so the module id
// alone cannot decide it: `#/tools/backup` must light the backup and not the
// calculators. A record address — `#/plants/<id>` — matches no entry and falls
// back to the module, which is what keeps a plant lit while it is open.
function activeNav() {
  const { id, args } = parseRoute();
  const full = args.length ? `${id}/${args[0]}` : id;
  return navItems().some(n => navRoute(n) === full) ? full : id;
}

function renderNav() {
  const active = activeNav();

  const entry = (n, cls) => `
    <button class="${cls}" data-go="${navRoute(n)}"
      ${navRoute(n) === active ? 'aria-current="page"' : ''}>
      ${icon(n.icon)}<span>${esc(navLabel(n))}</span>
    </button>`;

  $('#sidebar').innerHTML =
    `<div class="brand"><b>${t('app.name')}</b><span>${t('app.tagline')}</span></div>` +
    NAV.map(n => {
      if (n.heading) return `<div class="navhead">${esc(t('nav.group.' + n.heading))}</div>`;
      if (n.footer) return `<div class="navgap"></div><div class="navrule"></div>`;
      return entry(n, 'navitem');
    }).join('') +
    `<div class="langrow">
       <button class="langbtn" data-lang="bg" aria-pressed="${getLang() === 'bg'}">${t('lang.bg')}</button>
       <button class="langbtn" data-lang="en" aria-pressed="${getLang() === 'en'}">${t('lang.en')}</button>
       <span class="version" title="${esc(t('app.version'))}">v${VERSION}</span>
     </div>`;

  const inSheet = !PHONE_NAV.includes(active);
  $('#bottomnav').innerHTML = PHONE_NAV.map(id => {
    const n = navItems().find(x => navRoute(x) === id);
    return `<button data-go="${id}" ${id === active ? 'aria-current="page"' : ''}>
      ${icon(n.icon)}<span>${esc(navLabel(n))}</span></button>`;
  }).join('') +
    `<button data-more ${inSheet ? 'aria-current="page"' : ''}>
      ${icon('i-more')}<span>${t('nav.more')}</span></button>`;
}

async function renderView(fresh = false) {
  const { id, args } = parseRoute();
  const view = $('#view');
  // Entering a module from the navigation starts at its list; a plain redraw
  // (language switch, hash change within the module) leaves state alone.
  if (fresh) MODULES[id].reset?.();
  // A named record is honoured after the reset, never before it — the reset
  // is what clears whatever the module was showing last.
  if (args.length) MODULES[id].open?.(...args);
  await MODULES[id].render(view);
  view.focus({ preventScroll: true });
  document.title = `${t('nav.' + id)} · ${t('app.name')}`;
}

// The sheet is grouped like the sidebar, because the phone is where a person is
// least able to hold twelve unlabelled tiles in their head.
function navGroups() {
  const out = [{ heading: null, items: [] }];
  for (const n of NAV) {
    if (n.heading) out.push({ heading: t('nav.group.' + n.heading), items: [] });
    else if (n.footer) out.push({ heading: null, rule: true, items: [] });
    else out[out.length - 1].items.push(n);
  }
  return out.filter(g => g.items.length);
}

function renderSheet() {
  const active = activeNav();
  const sheet = $('#moresheet');
  sheet.innerHTML = `
    <div class="morepanel" role="dialog" aria-modal="true" aria-label="${esc(t('nav.more'))}">
      <div class="morehead">
        <h2>${t('nav.more')}</h2>
        <button class="btn quiet" data-closemore>${t('common.close')}</button>
      </div>
      ${navGroups().map(g => `
        ${g.rule ? '<div class="navrule"></div>' : ''}
        ${g.heading ? `<div class="navhead">${esc(g.heading)}</div>` : ''}
        <div class="moregrid">
          ${g.items.map(n => `<button class="moreitem" data-go="${navRoute(n)}"
              ${navRoute(n) === active ? 'aria-current="page"' : ''}>
              ${icon(n.icon)}<span>${esc(navLabel(n))}</span></button>`).join('')}
        </div>`).join('')}
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

// The browser's back button changes the hash without a click, so the guard
// cannot intercept it — by the time this fires the address has already moved.
// Refusing means putting it back, which fires hashchange again; `restoring`
// keeps that second pass from asking a second time.
let lastHash = location.hash;
let restoring = false;

window.addEventListener('hashchange', () => {
  if (restoring) { restoring = false; lastHash = location.hash; return; }
  if (!dirty.allowRouteChange()) {
    restoring = true;
    location.hash = lastHash;
    return;
  }
  lastHash = location.hash;
  route(true);
});
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
  dirty.install(() => confirm(t('common.discardUnsaved')));
  await route();

  registerWorker();
})();

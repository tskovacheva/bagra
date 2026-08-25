// app.js — bootstrap, routing, navigation.
//
// One render pattern for all modules, fixed here at the outset: each module
// exports { id, title(), sub(), render(root) } and owns nothing outside the
// element it is handed. With seven modules this consistency is the difference
// between one application and seven.

// `put` is deliberately absent: nothing app.js does at boot is the user's own
// edit. Everything here seeds, migrates or repairs, and all of it goes through
// `putSystem` so it stays out of the backup counter.
import { open, all, putSystem, putMigration, get, count, getSetting, setSetting } from './db.js';
import { icon, labelCells, navigate } from './ui.js';
import { initLang, setLang, getLang, t } from './i18n.js';
import { initUnits, setSystem, getSystem } from './units.js';
import { VOCABULARY, BANDS } from './vocab.js';
import { ensurePacks, PACKS } from './seed.js';
import { runMigrations } from './migrations.js';
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
import library    from './modules/library.js';
import pigments   from './modules/pigments.js';
import batch      from './modules/batch.js';

const MODULES = {
  dashboard, reference, plants, fabrics, substances, materials,
  recipes, techniques, trials, tools, packs, library, batch, pigments,
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
  { id: 'substances', icon: 'i-substance' },
  // Stock has no entry of its own. It folded into the material record once that
  // had a read view (§11b): the jars are a block inside the material, and "what
  // is running low" is a filter over the list rather than a second screen
  // listing the same jars in another order. The module stays registered so
  // `#/materials/<id>` keeps working — it now sends the jar's own material to
  // the screen — because addresses already saved must not break.
  // { id: 'materials',  icon: 'i-stock' },
  { id: 'techniques', icon: 'i-technique' },
  { id: 'tools',      icon: 'i-tools', label: 'nav.calculators' },
  { id: 'library',    icon: 'i-source' },

  { heading: 'diary' },
  { id: 'trials',     icon: 'i-trial' },
  { id: 'pigments',   icon: 'i-mortar' },
  { id: 'fabrics',    icon: 'i-fabric' },

  { footer: true },
  // The backup was the first of nine buttons in the calculator picker, chosen
  // from the same row as the WOF conversion. One module trying to be two
  // things — the same fault as the original "material" record (§13.4). Split
  // in the navigation rather than in the code: two addresses, one module.
  { id: 'tools',      icon: 'i-backup', route: 'tools/backup', label: 'nav.backup' },
  // Packs is out of the 1.0 plan and unbuilt, so it does not sit in the
  // navigation collecting clicks. The module stays registered and reachable at
  // `#/packs`, because removing it would break any address already saved.
  // { id: 'packs',   icon: 'i-packs' },
];

const navItems = () => NAV.filter(n => n.id);
const navRoute = (n) => n.route || n.id;
const navLabel = (n) => t(n.label || 'nav.' + n.id);

export const MODULE_IDS = Object.keys(MODULES);

// Deliberately absent from the navigation, and named here so the reachability
// check stays a real guard rather than being loosened. Packs is out of the 1.0
// plan and unbuilt; the module stays registered so `#/packs` still resolves for
// any address already saved.
// Modules with no sidebar entry, declared rather than inferred: an orphan is
// otherwise indistinguishable from a module someone forgot to link. `packs` is
// unbuilt; `materials` is the old Stock address, now a redirect into the
// material that owns the jar (§11b).
// `batch` is reached from the fabrics list rather than the sidebar: a group
// action is something done TO pieces, so it belongs beside them and not as a
// twelfth destination of its own (§13bd).
export const HIDDEN_MODULES = ['packs', 'materials', 'batch'];

// The diary earns the phone, not the reference. The bar carried Reference and
// Recipes — both read at the desk — while Trials and Fabrics sat behind "more",
// on the one device where the work is actually recorded. Plants stays: that one
// is read standing in front of the bed.
const PHONE_NAV = ['dashboard', 'trials', 'plants', 'fabrics'];

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


// A route may name a record: `#/trials/<id>`, or `#/trials/new`. This is how
// one module hands off to another — the cloth saying "continue this story"
// (§8.0c) — and it goes through the address rather than through a shared
// variable so that the back button, a reload and a bookmark all still work.
// An address may carry a query — `#/batch?pieces=a,b,c` — for a handoff that
// is genuinely a parameter of the destination rather than part of its path.
// Stripped here rather than in the module, because `id` would otherwise read
// as `batch?pieces=a,b` and resolve to nothing, sending the user to the home
// screen with the ticks silently gone. §13q: the address is the state, which
// only holds if the address is parsed in one place.
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const qAt = raw.indexOf('?');
  const path = qAt === -1 ? raw : raw.slice(0, qAt);
  const query = new URLSearchParams(qAt === -1 ? '' : raw.slice(qAt + 1));
  const [id, ...args] = path.split('/');
  return MODULES[id] ? { id, args, query } : { id: 'dashboard', args: [], query };
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
     </div>
     <div class="langrow">
       <button class="langbtn" data-units="metric" aria-pressed="${getSystem() === 'metric'}">${t('units.metric')}</button>
       <button class="langbtn" data-units="imperial" aria-pressed="${getSystem() === 'imperial'}">${t('units.imperial')}</button>
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

// Two renders of one module could be in flight at once, and the one that
// finished last won rather than the one that was asked for last. Every
// `render()` is asynchronous — it reads the database, resolves vocabulary terms,
// waits on photographs — and only writes `innerHTML` at the end. Ask for plants
// and then immediately for sources, and sources draws first, plants lands on top
// of it, and the screen now disagrees with the address. It never bit in a
// browser, where a person cannot press twice that fast; it bit in the check
// suite, which can.
//
// Two things, and both are needed. A **generation** so a render that has been
// overtaken abandons rather than draws, and a **chain** so the next one starts
// only after the previous has finished — without the chain, abandoning is
// decided before the overtaking request exists.
let generation = 0;
let inFlight = Promise.resolve();

async function renderView(fresh = false) {
  const mine = ++generation;
  const previous = inFlight;
  let release;
  inFlight = new Promise(r => { release = r; });
  try {
    await previous;
    // Overtaken while waiting: the address has moved on and drawing this now
    // would put the wrong screen under the right address.
    if (mine !== generation) return;
    await draw(fresh);
  } finally {
    release();
  }
}

async function draw(fresh = false) {
  const { id, args, query } = parseRoute();
  const view = $('#view');
  // Two different questions, and they were being answered by one flag.
  //
  // `reset()` means "I have arrived from somewhere else": start at the list,
  // drop the search, drop the filters. `open()` means "this is what the address
  // says to show". Firing both on every hash change made moving *within* a
  // module — opening a record and coming back — throw away the search that led
  // there, which is the one thing a person is guaranteed to want back.
  if (fresh) MODULES[id].reset?.();
  // Always, and after the reset. Called with nothing when the address names no
  // record, which is how a module returns to its list: the address is the
  // state, not a copy of it kept alongside.
  // The query is passed only to a module that says it takes one. Appending it
  // to `args` unconditionally looked tidier and was wrong: every `open(first,
  // second)` in the application reads its arguments by position, so `#/plants`
  // — no args at all — handed the URLSearchParams object in as `first`, which
  // is truthy, and the module went off to fetch a record whose id was a
  // URLSearchParams. Caught by check-boot on the first run; it would have been
  // a blank screen on every list in the application.
  if (MODULES[id].takesQuery) MODULES[id].open?.(...args, query);
  else MODULES[id].open?.(...args);
  await MODULES[id].render(view);
  labelCells(view);
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
      </div>
      <div class="langrow">
        <button class="langbtn" data-units="metric" aria-pressed="${getSystem() === 'metric'}">${t('units.metric')}</button>
        <button class="langbtn" data-units="imperial" aria-pressed="${getSystem() === 'imperial'}">${t('units.imperial')}</button>
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
// Tops up on every start, not only into an empty store — the same rule the seed
// packs already follow for records.
//
// The gate used to be `count === 0`, which meant every term added to vocab.js
// after a person's first install never reached their database. `label()` returns
// the raw code when a term is missing, and the codes are English, so the symptom
// was "there is English text in the Bulgarian version" — reported by the owner
// on the enhancement checkboxes, which read `cloth_mordant` instead of
// „платът е мордантиран“. Every safety term added in 0.74.0 would have done the
// same on her installed copy.
//
// That fix was half a fix, and the other half showed up in 1.0.0-rc8. Adding
// only what was ABSENT meant a term whose label we shipped WRONG could never be
// corrected: `chemistry_class:anthocyanin` was renamed „антоциани" →
// „антоцианини" in vocab.js — IUPAC separates anthocyanins from anthocyanidins,
// and the application's own prose already used the longer form everywhere — and
// the plant screen went on saying „антоциани", because the key was already
// there and "already there" meant "leave alone". A correction that cannot reach
// an installed copy is not a correction.
//
// So a seeded term is now updated in place, and only a seeded one: `origin` is
// the test. Nothing in the application writes to `vocabulary` except this
// function — there is no vocabulary editor and never has been — so no edit of
// hers can be sitting in a term for this to overwrite. If an editor is ever
// built, it must mark what it touches (`origin: 'user'` or an `edited` flag)
// BEFORE this runs again, or the first start after her edit will undo it.
// Guarded by deep-check so that requirement cannot be forgotten quietly.
export async function seedIfEmpty() {
  const haveVocab = new Map((await all('vocabulary')).map(v => [v.key, v]));
  for (const v of VOCABULARY) {
    const mine = haveVocab.get(v.key);
    if (!mine) { await putSystem('vocabulary', { ...v, origin: 'seed' }); continue; }
    if (mine.origin !== 'seed') continue;
    // Only when something actually differs, so a start is not a hundred
    // pointless writes.
    if (JSON.stringify(mine.label) !== JSON.stringify(v.label)
        || JSON.stringify(mine.description ?? null) !== JSON.stringify(v.description ?? null)
        || mine.order !== v.order) {
      await putSystem('vocabulary', { ...mine, ...v, origin: 'seed' });
    }
  }

  const haveBands = new Map((await all('bands')).map(b => [b.key, b]));
  for (const b of BANDS) {
    const mine = haveBands.get(b.key);
    if (!mine) { await putSystem('bands', { ...b, origin: 'seed' }); continue; }
    if (mine.origin !== 'seed') continue;
    if (JSON.stringify(mine.label) !== JSON.stringify(b.label)
        || mine.min !== b.min || mine.max !== b.max || mine.unit !== b.unit) {
      await putSystem('bands', { ...mine, ...b, origin: 'seed' });
    }
  }
}



document.addEventListener('click', async (e) => {
  // The way up out of a record: an ADDRESS, not a step back through history
  // (§13bo). Handled once here rather than in fourteen modules, and it goes
  // through `navigate` so the unsaved-work guard sees it like any other move.
  const up = e.target.closest('[data-goto]');
  if (up) { navigate(up.dataset.goto); return; }

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

  // Units, beside the language and for the same reason: both are properties of
  // the DEVICE rather than of the work (§13dc), and both need every open screen
  // redrawn, because the change is entirely in what is displayed.
  const units = e.target.closest('[data-units]');
  if (units) {
    await setSystem(units.dataset.units);
    if (!$('#moresheet').hidden) renderSheet();
    await route();
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
let lastModule = null;

window.addEventListener('hashchange', () => {
  if (restoring) { restoring = false; lastHash = location.hash; return; }
  if (!dirty.allowRouteChange()) {
    restoring = true;
    location.hash = lastHash;
    return;
  }
  // Fresh only when the module itself changed. Within one module the address is
  // moving between its own screens, and the list's search must survive that.
  const arriving = parseRoute().id;
  const fresh = arriving !== lastModule;
  lastModule = arriving;
  lastHash = location.hash;
  route(fresh);
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

// The column headings are carried into the cells so a table can be read as
// stacked rows on a phone (§13ae). Watched rather than called, because a module
// redraws its own list on every keystroke of the search and on every filter,
// without passing through the router: calling it once after `render` labelled
// the first draw and left every later one bare — the rows would have gone
// unlabelled at exactly the moment someone was narrowing a list to find
// something.
function watchLists() {
  const view = $('#view');
  const observer = new MutationObserver(() => {
    // Setting an attribute inside the callback would fire the observer again.
    observer.disconnect();
    labelCells(view);
    observer.observe(view, { childList: true, subtree: true });
  });
  observer.observe(view, { childList: true, subtree: true });
}

(async function start() {
  await open();
  await initLang();
  await initUnits();
  await seedIfEmpty();
  // Every declared pack, derived from PACKS rather than listed here. The list
  // was written by hand and `sources` was left out of it: the pack was declared,
  // with a comment saying it is seeded deliberately (§13r), and never loaded, so
  // the four attested sources the library credits shipped as an empty screen. A
  // second list of the same thing is a second thing to forget. Guarded (§13aa).
  // Failing to seed must not take the whole app down with it.
  // Only the packs that need it (§13cs). An unchanged installed library is
  // recognised from a 534-byte manifest and a read of the ids, so a normal
  // start no longer fetches and parses the plant pack to discover that all 57
  // records are already there.
  await ensurePacks();
  // Each historical repair runs once for this database, and the marker travels
  // in the backup with the data it describes (§13cw).
  await runMigrations();
  dirty.install(() => confirm(t('common.discardUnsaved')));
  watchLists();
  await route();

  registerWorker();
})();

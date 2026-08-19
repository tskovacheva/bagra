// app.js — bootstrap, routing, navigation.
//
// One render pattern for all modules, fixed here at the outset: each module
// exports { id, title(), sub(), render(root) } and owns nothing outside the
// element it is handed. With seven modules this consistency is the difference
// between one application and seven.

import { open, all, put, get, count, getSetting } from './db.js';
import { icon, labelCells, navigate } from './ui.js';
import { initLang, setLang, getLang, t } from './i18n.js';
import { VOCABULARY, BANDS } from './vocab.js';
import { loadPack, PACKS } from './seed.js';
import { VERSION } from './version.js';
import * as dirty from './dirty.js';
import { migrateAll } from './migrate-actions.js';

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
import batch      from './modules/batch.js';

const MODULES = {
  dashboard, reference, plants, fabrics, substances, materials,
  recipes, techniques, trials, tools, packs, sources, batch,
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
  { id: 'sources',    icon: 'i-source' },

  { heading: 'diary' },
  { id: 'trials',     icon: 'i-trial' },
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
// A term already present is left alone, so her edits survive.
async function seedIfEmpty() {
  const haveVocab = new Set((await all('vocabulary')).map(v => v.key));
  for (const v of VOCABULARY)
    if (!haveVocab.has(v.key)) await put('vocabulary', { ...v, origin: 'seed' });

  const haveBands = new Set((await all('bands')).map(b => b.key));
  for (const b of BANDS)
    if (!haveBands.has(b.key)) await put('bands', { ...b, origin: 'seed' });
}

// One work, one mark on a piece — repairing what the fault already wrote.
//
// Finishing pushed a state event every time screen 4 was saved, and the date
// opened at today, so editing the result of an old piece of work stamped the
// piece a second time with today's date (§13au). Three pieces in the owner's
// own diary claim to have been finished twice.
//
// The earliest of the duplicates is kept, because the later one is always the
// re-visit: the original carries the day she chose, the duplicate carries the
// day she happened to open the record. That date is also the honest answer to
// "when did this work finish", so it fills `finishedOn` where the work has
// none — which recovers dates that were otherwise lost.
//
// Idempotent: with no duplicates left it changes nothing and says nothing.
export async function healDoubleStateEvents() {
  const trials = await all('trials');
  const byId = new Map(trials.map(tr => [tr.id, tr]));
  let pieces = 0;

  for (const f of await all('fabrics')) {
    const events = f.stateEvents || [];
    const seen = new Map();
    const keep = [];
    let dropped = 0;

    for (const e of events) {
      if (!e.trialId) { keep.push(e); continue; }
      const prev = seen.get(e.trialId);
      if (!prev) { seen.set(e.trialId, e); keep.push(e); continue; }
      // Whichever is earlier is the one that was meant.
      if ((e.date || '') < (prev.date || '')) {
        prev.date = e.date;
        prev.stateCode = e.stateCode || prev.stateCode;
      }
      dropped++;
    }

    if (!dropped) continue;
    f.stateEvents = keep;   // legacy: repairs records written before §13bd
    await put('fabrics', f);
    pieces++;
  }

  // The recovered dates, applied only where the work has none of its own.
  for (const f of await all('fabrics')) {
    for (const e of f.stateEvents || []) {
      const tr = e.trialId && byId.get(e.trialId);
      if (tr && !tr.finishedOn && e.date) {
        tr.finishedOn = e.date;
        await put('trials', tr);
      }
    }
  }

  if (pieces) console.info(`healed doubled state events on ${pieces} piece(s)`);
}


// `stateEvents` become `actions`, and each batch becomes a record of its own
// (§13bd). Runs at every boot and is a no-op once done.
//
// The old list is NOT removed. Migrations only add, and for a fortnight the two
// lists coexist deliberately: `actions` is the only one the application reads
// or writes, and `stateEvents` stays as a way back if the mapping turns out to
// be wrong. It comes out in a later version, on purpose, not by drift.
//
// Ordered after `healDoubleStateEvents` and not before it: migrating first
// would copy the duplicates into the new list and the repair would then only
// fix the old one, leaving the two disagreeing about how many times a piece
// was finished.
export async function migrateFabricActions() {
  const fabrics = await all('fabrics');
  const { fabrics: migrated, batches, report } = migrateAll(fabrics);
  if (!report.actions && !fabrics.some(f => !Array.isArray(f.actions))) return;

  let touched = 0;
  for (let i = 0; i < fabrics.length; i++) {
    if (Array.isArray(fabrics[i].actions)) continue;
    await put('fabrics', migrated[i]);
    touched++;
  }
  for (const b of batches) {
    // `add` semantics by hand: a batch whose id already exists was written by
    // an earlier run, and overwriting it would discard a weight or a deviation
    // she has since filled in by hand.
    if (await get('batchActions', b.id)) continue;
    await put('batchActions', b);
  }

  if (touched) {
    console.info(`migrated ${report.actions} action(s) on ${touched} piece(s), ` +
                 `${batches.length} batch(es)`);
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
  await seedIfEmpty();
  // Every declared pack, derived from PACKS rather than listed here. The list
  // was written by hand and `sources` was left out of it: the pack was declared,
  // with a comment saying it is seeded deliberately (§13r), and never loaded, so
  // the four attested sources the library credits shipped as an empty screen. A
  // second list of the same thing is a second thing to forget. Guarded (§13aa).
  // Failing to seed must not take the whole app down with it.
  for (const name of Object.keys(PACKS)) {
    try { await loadPack(name); }
    catch (err) { console.warn('seed failed:', name, err); }
  }
  await healDoubleStateEvents();
  await migrateFabricActions();
  dirty.install(() => confirm(t('common.discardUnsaved')));
  watchLists();
  await route();

  registerWorker();
})();

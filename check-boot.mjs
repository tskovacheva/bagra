// check-boot.mjs — actually loads the app, in a simulated browser.
//
// `node --check` reads one file at a time and passes on things the browser
// refuses: a name imported twice, an import of an export that does not exist,
// a throw during start-up. Any of those gives a blank page with nothing in the
// interface to explain it. Booting the real module graph catches all three.
//
// Requires jsdom and fake-indexeddb, installed only for this check:
//   npm install --no-save jsdom fake-indexeddb

import fs from 'fs';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
  url: 'https://example.org/bagra/',
  runScripts: 'outside-only',
});

const define = (name, value) =>
  Object.defineProperty(global, name, { value, configurable: true, writable: true });

define('window', dom.window);
define('document', dom.window.document);
define('location', dom.window.location);
define('navigator', dom.window.navigator);
define('HTMLElement', dom.window.HTMLElement);
define('Image', dom.window.Image);
define('FileReader', dom.window.FileReader);
define('Blob', dom.window.Blob);
define('URL', dom.window.URL);
define('alert', () => {});
define('confirm', () => true);
// Globals a browser has and this harness did not. Code calling `new Event(...)`
// threw only here, never in the app — see §13e.4.
define('Event', dom.window.Event);
define('MouseEvent', dom.window.MouseEvent);
define('CustomEvent', dom.window.CustomEvent);
// Added when `watchLists()` arrived (§13ae): jsdom has MutationObserver, but
// this harness hands globals over one at a time, so a missing one reads as a
// throw during start-up rather than as a gap in the harness.
define('MutationObserver', dom.window.MutationObserver);
define('crypto', { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) });

// Seed packs are fetched relative to the page.
define('fetch', async (u) => {
  const p = String(u).replace(/^.*\/bagra\//, '');
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
});

let failed = false;
const fail = (label, err) => {
  failed = true;
  console.log(`BOOT FAILED (${label}): ${err && err.message ? err.message : err}`);
  if (err && err.stack) console.log(err.stack.split('\n').slice(1, 4).join('\n'));
};

process.on('unhandledRejection', (e) => fail('rejection', e));
process.on('uncaughtException', (e) => fail('exception', e));

try {
  const app = await import('./app.js');

  await new Promise(r => setTimeout(r, 1200));

  const view = document.getElementById('view');
  const navItems = document.querySelectorAll('#sidebar .navitem').length;

  if (!navItems) fail('render', new Error('navigation is empty'));
  if (!view || view.innerHTML.trim().length < 40) fail('render', new Error('the view rendered nothing'));

  // Visiting every module catches a module that only throws when opened.
  if (!failed && app.MODULE_IDS) {
    for (const id of app.MODULE_IDS) {
      try {
        location.hash = '#/' + id;
        await new Promise(r => setTimeout(r, 60));
      } catch (err) { fail('module ' + id, err); }
    }

    // A module with no way in is a module that quietly stops being used. The
    // sidebar carries more entries than there are modules — the backup and the
    // calculators are one module at two addresses — so this counts the reverse
    // direction: every module must be reachable.
    const reachable = new Set([...document.querySelectorAll('#sidebar [data-go]')]
      .map(b => b.dataset.go.split('/')[0]));
    const hidden = new Set(app.HIDDEN_MODULES || []);
    const orphans = app.MODULE_IDS.filter(id => !reachable.has(id) && !hidden.has(id));
    if (orphans.length)
      fail('navigation', new Error(`no way in from the sidebar: ${orphans.join(', ')}`));
  }

  // Every vocabulary term must reach the database, and the database must be
  // topped up on an existing install rather than only seeded into an empty one.
  // When a term is missing, `label()` returns the raw code — and the codes are
  // English, so a missing term looks like a missing translation. §13e.7.
  if (!failed) {
    const { VOCABULARY } = await import('./vocab.js');
    const db = await import('./db.js');
    const have = new Set((await db.all('vocabulary')).map(v => v.key));
    const absent = VOCABULARY.filter(v => !have.has(v.key));
    if (absent.length)
      fail('vocabulary', new Error(
        `${absent.length} terms never reached the database, e.g. ${absent.slice(0, 3).map(v => v.key).join(', ')}`));
    else console.log(`vocabulary complete — ${VOCABULARY.length} terms.`);
  }

  if (!failed) console.log(
    `boots cleanly — ${app.MODULE_IDS.length} modules, ${navItems} sidebar entries, first view rendered.`);
} catch (err) {
  fail('import', err);
}

process.exit(failed ? 1 : 0);

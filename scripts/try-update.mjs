// try-update.mjs — updating an installed copy, with a real service worker (§13fu).
//
// Every other browser check REMOVES the service worker, because it reloads the
// page under them. So nothing in the suite had ever installed, updated or
// served the application from its worker — which is the only way a customer
// ever runs it after the first day.
//
// THE SERVER. One origin, one port, and a switch: it serves the tree as release
// A or release B. The two differ only in a label written into five files on the
// way out — version.js, the worker's cache name, ui.js, db.js and the seed
// manifest — so any page can be asked „which release is each of your files
// from?" and a mixed page answers with two labels. The server can also fail
// one file (404, or the connection dropped mid-request) and go offline
// altogether (every connection dropped). Files are sent with a five-minute
// HTTP cache lifetime, as a static host might, so a worker that read through
// the HTTP cache would be caught too.
//
// THE MATRIX (§13fu):
//   U1 fresh install → controlled, no reload on first install → offline launch
//   U2 A installed with her work → B deployed → found → still A until pressed →
//      pressed → B everywhere, her work unchanged
//   U3 B's install fails on one file → A goes on, online and offline
//   U4 B deployed, one file of B fails while A's page reloads → the page is A,
//      whole — the P0: rc119 booted half A, half B
//   U5 A offline for a while → works → online again → B found, not forced
//   U6 an unrepaired record written by A → update to B → the start repairs it
//   U7a three clean windows of A → one presses Update → all three are B
//   U7b two windows, one with unsaved work → Update is REFUSED: B stays
//       waiting, A stays active with its cache, both windows stay A, the work
//       stays, the asker is told; after a save, Update goes through (§13fv)
//   U7c the same with a B that raises DB_VERSION: while B waits, a new window
//       is still A and the database is not upgraded; after the save, all B
//   U7d a window that does not answer blocks the update like a dirty one
//
// Run on its own:  node scripts/try-update.mjs [--release]

import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// BAGRA_ROOT serves another tree — the release gate points it at `dist/`, so the
// update matrix runs against the artifact that ships, not the repository (§13fx).
const ROOT = process.env.BAGRA_ROOT
  ? path.resolve(process.env.BAGRA_ROOT)
  : path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

const CHROME = (process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'])
  .find(p => fs.existsSync(p));
const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
if (!CHROME) {
  if (RELEASE) { console.log('FAIL update: no chromium, and this is a release run'); process.exit(1); }
  console.log('update check skipped (no chromium found)');
  process.exit(0);
}

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is = (got, want, m) => JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

// ------------------------------------------------------------------ server

const server = { release: 'A', down: false, fail: null, failHow: '404', bumpDb: false, requests: [] };
const VERSION = fs.readFileSync('version.js', 'utf8').match(/VERSION = '([^']+)'/)[1];
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.css': 'text/css' };

function body(rel) {
  const label = `${VERSION}-${server.release}`;
  let buf = fs.readFileSync(rel);
  if (rel === 'version.js') buf = Buffer.from(String(buf).replace(`VERSION = '${VERSION}'`, `VERSION = '${label}'`));
  else if (rel === 'sw.js') buf = Buffer.from(String(buf).replace(`bagra-v${VERSION}'`, `bagra-v${label}'`));
  if (rel === 'db.js' && server.bumpDb && server.release === 'B') {
    const src = String(buf);
    if (!/export const DB_VERSION = 10;/.test(src)) throw new Error('db.js no longer says DB_VERSION = 10 — update the U7c transformation');
    buf = Buffer.from(src.replace('export const DB_VERSION = 10;', 'export const DB_VERSION = 11;'));
  }
  if (rel === 'ui.js' || rel === 'db.js') buf = Buffer.concat([buf, Buffer.from(`\nexport const __BUILD = '${label}';\n`)]);
  else if (rel === 'seed/manifest.json') { const m = JSON.parse(buf); m.build = label; buf = Buffer.from(JSON.stringify(m)); }
  return buf;
}

// The production headers, applied as the host would (§13ga): every block of
// deploy/_headers (dist/_headers) whose path matches. Cache-Control alone is
// NOT taken from it — this server keeps its five-minute lifetime on purpose,
// so a worker that read through the HTTP cache would still be caught. Everything
// else (the CSP above all) is production's, so U1–U7 run under it.
const HEADER_RULES = [];
if (fs.existsSync('_headers')) {
  let cur = null;
  for (const line of fs.readFileSync('_headers', 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { path: line.trim(), headers: {} }; HEADER_RULES.push(cur); continue; }
    const i = line.indexOf(':');
    if (cur && i > 0) cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
const productionHeaders = (urlPath) => Object.assign({}, ...HEADER_RULES
  .filter(r => r.path === urlPath || (r.path.endsWith('*') && urlPath.startsWith(r.path.slice(0, -1))))
  .map(r => r.headers));

const srv = http.createServer((req, res) => {
  if (server.down) { req.socket.destroy(); return; }
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  server.requests.push(rel);
  if (server.fail && rel === server.fail) {
    if (server.failHow === 'drop') { req.socket.destroy(); return; }
    res.writeHead(404); res.end('gone'); return;
  }
  if (rel.includes('..') || !fs.existsSync(rel) || fs.statSync(rel).isDirectory()) { res.writeHead(404); res.end(); return; }
  const prod = productionHeaders('/' + rel);
  delete prod['Cache-Control'];
  res.writeHead(200, { ...prod, 'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream',
    'Cache-Control': rel === 'sw.js' ? 'no-cache' : 'max-age=300' });
  res.end(body(rel));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

// ------------------------------------------------------------------ helpers

const launch = () => puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage',
  // A window that is not in front is frozen by headless Chrome and would never
  // answer the worker's question. A desktop browser delivers it; these make the
  // headless one do the same, so „silent" is tested on purpose (U7d), not by accident.
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const serve = (release, extra = {}) => Object.assign(server, { release, down: false, fail: null, failHow: '404', bumpDb: false }, extra);

async function openPage(browser, errors) {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  // A Content-Security-Policy refusal is reported on the console, not thrown;
  // under the production headers it is a failure like any other (§13ga).
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) errors.push('CSP: ' + m.text()); });
  page.on('dialog', d => d.accept().catch(() => {}));
  return page;
}
const booted = (page) => page.waitForFunction(() => (document.querySelector('#view')?.textContent || '').length > 50,
  { timeout: 60000 });
const controlled = (page) => page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 60000 });
async function go(page) { await page.goto(BASE, { waitUntil: 'load', timeout: 60000 }); await booted(page); }
async function reload(page) { await page.reload({ waitUntil: 'load', timeout: 60000 }); await booted(page); }

// Which release each of the page's files came from, as the page itself holds
// them. Asked of the modules ALREADY loaded — a dynamic import of a loaded
// module returns that instance — and of the seed manifest through the worker.
const labels = (page) => page.evaluate(async () => {
  const v = (await import('./version.js')).VERSION;
  const ui = (await import('./ui.js')).__BUILD;
  const db = (await import('./db.js')).__BUILD;
  let seed = null;
  try { seed = (await (await fetch('seed/manifest.json')).json()).build; } catch { seed = 'unreachable'; }
  return [...new Set([v, ui, db, seed])];
});
const one = (release) => [`${VERSION}-${release}`];

const checkUpdate = (page) => page.evaluate(() => window.bagraCheckUpdate?.());
const bar = (page) => page.waitForSelector('#updatebar', { timeout: 60000 });
const noBar = async (page) => !(await page.$('#updatebar'));
// The worker's own account of an install that failed: an installing worker
// that became redundant, and nothing waiting.
const installOutcome = (page) => page.evaluate(() => new Promise(async (resolve) => {
  const reg = await navigator.serviceWorker.getRegistration();
  const watch = (w) => w.addEventListener('statechange', () => {
    if (w.state === 'redundant') resolve('redundant');
    if (w.state === 'installed') resolve('installed');
  });
  if (reg.installing) watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));
  if (reg.waiting) resolve('installed');
  reg.update().catch(() => resolve('update-failed'));
}));

const writeTrial = (page, id, extra = {}) => page.evaluate(async (id, extra) => {
  const db = await import('./db.js');
  await db.put('trials', db.newRecord({ id, title: 'от ' + id, date: '2026-09-01', steps: [], placements: [], ...extra }));
}, id, extra);
const readTrial = (page, id) => page.evaluate(async (id) => (await import('./db.js')).get('trials', id), id);

async function scenario(name, fn) {
  if (process.env.ONLY && !name.startsWith(process.env.ONLY)) return;
  console.log('\n' + name);
  const browser = await launch();
  const errors = [];
  try { await fn(browser, errors); }
  catch (e) { fail(`${name} stopped: ${e?.message || e}`); }
  finally {
    if (errors.length) fail(`${name}: page error — ${errors[0]}`);
    await browser.close();
  }
}

// ------------------------------------------------------------------ U1–U7

await scenario('U1 fresh install → offline launch', async (browser, errors) => {
  serve('A');
  const page = await openPage(browser, errors);
  let navigations = 0;
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
  await go(page);
  await controlled(page);
  await writeTrial(page, 'u1-work');
  is(navigations, 1, 'the first install does not reload the page');
  await reload(page);
  serve('A', { down: true });
  await reload(page);
  is(await labels(page), one('A'), 'offline, the installed release boots, every file from it');
  is((await readTrial(page, 'u1-work'))?.title, 'от u1-work', 'and her work is there');

  // Every route the navigation offers, and a plant showing a photograph of her
  // own (a data: URL) — opened under the production headers, so a policy that
  // refuses something the application does is a console report and a FAIL here
  // (§13ga). Offline still: the installed release, as a customer runs it.
  await page.evaluate(async () => {
    const db = await import('./db.js');
    const p = (await db.all('plants'))[0];
    const c = document.createElement('canvas'); c.width = c.height = 4;
    await db.putRaw('plants', { ...p, photoData: c.toDataURL('image/png') });
    window.__plantWithPhoto = p.id;
  });
  // The navigation is buttons carrying `data-go` (app.js: `#/` + its value).
  const routes = await page.$$eval('[data-go]', bs => [...new Set(bs.map(b => '#/' + b.dataset.go))]);
  const plantId = await page.evaluate(() => window.__plantWithPhoto);
  for (const r of [...routes, '#/tools/backup', `#/plants/${plantId}`]) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await booted(page);
  }
  is(routes.length > 5, true, `${routes.length} routes from the navigation opened, and a plant with a photograph of hers`);
  const shown = await page.waitForFunction(() => [...document.images]
    .some(i => i.src.startsWith('data:') && i.complete && i.naturalWidth > 0), { timeout: 30000 }).then(() => true, () => false);
  is(shown, true, 'her data: photograph is displayed under the policy');
});

await scenario('U2 A → B, found, held, then taken', async (browser, errors) => {
  serve('A');
  const page = await openPage(browser, errors);
  await go(page); await controlled(page); await reload(page);
  await writeTrial(page, 'u2-work');
  const before = await readTrial(page, 'u2-work');
  serve('B');
  await checkUpdate(page);
  await bar(page);
  ok('the new release is found and announced');
  is(await labels(page), one('A'), 'the open page is still A');
  await reload(page);
  is(await labels(page), one('A'), 'a reload before pressing is still A — nothing arrives unasked');
  await bar(page);
  ok('and the announcement is still there after the reload');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('[data-doupdate]')]);
  await booted(page);
  is(await labels(page), one('B'), 'after „Update\" every file is B');
  is(await page.evaluate(async () => (await import('./version.js')).VERSION), `${VERSION}-B`, 'and the version reported is B\'s');
  is(JSON.stringify(await readTrial(page, 'u2-work')), JSON.stringify(before), 'her work is unchanged, timestamps included');
  const caches = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('bagra-')));
  is(caches, [`bagra-v${VERSION}-B`], 'and A\'s cache is gone');
});

await scenario('U3 an update that fails on one file', async (browser, errors) => {
  serve('A');
  const page = await openPage(browser, errors);
  await go(page); await controlled(page); await reload(page);
  for (const [file, how] of [['ui.js', '404'], ['seed/images/plants/urtica_dioica.jpg', 'drop']]) {
    serve('B', { fail: file, failHow: how });
    const outcome = await installOutcome(page);
    is(outcome === 'redundant' || outcome === 'update-failed', true, `B's install is abandoned when ${file} fails (${how}) — ${outcome}`);
    is(await noBar(page), true, 'nothing is announced');
    await reload(page);
    is(await labels(page), one('A'), 'the page is still A, whole');
  }
  const names = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('bagra-')));
  is(names.includes(`bagra-v${VERSION}-A`), true, 'A\'s cache is intact');
  serve('A', { down: true });
  await reload(page);
  is(await labels(page), one('A'), 'and offline it boots A');
});

await scenario('U4 a new release on the server, and one of its files fails', async (browser, errors) => {
  serve('A');
  const page = await openPage(browser, errors);
  await go(page); await controlled(page); await reload(page);
  // B is deployed; before any update check, the page is reloaded over a network
  // that drops one module. rc119 took every other file from the server (B) and
  // that one from its cache (A).
  serve('B', { fail: 'ui.js', failHow: 'drop' });
  await reload(page);
  is(await labels(page), one('A'), 'the page is one release — the installed one');
});

await scenario('U5 offline for a while, then online', async (browser, errors) => {
  serve('A');
  const page = await openPage(browser, errors);
  await go(page); await controlled(page); await reload(page);
  serve('B', { down: true });
  await reload(page);
  is(await labels(page), one('A'), 'offline, A works');
  await writeTrial(page, 'u5-offline');
  await checkUpdate(page);
  is(await noBar(page), true, 'an update check offline changes nothing');
  serve('B');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await bar(page);
  ok('back online, B is found');
  is(await labels(page), one('A'), 'and the session is not interrupted — still A');
  is((await readTrial(page, 'u5-offline'))?.title, 'от u5-offline', 'the work written offline is there');
});

await scenario('U6 an update over data that needs a repair', async (browser, errors) => {
  serve('A');
  const page = await openPage(browser, errors);
  await go(page); await controlled(page); await reload(page);
  // A record in the shape before the eco-print bundle (§13fl), and the marker
  // that says the repair is still to run — what an older release leaves behind.
  await page.evaluate(async () => {
    const db = await import('./db.js');
    await db.putRaw('trials', { id: 'u6-eco', origin: 'user', processCode: 'ecoprint', title: 'стар',
      steps: [{ id: 's1', typeCode: 'lay_base', roleCode: 'print', what: 'коприна' }], placements: [],
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' });
    const m = await db.getSetting('migrations', {});
    delete m.ecoprintBundleLayers;
    await db.setSetting('migrations', m);
  });
  serve('B');
  await checkUpdate(page); await bar(page);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('[data-doupdate]')]);
  await booted(page);
  await page.waitForFunction(async () => ((await (await import('./db.js')).getSetting('migrations', {})) || {}).ecoprintBundleLayers >= 1,
    { timeout: 60000, polling: 100 });
  is(await labels(page), one('B'), 'the start after the update is B');
  const tr = await readTrial(page, 'u6-eco');
  is([tr?.bundle?.layers?.length, tr?.updatedAt], [1, '2025-01-01T00:00:00.000Z'],
     'the repair ran on B\'s start, and the record was not restamped');
});

const cacheNames = (page) => page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('bagra-')).sort());
const regState = (page) => page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return { waiting: !!r.waiting, active: r.active?.state };
});
const barText = (page) => page.$eval('#updatebar', el => el.textContent).catch(() => '');
const navCount = (page) => { const n = { v: 0 }; page.on('framenavigated', f => { if (f === page.mainFrame()) n.v++; }); return n; };
// Press Update and expect a refusal: the bar's words change and nothing navigates.
async function pressRefused(page, pattern) {
  await page.bringToFront();
  await page.click('[data-doupdate]');
  await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#updatebar')?.textContent || ''),
    { timeout: 30000, polling: 100 }, pattern.source);
}
async function pressTaken(page) {
  await page.bringToFront();
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.click('[data-doupdate]')]);
  await booted(page);
}
const becomes = (page, release) => page.waitForFunction(async (r) => {
  try { return (await import('./version.js')).VERSION.endsWith('-' + r); } catch { return false; }
}, { timeout: 60000, polling: 200 }, release);
async function windows(browser, errors, n) {
  const pages = [];
  for (let i = 0; i < n; i++) {
    const p = await openPage(browser, errors);
    await go(p); await controlled(p);
    if (i === 0) await reload(p);
    pages.push(p);
  }
  return pages;
}

await scenario('U7a three clean windows', async (browser, errors) => {
  serve('A');
  const [a, b, c] = await windows(browser, errors, 3);
  serve('B');
  await a.bringToFront();
  await checkUpdate(a); await bar(a);
  await pressTaken(a);
  await becomes(b, 'B'); await becomes(c, 'B');
  for (const [name, p] of [['a', a], ['b', b], ['c', c]]) {
    await p.bringToFront(); await booted(p);
    is(await labels(p), one('B'), `window ${name} is B, whole`);
  }
  is(await cacheNames(a), [`bagra-v${VERSION}-B`], 'one cache: B');
});

await scenario('U7b a second window with unsaved work', async (browser, errors) => {
  serve('A');
  const [a, b] = await windows(browser, errors, 2);
  await writeTrial(a, 'u7b-work');
  await b.evaluate(async () => (await import('./dirty.js')).markDirty());
  const aNav = navCount(a), bNav = navCount(b);
  serve('B');
  await a.bringToFront();
  await checkUpdate(a); await bar(a);
  await pressRefused(a, /незаписани|unsaved/);
  ok('the window that pressed is told another window holds unsaved work');
  is(await regState(a), { waiting: true, active: 'activated' }, 'B is still WAITING; A\'s worker is still the active one');
  is(await cacheNames(a), [`bagra-v${VERSION}-A`, `bagra-v${VERSION}-B`], 'A\'s cache is intact beside B\'s');
  is([aNav.v, bNav.v], [0, 0], 'neither window navigated');
  is(await labels(a), one('A'), 'window a is A, whole');
  await b.bringToFront();
  is(await labels(b), one('A'), 'window b is A, whole — and its requests are still answered from A');
  is(await b.evaluate(async () => (await import('./dirty.js')).isDirty()), true, 'b keeps its unsaved work');
  // She saves in b; a presses again.
  await b.evaluate(async () => (await import('./dirty.js')).markClean());
  await pressTaken(a);
  await becomes(b, 'B');
  await b.bringToFront(); await booted(b);
  is([await labels(a), await labels(b)], [one('B'), one('B')], 'after the save, Update goes through and both windows are B');
  is((await readTrial(a, 'u7b-work'))?.title, 'от u7b-work', 'her work is there');
  is(await cacheNames(a), [`bagra-v${VERSION}-B`], 'and only now is A\'s cache gone');
});

await scenario('U7c a waiting release that raises DB_VERSION', async (browser, errors) => {
  serve('A');
  const [a, b] = await windows(browser, errors, 2);
  await writeTrial(a, 'u7c-work');
  const dbv = (p) => p.evaluate(async () => (await (await import('./db.js')).open()).version);
  is(await dbv(a), 10, 'the database is at 10 under A');
  await b.evaluate(async () => (await import('./dirty.js')).markDirty());
  serve('B', { bumpDb: true });
  await a.bringToFront();
  await checkUpdate(a); await bar(a);
  await pressRefused(a, /незаписани|unsaved/);
  // A window opened while B waits is served by A's worker: the old release,
  // at the old database version — no schema upgrade can start.
  const d = await openPage(browser, errors);
  await go(d);
  is(await labels(d), one('A'), 'a window opened while B waits is A');
  is(await dbv(d), 10, 'and the database is not upgraded');
  await b.bringToFront();
  is(await b.evaluate(async () => (await import('./dirty.js')).isDirty()), true, 'the dirty window keeps its work');
  await b.evaluate(async () => (await import('./db.js')).put('trials',
    (await import('./db.js')).newRecord({ id: 'u7c-saved', title: 'записано в b', steps: [], placements: [] })));
  ok('and can still save it — the database is still the one its code opened');
  await b.evaluate(async () => (await import('./dirty.js')).markClean());
  await pressTaken(a);
  for (const p of [b, d]) { await becomes(p, 'B'); }
  is(await dbv(a), 11, 'after the update the database is at 11');
  is([(await readTrial(a, 'u7c-work'))?.title, (await readTrial(a, 'u7c-saved'))?.title],
     ['от u7c-work', 'записано в b'], 'with both records — the one from before and the one b saved while waiting');
});

await scenario('U7d a window that does not answer', async (browser, errors) => {
  serve('A');
  const [a, b] = await windows(browser, errors, 2);
  // b stops hearing the worker's question — as a frozen window, or one running
  // a release that does not know it, would.
  await b.evaluate(() => { MessagePort.prototype.postMessage = function () {}; });
  serve('B');
  await a.bringToFront();
  await checkUpdate(a); await bar(a);
  await pressRefused(a, /не отговаря|not answering/);
  ok('silence is not taken for consent — the update is refused, and says why');
  is(await regState(a), { waiting: true, active: 'activated' }, 'B is still waiting');
  await b.close();
  await pressTaken(a);
  is(await labels(a), one('B'), 'once the silent window is closed, Update goes through');
});

srv.close();
if (HEADER_RULES.length) ok(`ran under the production headers from _headers (${HEADER_RULES.length} rule(s), CSP ${HEADER_RULES.some(r => r.headers['Content-Security-Policy']) ? 'on' : 'off'})`);
console.log(failed ? '\nupdate check FAILED' : '\nupdate check passed');
process.exit(failed ? 1 : 0);

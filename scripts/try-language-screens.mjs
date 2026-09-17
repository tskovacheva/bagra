// try-language-screens.mjs — no Bulgarian on the English screen (§13eh).
//
// try-language.mjs reads the files. It cannot see what the screen assembles: a
// unit written into a template, a fallback from an empty English field to the
// Bulgarian one (`text()` in i18n.js does exactly that, by design), a label built
// from a code. This switches the application to English in a real browser, opens
// every screen and every shipped library record, and collects each line of text —
// and each placeholder, title and aria-label — that contains a Cyrillic letter.
//
// Same ratchet as the file check: test/language/known-screen-text.json lists the
// lines known today. A line not on it fails; a listed line no longer seen fails;
// --strict fails on the list itself; --write-known rewrites it.
//
// KNOWN BY TEXT, NOT BY PLACE. A line is listed once however many screens draw
// it. So translating „горчично" on one record does not cross it off while another
// record still says „горчично" — the screen still shows the word, and that is
// true. The per-record account is try-language.mjs's `seed.untranslated`, which
// names every field and did fail when one was filled and not crossed off.
//
// Her own records are left out on purpose. A cloth she named in Bulgarian is hers
// and stays Bulgarian in either language. The diary screens are opened with
// English-only fixtures, so what Cyrillic remains on them is the interface's.

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const ARGS = new Set(process.argv.slice(2));
const RELEASE_RUN = ARGS.has('--release') || !!process.env.BAGRA_RELEASE;
// Strict on a release run from rc72, when the known list became empty (§13em).
const STRICT = ARGS.has('--strict') || RELEASE_RUN;
const RELEASE = ARGS.has('--release') || !!process.env.BAGRA_RELEASE;
const KNOWN_FILE = 'test/language/known-screen-text.json';

const CHROME = (process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium',
     '/usr/bin/chromium-browser', '/usr/bin/google-chrome']).find(p => fs.existsSync(p));
if (!CHROME) {
  if (RELEASE) { console.log('FAIL language screens: no chromium, and this is a release run'); process.exit(1); }
  console.log('language screens skipped (no chromium found)');
  process.exit(0);
}

const PORT = 8753;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);
await new Promise(r => setTimeout(r, 900));

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.setViewport({ width: 1280, height: 900 });

const booted = () => page.waitForFunction(() => document.querySelector('#view')?.textContent?.length > 50, { timeout: 30000 });
const settle = () => page.evaluate(() => new Promise(res => {
  let last = -1, stable = 0, n = 0;
  const tick = () => {
    const now = document.body.innerHTML.length;
    if (now === last) stable++; else { stable = 0; last = now; }
    if (stable >= 3 || ++n > 120) return res();
    setTimeout(tick, 25);
  };
  tick();
}));

let failed = false;
const fail = (m) => { failed = true; console.log('FAIL ' + m); };

await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
await booted();
await page.evaluate(async () => {
  const i18n = await import('./i18n.js');
  await i18n.setLang('en');
  const db = await import('./db.js');
  // English-only fixtures, so a diary screen has rows to draw.
  await db.put('fabrics', db.newRecord({ id: 'fixture:fabric', label: 'F-001', name: 'linen test piece',
    composition: [{ fibreCode: 'linen', percent: 100 }], weightG: 120, actions: [] }));
  await db.put('trials', db.newRecord({ id: 'fixture:trial', status: 'planned', title: 'test work',
    intent: 'oak on linen', date: '2026-09-01', processCode: 'immersion', placements: [], steps: [], resultPhotos: [] }));
});
await page.reload({ waitUntil: 'networkidle0' });
await booted();
const lang = await page.evaluate(async () => (await import('./i18n.js')).getLang());
if (lang !== 'en') fail(`the language did not switch: ${lang}`);

const ids = await page.evaluate(async () => {
  const seed = await import('./seed.js');
  const out = {};
  for (const [name, p] of Object.entries(seed.PACKS)) {
    const pack = await (await fetch(p.file)).json();
    out[name] = pack[p.listKey].map(r => 'seed:' + r.code);
  }
  return out;
});

const ROUTES = ['#/dashboard', '#/reference', '#/reference/records', '#/plants', '#/recipes', '#/recipes/chains',
  '#/substances', '#/techniques', '#/tools', '#/tools/backup', '#/library', '#/library/ph', '#/library/sources',
  '#/library/glossary', '#/about', '#/about/help', '#/about/safety', '#/about/legal',
  '#/fabrics', '#/fabrics/fixture:fabric', '#/trials', '#/trials/new', '#/trials/fixture:trial',
  '#/pigments', '#/pigments/new', '#/batch',
  ...ids.plants.map(i => `#/plants/${i}`),
  ...ids.combinations.map(i => `#/reference/${i}`),
  ...ids.substances.map(i => `#/substances/${i}`),
  ...ids.techniques.map(i => `#/techniques/${i}`),
  ...ids.recipes.map(i => `#/recipes/${i}`)];

const seen = new Map();   // line -> first route
let fellBack = 0;
for (const route of ROUTES) {
  const before = errors.length;
  await page.evaluate(r => { location.hash = '#/blank'; location.hash = r; }, route);
  await settle();
  if (errors.length > before) { fail(`${route}: ${errors[before]}`); continue; }
  const landed = await page.evaluate(() => location.hash);
  // A tab that is not an address falls back quietly; that is a fault in this list,
  // not in the screen, and it is reported so the list cannot lie about coverage.
  if (landed !== route && !route.endsWith('/new') && route !== '#/library/glossary') { fail(`${route} fell back to ${landed}`); fellBack++; continue; }
  const lines = await page.evaluate(() => {
    const cy = /[\u0400-\u04FF]/;
    const out = [];
    for (const l of document.body.innerText.split('\n')) if (cy.test(l)) out.push(l.trim());
    for (const el of document.querySelectorAll('[placeholder],[title],[aria-label]')) {
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = el.getAttribute(a);
        if (v && cy.test(v)) out.push(`@${a}: ${v.trim()}`);
      }
    }
    return out;
  });
  for (const l of lines) {
    const id = l.replace(/\s+/g, ' ').slice(0, 140);
    if (!seen.has(id)) seen.set(id, route);
  }
}

if (ARGS.has('--write-known')) {
  fs.writeFileSync(KNOWN_FILE, JSON.stringify({
    note: 'Lines of Bulgarian seen on the ENGLISH screen at the time of writing, with the first screen each was seen on. Crossed off as they are fixed; 1.0 ships with this list empty (--strict).',
    lines: Object.fromEntries([...seen].sort()),
  }, null, 1) + '\n');
  console.log(`known screen text written: ${seen.size} lines over ${ROUTES.length} screens`);
  await browser.close(); stop(); process.exit(0);
}

const known = fs.existsSync(KNOWN_FILE) ? JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')).lines : {};
let fresh = 0;
for (const [line, route] of seen) {
  if (line in known) { if (STRICT) fail(`${route}: ${line}`); }
  else { fresh++; fail(`NEW Bulgarian on the English screen, ${route}: ${line}`); }
}
for (const line of Object.keys(known)) if (!seen.has(line)) fail(`no longer on screen — cross it off ${KNOWN_FILE}: ${line}`);

console.log(`  language screens: ${ROUTES.length} screens in English, ${seen.size} Bulgarian lines (${Object.keys(known).length} known${fresh ? ', ' + fresh + ' NEW' : ''})`);
await browser.close();
stop();
if (failed) { console.log('language screens FAILED'); process.exitCode = 1; }
else console.log('language screens passed');

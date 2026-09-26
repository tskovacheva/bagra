// try-restore-older.mjs — a backup written by an OLDER version, opened by this one
// (ROADMAP A7 item 2, §11.5).
//
// try-backup-restore.mjs proves a round trip inside one version. It cannot see
// the case a person actually meets: she backs up on the version she has, the
// application updates, and months later she restores that file on a new phone.
//
// THE FIXTURES ARE NOT WRITTEN BY HAND. Each file in test/older-backups/ was
// produced by checking that version out of git, running ITS OWN deep-check (which
// drives its own screens and its own db layer), and exporting with ITS OWN
// exportAll(). A fixture shaped from memory of what an old record looked like
// would test the memory. The three versions are chosen at the migration seams:
//
//   rc6   before any migration marker existed; no glossary or pigment store;
//         plant records still carried their photographs
//   rc45  markers for the first three repairs only
//   rc56  every repair except the recipe source list
//
// For each file, in a fresh browser profile: boot this version, restore the
// file as a snapshot, RELOAD (so the real start sequence runs over it — packs,
// then migrations), and ask:
//
//   1. no page error at any point
//   2. every record of her work in the file is still there, by id
//   3. the library is whole — every shipped record present after the start
//   4. every repair is marked as run, and its effect is visible on the data
//   5. every screen, and every one of her records, opens
//
// And it reports — without failing — how many library records came back from
// the file older than the pack, per pack. That number is the honest answer to
// „what does she get after restoring an old file", and whether it should be
// zero is a decision recorded in DOCUMENTATION_DECISIONS_NEEDED.md, not here.

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';

const CHROME = (process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium',
     '/usr/bin/chromium-browser', '/usr/bin/google-chrome']).find(p => fs.existsSync(p));
const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
if (!CHROME) {
  if (RELEASE) { console.log('FAIL older restore: no chromium, and this is a release run'); process.exit(1); }
  console.log('older-backup restore skipped (no chromium found)');
  process.exit(0);
}

const DIR = 'test/older-backups';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort();
if (!files.length) { console.log('FAIL older restore: no fixtures in ' + DIR); process.exit(1); }

// The stores that hold HER work. Everything else is library or regenerated.
const WORK = ['fabrics', 'trials', 'stock', 'chains', 'batchActions', 'photos', 'pigmentBatches'];

let failed = false;
const fail = (what, why) => { failed = true; console.log(`FAIL ${what}: ${why}`); };

const PORT = 8751;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch {} });
await new Promise(r => setTimeout(r, 900));

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const BASE = `http://localhost:${PORT}/index.html`;

const booted = (page) => page.waitForFunction(
  () => document.querySelector('#view')?.textContent?.length > 50, { timeout: 30000 });

async function settle(page) {
  await page.evaluate(() => new Promise(res => {
    let last = -1, stable = 0, n = 0;
    const tick = () => {
      const now = document.querySelector('#view')?.innerHTML.length ?? 0;
      if (now === last) stable++; else { stable = 0; last = now; }
      if (stable >= 3 || ++n > 120) return res();
      setTimeout(tick, 25);
    };
    tick();
  }));
}

// A code that resolves to no word is printed as its translation key —
// `t()` hands the key back rather than failing. A restored OLD record is exactly
// how a code the current vocabulary no longer knows gets into the database, and
// the shipped-data check in deep-check cannot see it: it reads the files.
// Prefixes are read from the dictionary itself, so the pattern cannot drift.
const PREFIXES = [...new Set([...fs.readFileSync('i18n.js', 'utf8')
  .matchAll(/^\s*'([a-zA-Z]+)\.[a-zA-Z0-9_.]+'\s*:/gm)].map(m => m[1]))];
const KEY_RE = new RegExp(`\\b(?:${PREFIXES.join('|')})\\.[a-zA-Z_]+\\.[a-zA-Z0-9_]+\\b`);

const VIEWS = ['#/dashboard', '#/reference', '#/reference/records', '#/plants', '#/recipes',
  '#/recipes/chains', '#/substances', '#/techniques', '#/tools', '#/tools/backup',
  '#/library', '#/library/ph', '#/library/sources', '#/about', '#/fabrics', '#/trials',
  '#/pigments', '#/batch'];

for (const file of files) {
  const label = file.replace('.json.gz', '');
  const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${DIR}/${file}`)).toString('utf8'));
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const t0 = errors.length;

  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await booted(page);

    const report = await page.evaluate(async (p) => {
      const b = await import('./backup.js');
      return b.importBackup(p, 'replace');
    }, payload);

    // The restore screen reloads (modules/tools.js). So does this.
    await page.reload({ waitUntil: 'networkidle0' });
    await booted(page);
    await settle(page);
    if (errors.length > t0) { fail(`${label} boot after restore`, errors[t0]); continue; }

    const state = await page.evaluate(async (WORK) => {
      const db = await import('./db.js');
      const seed = await import('./seed.js');
      const counts = {}, ids = {};
      for (const s of Object.keys(db.STORES)) {
        const rows = await db.all(s);
        counts[s] = rows.length;
        ids[s] = rows.map(r => r[db.STORES[s].keyPath]);
      }
      const shipped = {};
      const stale = {};
      for (const name of Object.keys(seed.PACKS)) {
        const pk = seed.PACKS[name];
        const pack = await (await fetch(pk.file)).json();
        shipped[name] = { store: pk.store, ids: pack[pk.listKey].map(r => 'seed:' + r.code) };
        const d = await seed.diffPack(name);
        stale[name] = { changed: d.changed.length, edited: d.edited.length, withdrawn: d.withdrawn.length };
      }
      const markers = await db.getSetting('migrations', null);
      const recipes = await db.all('recipes');
      return { counts, ids, shipped, stale, markers, recipes,
               unreachable: seed.UNREACHABLE_PACKS, language: await db.getSetting('language', null) };
    }, WORK);

    // 2. her work, by id
    let lost = 0;
    for (const s of WORK) {
      const inFile = (payload.data[s] || []).map(r => r.id);
      const missing = inFile.filter(id => !state.ids[s]?.includes(id));
      if (missing.length) { lost += missing.length; fail(`${label} ${s}`, `${missing.length} record(s) of her work gone after restore: ${missing.slice(0, 3).join(', ')}`); }
    }
    const userRecipes = (payload.data.recipes || []).filter(r => !String(r.id).startsWith('seed:'));
    const goneRecipes = userRecipes.filter(r => !state.ids.recipes.includes(r.id));
    if (goneRecipes.length) fail(`${label} recipes`, `${goneRecipes.length} of her own recipe(s) gone`);
    const workN = WORK.reduce((n, s) => n + (payload.data[s]?.length || 0), 0) + userRecipes.length;

    // 3. library whole
    for (const [name, { store, ids }] of Object.entries(state.shipped)) {
      const missing = ids.filter(id => !state.ids[store].includes(id));
      if (missing.length) fail(`${label} library ${name}`, `${missing.length} shipped record(s) absent after start: ${missing.slice(0, 3).join(', ')}`);
    }

    // 4. repairs
    const expected = ['doubleStateEvents', 'fabricActions', 'plantPhotos', 'recipeTempRange',
      'pigmentBatchLines', 'pigmentSwatchList', 'pigmentProcessNotes', 'recipeSourceList'];
    const unmarked = expected.filter(k => !(state.markers?.[k] >= 1));
    if (unmarked.length) fail(`${label} migrations`, `not marked as run: ${unmarked.join(', ')}`);
    const noList = state.recipes.filter(r => r.sourceCode && !Array.isArray(r.sourceCodes));
    if (noList.length) fail(`${label} recipeSourceList`, `${noList.length} recipe(s) still have only the string: ${noList[0].id}`);
    const noRange = state.recipes.filter(r => r.tempC != null && r.tempMinC == null && r.tempMaxC == null);
    if (noRange.length) fail(`${label} recipeTempRange`, `${noRange.length} recipe(s) with tempC and no range: ${noRange[0].id}`);
    // A cloth that carries the OLD list and not the new one is a cloth the
    // repair never reached. A cloth with neither has nothing to repair — the
    // readers take an absent list as empty — and asking for an empty list on it
    // failed a harmless record the rc45 harness had written directly.
    const unmigrated = (await page.evaluate(async () =>
      (await (await import('./db.js')).all('fabrics'))
        .filter(f => (f.stateEvents || []).length && !Array.isArray(f.actions)).map(f => f.id)));
    if (unmigrated.length) fail(`${label} fabricActions`, `${unmigrated.length} cloth still on stateEvents with no actions: ${unmigrated[0]}`);

    // 5. screens, and each of her records
    const routes = [...VIEWS,
      ...(payload.data.fabrics || []).map(r => `#/fabrics/${r.id}`),
      ...(payload.data.trials || []).map(r => `#/trials/${r.id}`),
      ...userRecipes.map(r => `#/recipes/${r.id}`),
      ...(payload.data.pigmentBatches || []).map(r => `#/pigments/${r.id}`),
      // And every library record the FILE carried: these are the ones that come
      // back older than the pack, and an old record naming a code the present
      // vocabulary no longer has is where a raw key reaches the screen.
      ...(payload.data.plants || []).map(r => `#/plants/${r.id}`),
      ...(payload.data.combinations || []).map(r => `#/reference/${r.id}`),
      ...(payload.data.substances || []).map(r => `#/substances/${r.id}`),
      ...(payload.data.techniques || []).map(r => `#/techniques/${r.id}`),
      ...(payload.data.recipes || []).filter(r => String(r.id).startsWith('seed:')).map(r => `#/recipes/${r.id}`)];
    let opened = 0;
    const rawKeys = {};
    for (const route of routes) {
      const before = errors.length;
      await page.evaluate((r) => { location.hash = '#/blank'; location.hash = r; }, route);
      await settle(page);
      const text = await page.evaluate(() => document.querySelector('#view')?.textContent?.trim().length || 0);
      const raw = await page.evaluate((src) =>
        (document.querySelector('#view')?.innerText || '').match(new RegExp(src))?.[0] || null, KEY_RE.source);
      // An address that names no record falls back to the list and still draws
      // a full screen — so a record missing after restore would count as opened.
      const landed = await page.evaluate(() => location.hash);
      if (errors.length > before) fail(`${label} ${route}`, errors[before]);
      else if (landed !== route) fail(`${label} ${route}`, `fell back to ${landed} — the record is not there`);
      else if (text < 10) fail(`${label} ${route}`, 'rendered nothing');
      else if (raw) { (rawKeys[raw] ||= []).push(route); }
      else opened++;
    }

    for (const [key, where] of Object.entries(rawKeys))
      fail(`${label} raw key`, `${key} printed where a word belongs, on ${where.length} screen(s): ${where.slice(0, 3).join(', ')}`);

    const staleLine = Object.entries(state.stale)
      .filter(([, v]) => v.changed || v.edited || v.withdrawn)
      .map(([k, v]) => `${k} ${v.changed + v.edited}${v.withdrawn ? `+${v.withdrawn} withdrawn` : ''}${state.unreachable.includes(k) ? ' (no update button)' : ''}`)
      .join(', ');

    if (!lost && !goneRecipes.length) {
      console.log(`  ok   ${label}: restored ${report.restored ?? report.replaced} records, ${workN} of her work all present, ${opened}/${routes.length} screens open`);
    }
    console.log(`  --   ${label}: library older than the pack after restore — ${staleLine || 'none'}`);
  } catch (err) {
    fail(label, err?.message || err);
  } finally {
    await ctx.close();
  }
}

await browser.close();
if (failed) { console.log('older-backup restore FAILED'); process.exit(1); }
console.log('older-backup restore passed');
process.exit(0);

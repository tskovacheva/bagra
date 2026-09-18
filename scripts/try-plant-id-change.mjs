// try-plant-id-change.mjs — sappanwood's new id against an installed copy (§13es).
//
// rc78 ships sappanwood as `seed:biancaea_sappan`. rc77 and earlier shipped it as
// `seed:paubrasilia_echinata`, and a person's trials, pigment batches, recipes
// and own combinations may point at that id. Which species her wood really was
// cannot be known from the data, so nothing of hers is rewritten. The old record
// is a record the pack no longer carries, and it goes through the withdrawal
// path (§13eo): kept while her work uses it, offered for removal when nothing does.
//
// In a real browser, with the rc77 records put back from archive/withdrawn/:
//   A. a fresh install has the new id and not the old one;
//   B. with a trial on the old plant and the old combination, both old records are
//      in use, unticked, and survive a forced removal; the trial still names the
//      old ids — not silently moved to the new species;
//   C. without the trial, removing the old combination first and then the old
//      plant takes both out, and the new sappanwood is untouched.

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
const CHROME = (process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'])
  .find(p => fs.existsSync(p));
if (!CHROME) {
  if (RELEASE) { console.log('FAIL id change: no chromium, and this is a release run'); process.exit(1); }
  console.log('id change check skipped (no chromium found)'); process.exit(0);
}

const FIX = JSON.parse(fs.readFileSync('archive/withdrawn/rc77-paubrasilia_echinata.json', 'utf8'));
const OLD_P = 'seed:' + FIX.plant.code;
const OLD_C = 'seed:' + FIX.combination.code;
const NEW_P = 'seed:biancaea_sappan';

let failed = false;
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { failed = true; console.log('FAIL id change: ' + m); } };

const PORT = 8762;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 60000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('dialog', d => d.accept().catch(() => {}));
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.querySelector('#view')?.textContent?.length > 50, { timeout: 30000 });

// ---- A ----
const fresh = await page.evaluate(async (o, n) => {
  const db = await import('./db.js');
  return { hasNew: !!(await db.get('plants', n)), hasOld: !!(await db.get('plants', o)) };
}, OLD_P, NEW_P);
ok(fresh.hasNew && !fresh.hasOld, `a fresh install carries ${NEW_P} and not ${OLD_P}`);

// ---- put rc77 back as installed, seeded records ----
const install = () => page.evaluate(async (fix) => {
  const db = await import('./db.js');
  const seed = await import('./seed.js');
  const packOf = async (name) => (await (await fetch(seed.PACKS[name].file)).json()).packId;
  const base = { origin: 'seed', editedByUser: false, editedFields: [], createdAt: '2026-09-01T00:00:00Z' };
  await db.putSystem('plants', { ...fix.plant, ...base, id: 'seed:' + fix.plant.code,
    packId: await packOf('plants'), packVersion: fix.packVersionsBefore.plants });
  await db.putSystem('combinations', { ...fix.combination, ...base, id: 'seed:' + fix.combination.code,
    packId: await packOf('combinations'), packVersion: fix.packVersionsBefore.combinations });
}, FIX);

const diff = (name, id) => page.evaluate(async (name, id) => {
  const seed = await import('./seed.js');
  const d = await seed.diffPack(name);
  const e = d.withdrawn.find(x => x.id === id);
  return { entry: e || null, ticked: seed.defaultChosen(d).has(id) };
}, name, id);
const forceRemove = (name, id) => page.evaluate(async (name, id) => {
  const seed = await import('./seed.js');
  const d = await seed.diffPack(name);
  await seed.applyDiff(name, d.withdrawn.filter(x => x.id === id), d.pack);
}, name, id);
const has = (store, id) => page.evaluate(async (s, i) => !!(await (await import('./db.js')).get(s, i)), store, id);

// ---- B ----
await install();
await page.evaluate(async (p, c) => {
  const db = await import('./db.js');
  await db.put('trials', db.newRecord({ id: 'zz-sappan-trial', status: 'planned', title: 'brazilwood', date: '2026-09-02',
    processCode: 'immersion', steps: [], resultPhotos: [],
    placements: [{ id: 'pl1', plantId: p, partCode: 'heartwood', condition: 'dried', combinationId: c }] }));
}, OLD_P, OLD_C);

const pB = await diff('plants', OLD_P);
const cB = await diff('combinations', OLD_C);
ok(pB.entry?.inUse >= 1 && !pB.ticked, `the old plant is in use and unticked (${pB.entry?.inUse})`);
ok(cB.entry?.inUse >= 1 && !cB.ticked, `the old combination is in use and unticked (${cB.entry?.inUse})`);
await forceRemove('combinations', OLD_C);
await forceRemove('plants', OLD_P);
ok(await has('plants', OLD_P) && await has('combinations', OLD_C), 'a forced removal leaves both old records');
const placement = await page.evaluate(async () => (await (await import('./db.js')).get('trials', 'zz-sappan-trial')).placements[0]);
ok(placement.plantId === OLD_P && placement.combinationId === OLD_C,
   'the trial still names the old plant and combination — nothing was reclassified');
ok(await has('plants', NEW_P), 'the new sappanwood sits beside the kept record');

await page.evaluate(h => { location.hash = '#/blank'; location.hash = h; }, `#/plants/${OLD_P}`);
await page.waitForSelector('[data-libdiffers-slot][data-checked]', { timeout: 15000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1500));
const noteText = await page.evaluate(() => document.querySelector('[data-libdiffers-slot]')?.textContent.replace(/\s+/g, ' ').trim() || '');
if (!noteText) console.log('  debug', await page.evaluate(() => location.hash + ' | ' + (document.querySelector('[data-libdiffers-slot]')?.outerHTML || 'no slot').slice(0, 300)));
const expected = await page.evaluate(async () => (await import('./i18n.js')).t('seed.recordWithdrawnInUse', { n: 1 }).slice(0, 40));
ok(noteText.includes(expected), `the kept plant says why it stays: „${noteText.slice(0, 80)}"`);
await page.evaluate(() => { location.hash = '#/blank'; location.hash = '#/trials/zz-sappan-trial'; });
await new Promise(r => setTimeout(r, 1000));
ok(await page.evaluate(() => location.hash === '#/trials/zz-sappan-trial'), 'the trial on the old plant still opens');

// ---- C ----
await page.evaluate(async () => (await import('./db.js')).removeSystem('trials', 'zz-sappan-trial'));
const cC = await diff('combinations', OLD_C);
ok(cC.entry && !cC.entry.inUse && cC.ticked, 'without the trial, the old combination is offered and ticked');
await forceRemove('combinations', OLD_C);
const pC = await diff('plants', OLD_P);
ok(pC.entry && !pC.entry.inUse && pC.ticked, 'once the old combination is gone, the old plant is offered and ticked');
await forceRemove('plants', OLD_P);
ok(!(await has('plants', OLD_P)) && !(await has('combinations', OLD_C)), 'both old records are removed');
ok(await has('plants', NEW_P) && await has('combinations', 'seed:biancaea_sappan_heartwood_alum_potassium_immersion'),
   'the new sappanwood and its combination are untouched');

ok(errors.length === 0, `no page error (${errors[0] || 'none'})`);
await browser.close();
server.kill();
if (failed) { console.log('id change check FAILED'); process.exitCode = 1; }
else console.log('id change check passed');
process.exit(process.exitCode || 0);

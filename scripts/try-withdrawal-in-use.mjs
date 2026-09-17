// try-withdrawal-in-use.mjs — a pack withdrawal against her own work (§13eo, §13ep).
//
// In a real browser, on a fresh profile, with the recipe the pack withdrew at rc74
// put back as an installed seeded record (it is kept whole in archive/withdrawn/):
//
//   A. The recipe's read view draws the calculator's ceiling next to the figures —
//      the iron bath at 2.5% against ferrous sulfate's 2%.
//   B. With a pigment batch made by the withdrawn recipe — by `viaId`, by
//      `linesFrom`, or by a swatch — the update counts it as in use, does not
//      tick it, draws its box disabled, says on the record that it stays, and a
//      removal forced past all of that still leaves the recipe and the batch.
//   C. With no work using it, the same recipe is ticked, and pressing Apply in the
//      preview — the confirmation — removes it and nothing else.
//
// Nothing here is a fixture shaped from memory: the recipe is the archived record,
// the preview is the application's own, the removal goes through `applyDiff`.

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
const CHROME = (process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'])
  .find(p => fs.existsSync(p));
if (!CHROME) {
  if (RELEASE) { console.log('FAIL withdrawal: no chromium, and this is a release run'); process.exit(1); }
  console.log('withdrawal check skipped (no chromium found)'); process.exit(0);
}

const ARCHIVE = JSON.parse(fs.readFileSync('archive/withdrawn/recipes-madder-lake-fermentation.json', 'utf8'));
const RID = 'seed:' + ARCHIVE.record.code;

let failed = false;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failed = true; console.log('FAIL withdrawal: ' + msg); } };

const PORT = 8761;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch {} });
await new Promise(r => setTimeout(r, 900));

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 60000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// The confirmation is the person's own act: the box ticked in the preview and
// Apply pressed. Apply then reports what it did in an alert, which is accepted
// here and recorded — an alert left open blocks the page.
const dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.accept().catch(() => {}); });
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.querySelector('#view')?.textContent?.length > 50, { timeout: 30000 });

const go = async (hash, waitFor) => {
  await page.evaluate(h => { location.hash = '#/blank'; location.hash = h; }, hash);
  await page.waitForFunction(sel => !sel || document.querySelector(sel), { timeout: 15000 }, waitFor).catch(() => {});
  await new Promise(r => setTimeout(r, 400));
};

// ---- A. the ceiling on the read view ----
await go('#/recipes/seed:iron-bath-dark', '.weighbox');
const warn = await page.evaluate(() => {
  const box = document.querySelector('.weighbox');
  const w = box?.querySelector('[data-weigh-warnings]');
  return w ? w.textContent.replace(/\s+/g, ' ').trim() : null;
});
ok(!!warn, 'the iron bath\'s read view draws a warning inside the weigh box');
ok(!!warn && /2\.5/.test(warn) && /\b2\s?%/.test(warn), `the warning names 2.5% against the 2% ceiling: „${warn}"`);

// A recipe inside its ceilings draws none — the block is not decoration.
await go('#/recipes/seed:madder-lake-hot', '.weighbox');
ok(await page.evaluate(() => !document.querySelector('.weighbox [data-weigh-warnings]')),
   'a recipe inside every ceiling draws no warning block');

// ---- put the withdrawn recipe back as an installed, seeded record ----
const installWithdrawn = () => page.evaluate(async (rec, packVersion) => {
  const db = await import('./db.js');
  const seed = await import('./seed.js');
  const pack = await (await fetch(seed.PACKS.recipes.file)).json();
  await db.putSystem('recipes', {
    ...rec, id: 'seed:' + rec.code, origin: 'seed', packId: pack.packId, packVersion,
    editedByUser: false, editedFields: [], createdAt: new Date().toISOString(),
  });
}, ARCHIVE.record, ARCHIVE.packVersionBefore);

const state = () => page.evaluate(async (rid) => {
  const seed = await import('./seed.js');
  const db = await import('./db.js');
  const d = await seed.diffPack('recipes');
  const w = d.withdrawn.find(x => x.id === rid);
  return { entry: w || null, ticked: seed.defaultChosen(d).has(rid), exists: !!(await db.get('recipes', rid)) };
}, RID);

// ---- B. in use, three ways ----
const kinds = {
  viaId:     { viaKind: 'recipe', viaId: RID, lines: [], swatches: [] },
  linesFrom: { viaKind: 'recipe', viaId: '', linesFrom: { recipeId: RID, recipeName: ARCHIVE.record.name, takenOn: '2026-09-01' }, lines: [], swatches: [] },
  swatch:    { viaKind: 'recipe', viaId: '', lines: [], swatches: [{ id: 'sw1', viaId: RID, hex: '#8a3030' }] },
};
for (const [kind, fields] of Object.entries(kinds)) {
  await installWithdrawn();
  await page.evaluate(async (f) => {
    const db = await import('./db.js');
    await db.put('pigmentBatches', db.newRecord({ id: 'zz-batch', status: 'done', plantId: 'seed:rubia_tinctorum', ...f }));
  }, fields);
  const s = await state();
  ok(s.entry && s.entry.inUse >= 1, `${kind}: the withdrawn recipe is counted as in use (${s.entry?.inUse})`);
  ok(!s.ticked, `${kind}: it is not ticked by default`);
  // Forced: every withdrawn entry applied as if ticked by hand.
  await page.evaluate(async (rid) => {
    const seed = await import('./seed.js');
    const d = await seed.diffPack('recipes');
    await seed.applyDiff('recipes', d.withdrawn.filter(x => x.id === rid), d.pack);
  }, RID);
  const after = await page.evaluate(async (rid) => {
    const db = await import('./db.js');
    return { recipe: !!(await db.get('recipes', rid)), batch: !!(await db.get('pigmentBatches', 'zz-batch')) };
  }, RID);
  ok(after.recipe && after.batch, `${kind}: a forced removal leaves both the recipe and the batch`);
  if (kind !== 'viaId') await page.evaluate(async () => (await import('./db.js')).removeSystem('pigmentBatches', 'zz-batch'));
}

// The record and the preview, still with the viaId batch? — put it back for the screens.
await page.evaluate(async (f) => {
  const db = await import('./db.js');
  await db.put('pigmentBatches', db.newRecord({ id: 'zz-batch', status: 'done', plantId: 'seed:rubia_tinctorum', ...f }));
}, kinds.viaId);

await go(`#/recipes/${RID}`, '[data-libdiffers-slot][data-checked]');
const recNote = await page.evaluate(() => document.querySelector('[data-libdiffers-slot]')?.textContent.replace(/\s+/g, ' ').trim() || '');
const inUseText = await page.evaluate(async () => (await import('./i18n.js')).t('seed.recordWithdrawnInUse', { n: 1 }).slice(0, 40));
ok(recNote.includes(inUseText), `the kept recipe's read view says it stays: „${recNote.slice(0, 90)}"`);

await page.evaluate(() => document.querySelector('[data-libdiffers-slot] [data-sync]')?.click());
await page.waitForSelector(`[data-pick="${RID}"]`, { timeout: 15000 }).catch(() => {});
const box = await page.evaluate((rid) => {
  const el = document.querySelector(`[data-pick="${rid}"]`);
  return el ? { disabled: el.disabled, checked: el.checked } : null;
}, RID);
ok(box && box.disabled && !box.checked, `in the preview its box is unticked and disabled (${JSON.stringify(box)})`);

// ---- C. not in use: ticked, and removed when Apply is pressed ----
await page.evaluate(async () => (await import('./db.js')).removeSystem('pigmentBatches', 'zz-batch'));
const s2 = await state();
ok(s2.entry && !s2.entry.inUse && s2.ticked, 'with no work using it, the withdrawal is offered and ticked');

const recipesBefore = await page.evaluate(async () => (await (await import('./db.js')).all('recipes')).length);
await go(`#/recipes/${RID}`, '[data-libdiffers-slot][data-checked]');
await page.evaluate(() => document.querySelector('[data-libdiffers-slot] [data-sync]')?.click());
await page.waitForSelector(`[data-pick="${RID}"]`, { timeout: 15000 }).catch(() => {});
const box2 = await page.evaluate((rid) => {
  const el = document.querySelector(`[data-pick="${rid}"]`);
  return el ? { disabled: el.disabled, checked: el.checked } : null;
}, RID);
ok(box2 && !box2.disabled && box2.checked, `in the preview its box is enabled and ticked (${JSON.stringify(box2)})`);

// Only the withdrawal is applied, so the count below is about it alone.
await page.evaluate((rid) => {
  for (const el of document.querySelectorAll('[data-pick]')) {
    if (el.dataset.pick !== rid && el.checked) el.click();
  }
}, RID);
await page.click('[data-apply]');
for (let i = 0; i < 50 && !dialogs.length; i++) await new Promise(r => setTimeout(r, 200));
await new Promise(r => setTimeout(r, 500));
const end = await page.evaluate(async (rid) => {
  const db = await import('./db.js');
  return { exists: !!(await db.get('recipes', rid)), count: (await db.all('recipes')).length };
}, RID);
ok(dialogs.length >= 1, `Apply reported what it did (${JSON.stringify(dialogs[0] || '')})`);
ok(!end.exists, 'after the box was left ticked and Apply pressed, the unused withdrawn recipe is gone');
ok(end.count === recipesBefore - 1, `and nothing else went with it (${recipesBefore} → ${end.count})`);

ok(errors.length === 0, `no page error (${errors[0] || 'none'})`);
await browser.close();
server.kill();
if (failed) { console.log('withdrawal check FAILED'); process.exitCode = 1; }
else console.log('withdrawal check passed');
process.exit(process.exitCode || 0);

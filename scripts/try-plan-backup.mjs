// try-plan-backup.mjs — a plan with a source and a picture, across a backup,
// onto a device that has never seen it and onto one that holds an older copy
// (§13gg). Chromium; each device is a browser context of its own, so its
// IndexedDB starts empty — as on a new phone.
//
//   laptop: the plan with title, notes, checklist, source, label, picture
//   → export → phone 1 (empty): restore (replace) → reload → open the plan
//   → phone 2 (an older copy of that plan): restore (merge) → reload → open it
// On each: the label and the link are shown, the picture is DRAWN (decoded,
// not merely present in the record), the id and the checklist are the same.
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
const CHROME = (process.env.BAGRA_CHROME ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']).find(p => fs.existsSync(p));
if (!CHROME) {
  if (RELEASE) { console.log('FAIL plan backup: no chromium, and this is a release run'); process.exit(1); }
  console.log('plan backup skipped (no chromium found)'); process.exit(0);
}
let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is = (got, want, m) => JSON.stringify(got) === JSON.stringify(want) ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

const PORT = 8768;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch {} });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${PORT}/version.js`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 60000 });
const errors = [];

async function device() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.evaluateOnNewDocument(() => { delete Navigator.prototype.serviceWorker; });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => (document.querySelector('#view')?.textContent || '').length > 50, { timeout: 30000 });
  return { ctx, page };
}
const booted = (page) => page.waitForFunction(() => (document.querySelector('#view')?.textContent || '').length > 50, { timeout: 30000 });

// ---- the laptop
const laptop = await device();
const made = await laptop.page.evaluate(async () => {
  const db = await import('./db.js');
  const c = document.createElement('canvas'); c.width = 640; c.height = 400;
  const g = c.getContext('2d'); g.fillStyle = '#2C3B57'; g.fillRect(0, 0, 640, 400); g.fillStyle = '#C9A227'; g.fillRect(40, 40, 200, 120);
  const plan = { id: 'plan-bk', title: 'Одеяло с желязо', status: 'active', notes: 'по публикацията',
    items: [{ id: 'i1', text: 'памучно одеяло', checked: true }, { id: 'i2', text: 'евкалипт', checked: false }],
    sourceLabel: 'Printing with Botanicals — Laura Mead', sourceUrl: 'https://www.facebook.com/groups/x/posts/1',
    referenceImage: c.toDataURL('image/jpeg', 0.82) };
  await db.put('plans', db.newRecord(plan));
  const stored = await db.get('plans', 'plan-bk');
  const backup = await (await import('./backup.js')).exportAll();
  return { stored, backup: JSON.stringify(backup) };
});
const inFile = JSON.parse(made.backup).data.plans.find(p => p.id === 'plan-bk');
is([inFile?.sourceLabel, inFile?.sourceUrl, inFile?.referenceImage === made.stored.referenceImage],
   [made.stored.sourceLabel, made.stored.sourceUrl, true], 'the backup file holds the source, the label and the picture, byte for byte');
await laptop.ctx.close();

async function check(page, label) {
  await page.reload({ waitUntil: 'networkidle0' }); await booted(page);
  await page.evaluate(() => { location.hash = '#/plans/plan-bk'; });
  await page.waitForSelector('#view [data-edit]', { timeout: 15000 });
  const drawn = await page.waitForFunction(() => { const i = document.querySelector('#view img.planref'); return i && i.complete && i.naturalWidth === 640; },
    { timeout: 15000 }).then(() => true, () => false);
  const r = await page.evaluate(async () => ({
    text: document.querySelector('#view').textContent,
    href: document.querySelector('#view a[target="_blank"]')?.getAttribute('href'),
    rec: await (await import('./db.js')).get('plans', 'plan-bk'),
  }));
  is([r.text.includes('Printing with Botanicals — Laura Mead'), r.href], [true, made.stored.sourceUrl], `${label}: the source and its link are on the plan`);
  is(drawn, true, `${label}: the picture is drawn (decoded, 640 px wide)`);
  is([r.rec.id, r.rec.items, r.rec.referenceImage === made.stored.referenceImage, r.rec.updatedAt], [made.stored.id, made.stored.items, true, made.stored.updatedAt],
     `${label}: same id, same checklist, same picture, same updatedAt`);
}

// ---- phone 1: has never seen the plan — replace
const p1 = await device();
await p1.page.evaluate(async (b) => (await import('./backup.js')).importBackup(JSON.parse(b), 'replace'), made.backup);
await check(p1.page, 'a clean phone, replace');
await p1.ctx.close();

// ---- phone 2: holds an older copy of the plan — merge (the reported case)
const p2 = await device();
await p2.page.evaluate(async (stored) => {
  const db = await import('./db.js');
  await db.putRaw('plans', { ...stored, sourceLabel: '', sourceUrl: '', referenceImage: '', updatedAt: '2025-01-01T00:00:00.000Z' });
}, made.stored);
const rep = await p2.page.evaluate(async (b) => (await import('./backup.js')).importBackup(JSON.parse(b), 'merge'), made.backup);
is(rep.updated, 1, 'a phone with an older copy, merge: the plan is updated, and said so');
await check(p2.page, 'a phone with an older copy, merge');
await p2.ctx.close();

// ---- phone 3: empty — merge
const p3 = await device();
await p3.page.evaluate(async (b) => (await import('./backup.js')).importBackup(JSON.parse(b), 'merge'), made.backup);
await check(p3.page, 'a clean phone, merge');
await p3.ctx.close();

if (errors.length) fail('page error: ' + errors[0]);
await browser.close();
console.log(failed ? 'plan backup FAILED' : 'plan backup passed');
process.exit(failed ? 1 : 0);

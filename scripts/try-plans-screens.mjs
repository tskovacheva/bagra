// try-plans-screens.mjs — Plans at 390 and 320 px (§13fj).
//
// screen-check.mjs measures every module at 390, 834, 1280 and 1680 and its
// rules apply to Plans like any other. It has no 320: this adds it for the one
// screen whose rows put three controls side by side — a tick, the words and a
// × — which is exactly the arrangement that runs past a narrow phone's edge.
// Both languages, because the longer one is the one that breaks, and which is
// longer depends on the line.
//
// Asked of the list, an empty form and a plan with long lines:
//   · the page does not scroll sideways, and no element ends past the edge
//   · every tick and every × is at least 44 × 44 px (§13ac)
//   · the words of a line keep a usable width rather than being squeezed out

import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
const CHROME = (process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'])
  .find(p => fs.existsSync(p));
if (!CHROME) {
  if (RELEASE) { console.log('FAIL plans screens: no chromium, and this is a release run'); process.exit(1); }
  console.log('plans screens skipped (no chromium found)'); process.exit(0);
}

let failed = false;
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };

const PORT = 8764;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch {} });
await new Promise(r => setTimeout(r, 900));

const browser = await puppeteer.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 60000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// No service worker: it takes control on the first load and reloads the page,
// which destroys the context mid-measurement. This check is about layout; the
// worker is checked by the layers that are about it.
await page.evaluateOnNewDocument(() => { delete Navigator.prototype.serviceWorker; });
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.querySelector('#view')?.textContent?.length > 50, { timeout: 30000 });

await page.evaluate(async () => {
  const db = await import('./db.js');
  await db.put('plans', { id: 'zz-plan',
    title: 'Сравнителен тест на закрепители за еко принт върху памук — осем варианта, едно платно',
    createdAt: '2026-09-20T09:00:00.000Z', updatedAt: '2026-09-21T09:00:00.000Z', status: 'active',
    notes: 'Същото платно, същите листа, същото време на пара.',
    items: [
      { id: 'a', text: 'N0 — без Fe', checked: true },
      { id: 'b', text: 'A3 — алуминиев ацетат и леко одеяло с желязо, накиснато за една нощ преди навиване', checked: false },
      { id: 'c', text: 'ALS — stipsa + soy blanket, steamed ninety minutes, unrolled the next morning', checked: false },
    ] });
});

// Waits until the view stops changing, not for a fixed time: a fixed wait is
// what makes a browser check fail on a slow machine (item 34).
const settle = () => page.evaluate(() => new Promise(res => {
  let last = -1, stable = 0, n = 0;
  const tick = () => {
    const now = document.querySelector('#view')?.innerHTML.length ?? 0;
    if (now === last) stable++; else { stable = 0; last = now; }
    if (stable >= 4 || ++n > 200) return res();
    setTimeout(tick, 25);
  };
  tick();
}));

let views = 0;
for (const lang of ['bg', 'en']) {
  await page.evaluate(async (l) => (await import('./i18n.js')).setLang(l), lang);
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    for (const [route, ready] of [['#/plans', 'tbody tr'], ['#/plans/new', '[data-f="title"]'],
                                  ['#/plans/zz-plan', '.checkitem']]) {
      await page.evaluate(h => { location.hash = '#/blank'; location.hash = h; }, route);
      await page.waitForSelector('#view ' + ready, { timeout: 15000 }).catch(() => {});
      await settle();
      const where = `${lang} ${width}px ${route}`;
      const r = await page.evaluate((ready) => {
        const vw = document.documentElement.clientWidth;
        const out = { found: !!document.querySelector('#view ' + ready),
          sideways: document.documentElement.scrollWidth - vw, past: [], small: [], squeezed: [] };
        for (const el of document.querySelectorAll('#view *')) {
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          if (b.right > vw + 0.5) out.past.push(`${el.tagName.toLowerCase()}.${el.className} ends at ${Math.round(b.right)}`);
        }
        for (const el of document.querySelectorAll('.checkitem label.check, .checkitem .btn')) {
          const b = el.getBoundingClientRect();
          if (b.width < 44 || b.height < 44) out.small.push(`${el.className || el.tagName} ${Math.round(b.width)}×${Math.round(b.height)}`);
        }
        for (const el of document.querySelectorAll('.checkitem input[type=text]')) {
          const b = el.getBoundingClientRect();
          if (b.width < 150) out.squeezed.push(Math.round(b.width));
        }
        return out;
      }, ready);
      views++;
      if (!r.found) fail(`${where}: the screen did not draw (${ready})`);
      if (r.sideways > 0) fail(`${where}: the page scrolls ${r.sideways}px sideways`);
      if (r.past.length) fail(`${where}: past the edge — ${r.past.slice(0, 3).join('; ')}`);
      if (r.small.length) fail(`${where}: smaller than a finger — ${r.small.slice(0, 3).join('; ')}`);
      if (r.squeezed.length) fail(`${where}: a line's text field is squeezed to ${r.squeezed.join(', ')}px`);
    }
  }
}
if (errors.length) fail('page error: ' + errors[0]);

await browser.close();
if (failed) { console.log('plans screens FAILED'); process.exit(1); }
console.log(`  plans screens: ${views} views at 390 and 320px in both languages, nothing past the edge, every tick and × at 44px`);
console.log('plans screens passed');
process.exit(0);

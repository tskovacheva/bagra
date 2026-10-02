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
    ],
    // v1.1 (§13gb): a long source and a wide picture, so the layout checks see them.
    sourceLabel: 'Printing with Botanicals — Laura Mead, the long post about blankets, iron and steaming times in a cold studio',
    sourceUrl: 'https://www.facebook.com/groups/ecoprintingcommunity/posts/1234567890123456789/?comment_id=987654321&notif_id=1',
    referenceImage: (() => { const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const g = c.getContext('2d'); g.fillStyle = '#A03D3B'; g.fillRect(0, 0, 1280, 720); return c.toDataURL('image/jpeg', 0.8); })() });
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
                                  ['#/plans/zz-plan', '.checkitem'], ['#/plans/zz-plan/edit', '.checkitem input[type=text]']]) {
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
// A picture added the way a person adds one (§13gb): a 2400×1600 image handed
// to the editor's file input, as the system picker would hand it. photo.js
// must bring it to 1280 px on its long side, the editor must show it, and Save
// must put it in the record and show it on the plan.
await page.setViewport({ width: 1280, height: 900 });
await page.evaluate(h => { location.hash = '#/blank'; location.hash = h; }, '#/plans/zz-plan/edit');
await page.waitForSelector('#view [data-refimg]', { timeout: 15000 });
await page.evaluate(async () => {
  const db = await import('./db.js');
  const p = await db.get('plans', 'zz-plan');
  await db.put('plans', { ...p, referenceImage: '' });
});
await page.evaluate(h => { location.hash = '#/blank'; location.hash = h; }, '#/plans/zz-plan/edit');
await page.waitForSelector('#view [data-refimg]', { timeout: 15000 });
await settle();
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 2400; c.height = 1600;
  const g = c.getContext('2d'); g.fillStyle = '#2C3B57'; g.fillRect(0, 0, 2400, 1600);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'screenshot.jpg', { type: 'image/jpeg' }));
  const input = document.querySelector('#view [data-refimg]');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForSelector('#view img.planref', { timeout: 15000 });
const made = await page.evaluate(() => new Promise(res => {
  const src = document.querySelector('#view img.planref').src;
  const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, jpeg: src.startsWith('data:image/jpeg') }); im.src = src;
}));
JSON.stringify(made) === JSON.stringify({ w: 1280, h: 853, jpeg: true })
  ? console.log('  ok   a 2400×1600 picture is made 1280×853 JPEG by photo.js, as a result photograph is')
  : fail('the picture was not resized as photo.js resizes: ' + JSON.stringify(made));
await page.click('#view [data-save]');
await page.waitForFunction(() => location.hash === '#/plans/zz-plan' && document.querySelector('#view img.planref'), { timeout: 15000 })
  .then(() => console.log('  ok   saved, the plan opens to read and shows the picture'), () => fail('after Save the plan does not show its picture'));
const stored = await page.evaluate(async () => (await (await import('./db.js')).get('plans', 'zz-plan')).referenceImage);
stored && stored.startsWith('data:image/jpeg') ? console.log('  ok   and the record holds it') : fail('the record does not hold the picture');

// The pigment list, in the same package (§13gb): the colour recorded on a
// batch's swatch is drawn beside its name — sized, outlined so a near-white
// stays visible, hidden from assistive technology because the name says it —
// and a batch with no colour, or no swatch at all, draws its name alone.
await page.evaluate(async () => {
  const db = await import('./db.js');
  const plant = (await db.all('plants'))[0];
  const base = { origin: 'user', plantId: plant.id, status: 'done', lines: [], process: {}, photos: [] };
  await db.put('pigmentBatches', { ...base, id: 'pg-light', date: '2026-09-03', yieldG: 3,
    swatches: [{ hex: '#F7F4EC', name: { bg: 'кремаво-бяло', en: 'cream white' } }] });
  await db.put('pigmentBatches', { ...base, id: 'pg-coral', date: '2026-09-02', yieldG: 5,
    swatches: [{ name: { bg: 'без цвят записан', en: 'no colour recorded' } }, { hex: '#E0735A', name: { bg: 'коралово-червено', en: 'coral red' } }] });
  await db.put('pigmentBatches', { ...base, id: 'pg-none', date: '2026-09-01', yieldG: 1, swatches: [] });
  await (await import('./i18n.js')).setLang('bg');
});
for (const width of [1280, 390]) {
  await page.setViewport({ width, height: 900 });
  await page.evaluate(h => { location.hash = '#/blank'; location.hash = h; }, '#/pigments');
  await page.waitForSelector('#view tr[data-open="pg-light"]', { timeout: 15000 });
  await settle();
  const r = await page.evaluate(() => {
    const row = (id) => document.querySelector(`#view tr[data-open="${id}"] td`);
    const sw = (id) => row(id)?.querySelector('.swatch');
    const box = (el) => el ? (({ width, height }) => ({ w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null;
    return {
      light: { box: box(sw('pg-light')), bg: sw('pg-light') && getComputedStyle(sw('pg-light')).backgroundColor,
               ring: sw('pg-light') && getComputedStyle(sw('pg-light')).boxShadow, hidden: sw('pg-light')?.getAttribute('aria-hidden'),
               text: row('pg-light')?.textContent.trim() },
      coral: { bg: sw('pg-coral') && getComputedStyle(sw('pg-coral')).backgroundColor, text: row('pg-coral')?.textContent.trim() },
      none: { swatch: !!sw('pg-none'), text: row('pg-none')?.textContent.trim() },
      header: box(document.querySelector('#view .swatchline .swatch')),
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const at = `pigments ${width}px`;
  JSON.stringify(r.light.box) === JSON.stringify({ w: 14, h: 14 }) && r.light.bg === 'rgb(247, 244, 236)'
    ? console.log(`  ok   ${at}: the recorded colour is drawn, 14×14, in its own colour`) : fail(`${at}: the swatch is ${JSON.stringify(r.light)}`);
  /inset/.test(r.light.ring || '') ? console.log(`  ok   ${at}: a near-white swatch has its outline`) : fail(`${at}: no outline on a light swatch (${r.light.ring})`);
  r.light.hidden === 'true' && r.light.text === 'кремаво-бяло' ? console.log(`  ok   ${at}: the swatch is decoration; the name is there`) : fail(`${at}: ${JSON.stringify(r.light)}`);
  r.coral.bg === 'rgb(224, 115, 90)' && r.coral.text === 'коралово-червено'
    ? console.log(`  ok   ${at}: the colour and the name come from the same swatch`) : fail(`${at}: ${JSON.stringify(r.coral)}`);
  !r.none.swatch && r.none.text === '—' ? console.log(`  ok   ${at}: a batch with no colour draws no empty swatch`) : fail(`${at}: ${JSON.stringify(r.none)}`);
  r.header && r.header.w === 28 ? console.log(`  ok   ${at}: the group's colour is drawn above its table`) : fail(`${at}: group swatch ${JSON.stringify(r.header)}`);
  if (r.sideways > 0) fail(`${at}: the page scrolls ${r.sideways}px sideways`);
}

if (errors.length) fail('page error: ' + errors[0]);

await browser.close();
if (failed) { console.log('plans screens FAILED'); process.exit(1); }
console.log(`  plans screens: ${views} views at 390 and 320px in both languages, nothing past the edge, every tick and × at 44px`);
console.log('plans screens passed');
process.exit(0);

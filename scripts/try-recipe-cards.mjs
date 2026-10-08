// try-recipe-cards.mjs — recipe cards on a phone keep their words inside (§13gh).
//
// „Акварелна боя от пигмент", ТИП „бои, пасти и свързващи вещества": the value
// ran past the card and was cut off. The page itself did not scroll sideways —
// the panel clips what overflows it — so a check of the document's width saw
// nothing, and a check of an element against itself saw a span exactly as wide
// as its words. This measures every piece of text in a card against the card,
// and the card against the window: at 320, 360, 390 and 412 px, in both
// languages, with the seeded recipes and one of hers made to be awkward (a name
// with no break in it, every fibre class). And at 1280 px, that the desktop
// table is still a table and the type still sits on one line.
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
const CHROME = (process.env.BAGRA_CHROME ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']).find(p => fs.existsSync(p));
if (!CHROME) {
  if (RELEASE) { console.log('FAIL recipe cards: no chromium, and this is a release run'); process.exit(1); }
  console.log('recipe cards skipped (no chromium found)'); process.exit(0);
}
let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };

const PORT = 8769;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch {} });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${PORT}/version.js`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 60000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.evaluateOnNewDocument(() => { delete Navigator.prototype.serviceWorker; });
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction(async () => !!(await (await import('./db.js')).get('recipes', 'seed:watercolour-from-pigment')), { timeout: 30000, polling: 200 });
await page.evaluate(async () => {
  const db = await import('./db.js');
  await db.put('recipes', db.newRecord({ id: 'own-long', origin: 'user', type: 'paint', output: 'none', scaleBy: 'weight', version: 1,
    name: { bg: 'Многослойнапастазапечатвърхуплътнокоприненплатбезинтервали', en: 'Multilayerpasteforprintingondenssilkclothwithoutanyspaces' },
    notes: { bg: '', en: '' }, appliesTo: ['cellulose', 'protein', 'mixed', 'synthetic'], ingredients: [], steps: [], requiredFollowOn: [], sourceCodes: [] }));
});
const go = async () => {
  await page.evaluate(() => { location.hash = '#/blank'; location.hash = '#/recipes'; });
  await page.waitForFunction(() => document.querySelector('#view tr[data-open="seed:watercolour-from-pigment"]'), { timeout: 15000 });
  await page.evaluate(() => new Promise(res => { let last = -1, st = 0, n = 0;
    const tk = () => { const now = document.querySelector('#view')?.innerHTML.length ?? 0; now === last ? st++ : (st = 0, last = now);
      if (st >= 4 || ++n > 200) return res(); setTimeout(tk, 25); }; tk(); }));
};

const TYPE = { bg: 'бои, пасти и свързващи вещества', en: 'paints, pastes & binders' };
for (const lang of ['bg', 'en']) {
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluate(async (l) => (await import('./i18n.js')).setLang(l), lang);
  await page.waitForFunction(async (l) => (await import('./i18n.js')).getLang() === l, { polling: 100, timeout: 10000 }, lang);
  for (const width of [320, 360, 390, 412]) {
    await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
    await page.waitForFunction(() => (document.querySelector('#view')?.textContent || '').length > 50, { timeout: 30000 });
    await page.evaluate(async (l) => (await import('./i18n.js')).setLang(l), lang);
    await go();
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = { sideways: document.documentElement.scrollWidth - vw, cards: 0, escapes: [], offscreen: [], type: null };
      for (const card of document.querySelectorAll('#view tbody tr[data-open]')) {
        out.cards++;
        const c = card.getBoundingClientRect();
        if (c.left < -0.5 || c.right > vw + 0.5) out.offscreen.push(card.dataset.open);
        // Every element that holds text, and every text run, against the card.
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent.trim()) continue;
          const range = document.createRange(); range.selectNodeContents(n);
          for (const b of range.getClientRects()) {
            if (b.width && (b.right > c.right + 0.5 || b.left < c.left - 0.5)) { out.escapes.push(`${card.dataset.open}: „${n.textContent.trim().slice(0, 40)}" ${Math.round(b.right - c.right)}px`); break; }
          }
        }
        if (card.dataset.open === 'seed:watercolour-from-pigment') {
          const tc = card.querySelector('.typecell'); const tb = tc.getBoundingClientRect();
          out.type = { text: tc.textContent.trim(), inside: tb.right <= c.right + 0.5, lines: Math.round(tb.height / parseFloat(getComputedStyle(tc).lineHeight || 18)) };
        }
      }
      return out;
    });
    const at = `${lang} ${width}px`;
    r.escapes.length ? fail(`${at}: text outside its card — ${r.escapes.slice(0, 3).join('; ')}`) : ok(`${at}: all text in all ${r.cards} cards stays inside its card`);
    r.offscreen.length ? fail(`${at}: cards outside the window: ${r.offscreen.join(', ')}`) : ok(`${at}: every card inside the window`);
    r.sideways > 0 ? fail(`${at}: the page scrolls ${r.sideways}px sideways`) : ok(`${at}: no sideways scroll`);
    r.type && r.type.text === TYPE[lang] && r.type.inside ? ok(`${at}: ТИП „${r.type.text}" inside the watercolour card`) : fail(`${at}: the type ${JSON.stringify(r.type)} (expected „${TYPE[lang]}")`);
  }
  await page.setViewport({ width: 1280, height: 900 });
  await page.waitForFunction(() => (document.querySelector('#view')?.textContent || '').length > 50, { timeout: 30000 });
  await page.evaluate(async (l) => (await import('./i18n.js')).setLang(l), lang);
  await go();
  const d = await page.evaluate(() => {
    const tc = document.querySelector('#view tr[data-open="seed:watercolour-from-pigment"] .typecell');
    return { thead: getComputedStyle(document.querySelector('#view .grid thead')).display, td: getComputedStyle(tc.closest('td')).display,
             ws: getComputedStyle(tc).whiteSpace, oneLine: tc.getBoundingClientRect().height < 26,
             sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  JSON.stringify(d) === JSON.stringify({ thead: 'table-header-group', td: 'table-cell', ws: 'nowrap', oneLine: true, sideways: 0 })
    ? ok(`${lang} 1280px: the desktop table is unchanged — header row, cells, the type on one line`) : fail(`${lang} 1280px: desktop changed ${JSON.stringify(d)}`);
}
if (errors.length) fail('page error: ' + errors[0]);
await browser.close();
console.log(failed ? 'recipe cards FAILED' : 'recipe cards passed');
process.exit(failed ? 1 : 0);

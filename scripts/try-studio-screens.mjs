// try-studio-screens.mjs — Studio System v1 on screen (§13gc), in Chromium.
//
// Six pieces, one per studio status and one finished: the filter chips count
// them and carry the same colour token as each row's badge; a chip filters to
// its pieces; the record shows the same badge, the working label (tag number,
// stage, what did it, when) and the trail; Print shows the label and nothing
// else, in colour or in ink; the Library's Studio System tab draws the legend
// from the same tokens and lists every code, in both languages. At 1280 and
// 390 px, with no sideways scroll.
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const RELEASE = process.argv.includes('--release') || !!process.env.BAGRA_RELEASE;
const CHROME = (process.env.BAGRA_CHROME ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']).find(p => fs.existsSync(p));
if (!CHROME) {
  if (RELEASE) { console.log('FAIL studio screens: no chromium, and this is a release run'); process.exit(1); }
  console.log('studio screens skipped (no chromium found)'); process.exit(0);
}
const { STUDIO_STATUSES, STUDIO_CODES } = await import('../studio.js');

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is = (got, want, m) => JSON.stringify(got) === JSON.stringify(want) ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

const PORT = 8766;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch {} });
for (let i = 0; i < 100; i++) {          // until it answers, not for a fixed time
  try { if ((await fetch(`http://localhost:${PORT}/version.js`)).ok) break; } catch {}
  await new Promise(r => setTimeout(r, 100));
}

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 60000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.evaluateOnNewDocument(() => { delete Navigator.prototype.serviceWorker; });
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.querySelector('#view')?.textContent?.length > 50, { timeout: 30000 });
await page.waitForFunction(async () => !!(await (await import('./db.js')).get('recipes', 'seed:aluminium-acetate-mordant'))?.shortCode,
  { timeout: 30000, polling: 200 });

// The six pieces, written as the application writes them.
await page.evaluate(async () => {
  const db = await import('./db.js');
  const act = (actionCode, date, extra = {}) => ({ id: 'a-' + actionCode + date, actionCode, date, batchId: null, trialId: null, recipeId: null, note: '', ...extra });
  const AA = 'seed:aluminium-acetate-mordant', CA = 'seed:chalk-bath';
  await db.put('trials', db.newRecord({ id: 'tr-ep', processCode: 'ecoprint', title: 'еко', steps: [], placements: [] }));
  const mk = (id, label, actions) => db.put('fabrics', db.newRecord({ id, label, name: 'парче ' + label, composition: [{ fibreCode: 'cotton', percent: 100 }], actions }));
  await mk('f-raw', 'П-101', []);
  await mk('f-w', 'П-102', [act('wash', '2026-09-28')]);
  await mk('f-t', 'П-103', [act('wash', '2026-09-28'), act('tannin', '2026-09-29')]);
  await mk('f-m', 'П-104', [act('wash', '2026-09-28'), act('mordant', '2026-10-01', { recipeId: AA }), act('neutralise', '2026-10-02', { recipeId: CA })]);
  await mk('f-d', 'П-105', [act('wash', '2026-09-28'), act('mordant', '2026-10-01', { recipeId: AA }), act('neutralise', '2026-10-02', { recipeId: CA }),
                            act('dye', '2026-10-04', { trialId: 'tr-ep' })]);
  await mk('f-fin', 'П-106', [act('wash', '2026-09-20'), act('dye', '2026-09-22'), act('finish', '2026-09-30')]);
});
const want = { 'f-raw': 'RAW', 'f-w': 'W', 'f-t': 'T', 'f-m': 'M', 'f-d': 'D', 'f-fin': 'D' };
const hexOf = Object.fromEntries(STUDIO_STATUSES.map(s => [s.code, s.hex.toLowerCase()]));
const go = async (h) => {
  await page.evaluate(x => { location.hash = '#/blank'; location.hash = x; }, h);
  await page.waitForFunction(() => (document.querySelector('#view')?.textContent || '').length > 50, { timeout: 15000 });
  await page.evaluate(() => new Promise(res => { let last = -1, n = 0, st = 0;
    const tk = () => { const now = document.querySelector('#view')?.innerHTML.length ?? 0; now === last ? st++ : (st = 0, last = now);
      if (st >= 4 || ++n > 200) return res(); setTimeout(tk, 25); }; tk(); }));
};

for (const width of [1280, 390]) {
  console.log(`\nfabrics at ${width}px`);
  await page.setViewport({ width, height: 900, isMobile: width < 500, hasTouch: width < 500 });
  await go('#/fabrics');
  const r = await page.evaluate(() => {
    const st = (el) => (el?.getAttribute('style') || '').match(/--st:(#[0-9A-Fa-f]{6})/)?.[1]?.toLowerCase() || null;
    const chips = Object.fromEntries([...document.querySelectorAll('#view .box[data-box]')].map(b => [b.dataset.box,
      { count: b.querySelector('.boxcount')?.textContent.trim(), st: st(b), text: b.textContent.replace(/\s+/g, ' ').trim() }]));
    const rows = Object.fromEntries([...document.querySelectorAll('#view tr[data-open]')].map(tr => {
      const b = tr.querySelector('.studiobadge'); const box = b?.getBoundingClientRect();
      const bg = b ? getComputedStyle(b).backgroundColor : null, fg = b ? getComputedStyle(b).color : null;
      return [tr.dataset.open, { code: b?.dataset.studio, st: st(b), w: Math.round(box?.width || 0), text: b?.textContent.trim(),
        finished: !!tr.querySelector('.studiobadge + .chip'), bg, fg }];
    }));
    return { chips, rows, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  for (const s of STUDIO_STATUSES) {
    const c = r.chips[s.code];
    c && c.st === hexOf[s.code] && c.count === (s.code === 'D' ? '1' : '1') && c.text.includes(s.code)
      ? ok(`chip ${s.code}: its colour, its code and name, count ${c.count}`) : fail(`chip ${s.code}: ${JSON.stringify(c)}`);
  }
  is(r.chips.finished?.count, '1', 'the finished chip counts the finished piece, uncoloured');
  is(r.chips.finished?.st, null, 'and carries no studio colour');
  for (const [id, code] of Object.entries(want)) {
    const row = r.rows[id];
    row && row.code === code && row.st === hexOf[code] && row.st === r.chips[code].st && row.w > 30
      ? ok(`${id}: badge ${code} in the same token as its chip, ${row.w}px wide`) : fail(`${id}: ${JSON.stringify(row)}`);
  }
  is(r.rows['f-fin'].finished, true, 'the finished piece: D, and „finished" beside it');
  // Text on the badge, against the tint over the panel: readable.
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  const lumOf = ([r_, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r_) + 0.7152 * f(g) + 0.0722 * f(b); };
  let worst = Infinity;
  for (const row of Object.values(r.rows)) {
    const [br, bgc, bb, a = 1] = parse(row.bg); const base = [255, 253, 248];
    const mix = [br, bgc, bb].map((v, i) => v * a + base[i] * (1 - a));
    const [x, y] = [lumOf(mix), lumOf(parse(row.fg))].sort((p, q) => q - p);
    worst = Math.min(worst, (x + 0.05) / (y + 0.05));
  }
  worst >= 4.5 ? ok(`badge text is readable on every tint (lowest ${worst.toFixed(1)}:1)`) : fail(`badge text contrast ${worst.toFixed(2)}:1`);
  r.sideways <= 0 ? ok('no sideways scroll') : fail(`the page scrolls ${r.sideways}px sideways`);

  await page.click('#view .box[data-box="T"]'); await go('#/fabrics');
  // the filter is module state and survives the re-render through go(); read it
  const tRows = await page.evaluate(() => [...document.querySelectorAll('#view tr[data-open]')].map(tr => tr.dataset.open));
  is(tRows, ['f-t'], 'the T chip shows the tanned piece and nothing else');
  await page.click('#view .box[data-box="finished"]'); await go('#/fabrics');
  is(await page.evaluate(() => [...document.querySelectorAll('#view tr[data-open]')].map(tr => tr.dataset.open)), ['f-fin'], 'the finished chip shows the finished piece');
  await page.click('#view .box[data-box=""]'); await go('#/fabrics');
}

console.log('\nthe record, the label, the print');
await page.setViewport({ width: 1280, height: 900 });
// Leaving the mobile emulation reloads the page: wait for the application to
// have started again before choosing a language, or its start reads the stored
// one over ours. A first opening is in English (§13fi); the label is read here
// in Bulgarian — and the test confirms the language took before reading.
await page.waitForFunction(() => (document.querySelector('#view')?.textContent || '').length > 50, { timeout: 30000 });
await page.evaluate(async () => (await import('./i18n.js')).setLang('bg'));
await page.waitForFunction(async () => (await import('./i18n.js')).getLang() === 'bg', { timeout: 10000, polling: 100 });
await go('#/fabrics/f-m');
const date = await page.evaluate(async () => (await import('./ui.js')).fmtDate('2026-10-02'));
const rec = await page.evaluate(() => ({
  head: document.querySelector('#view .headline .studiobadge')?.dataset.studio,
  label: [...document.querySelectorAll('#view .worklabel > div')].map(d => d.textContent.trim()),
  trail: document.querySelector('#view .studiotrail')?.textContent.trim(),
}));
is(rec.head, 'M', 'the record shows the same status as its row');
is(rec.label, ['П-104', 'M · МОРДАНТИРАН', 'AA + CaCO₃', date], 'the label: tag number, stage, what did it, when');
is(rec.trail, 'W → M (AA + CaCO₃)', 'the trail of a mordanted piece');
await go('#/fabrics/f-d');
is(await page.evaluate(() => document.querySelector('#view .studiotrail')?.textContent.trim()), 'W → M (AA + CaCO₃) → D (EP)',
   'the trail of a printed piece: W → M (AA + CaCO₃) → D (EP)');

// The process summary (§13ge): a full eco print, the rows it can fill and no
// other, in order; the work one press away; and the piece in the database
// exactly as it was — the summary is drawn, never stored.
const fx = await page.evaluate(async () => {
  const db = await import('./db.js');
  const [p1, p2] = (await db.all('plants')).filter(p => p.nameCommon?.bg && p.nameCommon?.en).slice(0, 2);
  await db.put('trials', db.newRecord({ id: 'tr-ep-full', processCode: 'ecoprint', title: 'еко с одеяло', steps: [],
    placements: [{ id: 'pl1', plantId: p1.id }, { id: 'pl2', plantId: p2.id }],
    bundle: { roll: '', layers: [{ id: 'L1', kind: 'receiving_cloth', what: 'коприна', note: '', stepId: null, prep: null },
      { id: 'L2', kind: 'carrier_blanket', what: 'памук', note: '', stepId: null, prep: { washed: true, treatment: 'Fe', duration: '', bath: 'брош', note: '' } }] } }));
  const act = (actionCode, date, extra = {}) => ({ id: 'a-' + actionCode + date, actionCode, date, batchId: null, trialId: null, recipeId: null, note: '', ...extra });
  await db.put('fabrics', db.newRecord({ id: 'f-ep', label: 'П-107', name: 'коприна', composition: [{ fibreCode: 'silk', percent: 100 }], actions: [
    act('wash', '2026-09-28'), act('mordant', '2026-10-01', { recipeId: 'seed:aluminium-acetate-mordant' }),
    act('neutralise', '2026-10-02', { recipeId: 'seed:chalk-bath' }), act('dye', '2026-10-04', { trialId: 'tr-ep-full' })] }));
  return { names: { bg: [p1.nameCommon.bg, p2.nameCommon.bg].join(', '), en: [p1.nameCommon.en, p2.nameCommon.en].join(', ') },
           stored: JSON.stringify(await db.get('fabrics', 'f-ep')) };
});
const readSummary = () => page.evaluate(() => ({
  title: [...document.querySelectorAll('#view h2')].map(h => h.textContent.trim()).find(x => /Обобщение|Process summary/.test(x)),
  rows: [...document.querySelectorAll('#view .processsummary tr')].map(tr => [tr.querySelector('th').textContent.trim(), tr.querySelector('td').textContent.replace(/\s+/g, ' ').trim()]),
  trial: document.querySelector('#view [data-trial="tr-ep-full"]')?.textContent.trim(),
}));
await go('#/fabrics/f-ep');
const sb = await readSummary();
is(sb.title, 'Обобщение на обработката', 'the card is there, under the label');
is(sb.rows.map(r => r[0]), ['Етап', 'Подготовка', 'Техника', 'Одеяло (BLK)', 'Обработка на одеялото', 'Баня на одеялото', 'Растения', 'Дата'],
   'the rows an eco print fills, in order — no Dye, no Modifier, no empty row');
const dyedOn = await page.evaluate(async () => (await import('./ui.js')).fmtDate('2026-10-04'));
is(sb.rows.slice(1).map(r => r[1]), ['AA + CaCO₃', 'EP · Еко принт', 'памук', 'Fe', 'брош', fx.names.bg, dyedOn],
   'what each says, codes with their names, the blanket in its own words');
is(sb.trial, 'Отвори опита', 'the work is one press away');
is(await page.evaluate(async () => JSON.stringify(await (await import('./db.js')).get('fabrics', 'f-ep'))), fx.stored,
   'and the piece in the database is exactly as it was — the summary is not stored');
await page.evaluate(async () => (await import('./i18n.js')).setLang('en'));
await go('#/fabrics/f-ep');
const se = await readSummary();
is([se.title, se.rows.find(r => r[0] === 'Plants')?.[1], se.rows.find(r => r[0] === 'Technique')?.[1]], ['Process summary', fx.names.en, 'EP · Eco-print'],
   'in English: the labels, the plant names, the technique');
await page.evaluate(async () => (await import('./i18n.js')).setLang('bg'));
await go('#/fabrics/f-raw');
is((await readSummary()).rows.map(r => r[0]), ['Етап'], 'a raw piece: its stage and nothing else');
await go('#/fabrics/f-ep');
await page.click('#view [data-trial="tr-ep-full"]');
await page.waitForFunction(() => location.hash === '#/trials/tr-ep-full', { timeout: 10000 })
  .then(() => ok('„Open Trial" opens the work'), () => fail('„Open Trial" did not open the work'));
await go('#/fabrics/f-d');

await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
for (const mode of ['colour', 'ink']) {
  await page.click(`#view [data-print-label="${mode}"]`);
  await page.emulateMediaType('print');
  const pr = await page.evaluate(() => {
    const shown = [...document.body.children].filter(el => getComputedStyle(el).display !== 'none').map(el => el.id || el.tagName.toLowerCase());
    const lab = document.querySelector('#printlabel .worklabel');
    const b = lab?.getBoundingClientRect();
    return { printed: window.__printed, shown, bg: lab && getComputedStyle(lab).backgroundColor, w: Math.round(b?.width || 0), h: Math.round(b?.height || 0),
             text: lab?.textContent.replace(/\s+/g, ' ').trim() };
  });
  await page.emulateMediaType('screen');
  is(pr.shown, ['printlabel'], `print (${mode}): the label and nothing else — no navigation, no screen`);
  is([pr.w, pr.h], [265, 151], `print (${mode}): 70 × 40 mm`);
  is(pr.bg, mode === 'ink' ? 'rgb(255, 255, 255)' : 'rgb(224, 138, 115)', `print (${mode}): ${mode === 'ink' ? 'black on white, for coloured paper' : 'in the stage\'s colour (D, coral)'}`);
  is(pr.text.startsWith('П-105 D · ОБАГРЕН / ОТПЕЧАТАН EP'), true, `print (${mode}): the piece's own label`);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  is(await page.evaluate(() => [!!document.getElementById('printlabel'), document.body.classList.contains('printing-label')]), [false, false],
     `print (${mode}): afterwards, nothing left behind`);
}

for (const lang of ['bg', 'en']) {
  console.log(`\nLibrary, Studio System (${lang})`);
  await page.evaluate(async (l) => (await import('./i18n.js')).setLang(l), lang);
  await go('#/library/studio');
  const lib = await page.evaluate(() => ({
    tab: document.querySelector('#view .tab.on')?.textContent.trim(),
    legend: [...document.querySelectorAll('#view .studiolegend tr')].map(tr => [tr.dataset.studio,
      (tr.querySelector('.studiobadge')?.getAttribute('style') || '').match(/--st:(#[0-9A-Fa-f]{6})/)?.[1]?.toLowerCase()]),
    codes: [...document.querySelectorAll('#view .studiocodes tbody tr[data-code]')].map(tr => tr.dataset.code),
    label: !!document.querySelector('#view .worklabel'), trail: document.querySelector('#view .studiotrail')?.textContent.trim(),
    note: document.querySelector('#view .note')?.textContent.trim(),
  }));
  is(lib.tab, lang === 'bg' ? 'Система за ателието' : 'Studio System', 'the tab');
  is(lib.legend, STUDIO_STATUSES.map(s => [s.code, s.hex.toLowerCase()]), 'the legend is the five, in the tokens the fabric screens use');
  is(lib.codes.length, STUDIO_CODES.length, `all ${STUDIO_CODES.length} codes are listed`);
  is([lib.label, lib.trail], [true, 'W → T (TAN) → M (AA + CaCO₃) → D (EP)'], 'a label to read, and a trail explained');
  is(lang === 'bg' ? /[Нн]е заместват пълния запис/.test(lib.note) : /do not replace the complete process record/.test(lib.note), true, 'the note that codes do not replace the record');
}
// One value and one input event: typed key by key, each key re-renders the
// screen and replaces the field under the next one.
await page.evaluate(() => { const q = document.querySelector('#view [data-q]'); q.value = 'AAc'; q.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForFunction(() => document.querySelectorAll('#view .studiocodes tbody tr[data-code]').length === 1, { timeout: 10000 })
  .then(() => ok('the dictionary searches: „AAc" finds one'), () => fail('searching the dictionary for AAc'));

if (errors.length) fail('page error: ' + errors[0]);
await browser.close();
console.log(failed ? 'studio screens FAILED' : 'studio screens passed');
process.exit(failed ? 1 : 0);

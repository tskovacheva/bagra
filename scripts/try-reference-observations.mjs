// try-reference-observations.mjs — Reference shows her results beside the expected one, and its Records
// table can be searched and sorted (§13fp).
//
// The walnut placement from the owner's silk scarf of 25 September 2026 is
// linked to `seed:juglans_regia_leaf_alum_potassium_ecoprint`. Reference must
// show it under that record — read from the trial, copied nowhere — and must not
// guess links for placements that have none.
//
// jsdom over an empty fake IndexedDB, through the real Reference screens.

import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'https://example.org/bagra/', runScripts: 'outside-only' });
const define = (n, v) => Object.defineProperty(global, n, { value: v, configurable: true, writable: true });
for (const k of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Image', 'FileReader', 'Blob',
  'URL', 'Event', 'MouseEvent', 'CustomEvent', 'MutationObserver'])
  define(k, k === 'window' ? dom.window : dom.window[k]);
define('alert', () => {});
define('confirm', () => true);
define('crypto', { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) });
define('fetch', async (u) => {
  const p = String(u).replace(/^.*\/bagra\//, '');
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
});

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is = (got, want, m) => JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', (e) => fail('rejection: ' + (e?.stack || e)));

const db = await import('../db.js');
await db.setSetting('language', 'bg');
await import('../app.js');
await wait(2500);
const view = document.getElementById('view');
const go = async (h) => { location.hash = h; await wait(400); };
const click = async (el) => {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await wait(350);
};
const type = async (v) => {
  const box = view.querySelector('[data-search]');
  box.value = v;
  box.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await wait(400);
};
const rows = () => [...view.querySelectorAll('tbody tr')];
const cell = (tr, n) => tr.children[n]?.textContent.replace(/\s+/g, ' ').trim() || '';
const WALNUT = 'seed:juglans_regia_leaf_alum_potassium_ecoprint';
const place = (id, plantId, partCode, o = {}) => ({ id, stepId: null, plantId, partCode, condition: 'fresh', facing: '',
  printSide: '', printQuality: '', localTreatment: '', resultColour: '', resultHex: '', observation: '', photo: null,
  combinationId: null, extractionMode: '', ...o });
const trial = (id, date, title, placements) => db.newRecord({ id, date, title, status: 'complete', processCode: 'ecoprint',
  finishedOn: date, steps: [], placements, bundle: { layers: [], roll: '' }, fabricIds: [], enhancements: [], techniqueIds: [] });

try {
  const combo0 = await db.get('combinations', WALNUT);
  if (!combo0) throw new Error('the walnut record is not in the installed library');
  await db.putRaw('trials', trial('tr-silk', '2026-09-25', 'копринен шал', [
    place('p-walnut', 'seed:juglans_regia', 'leaf', { combinationId: WALNUT, resultColour: 'топло кафяво',
      resultHex: '#9c846d', observation: 'ярко топло кафяво, шоколадово', printQuality: 'sharp' }),
    place('p-yarrow', 'seed:achillea_millefolium', 'flower', { resultColour: 'сиво-зелен', resultHex: '#b0b5b1',
      observation: 'неприсвоено наблюдение' }),
  ]));
  // A link to a record that does not exist, and a trial with nothing filled in.
  await db.putRaw('trials', trial('tr-odd', '2026-08-01', '', [place('p-gone', 'seed:quercus_robur', 'leaf',
    { combinationId: 'seed:no_such_record' }), place('p-empty', '', '', { combinationId: WALNUT }),
    // Walnut leaf, the same plant and part as the record — and no link. Not his.
    place('p-walnut-free', 'seed:juglans_regia', 'leaf', { resultColour: 'кафяво', observation: 'несвързан орех' })]));

  console.log('the walnut record: expected, and her observation under it');
  await go(`#/reference/${WALNUT}`);
  const expected = text => view.querySelector('.headline h2')?.textContent.trim();
  is(expected(), (combo0.expected?.colourText?.bg || '').trim() || '—', 'the expected result is the record\'s own');
  const obs = [...view.querySelectorAll('[data-observation="tr-silk"]')];
  is(obs.length, 1, 'one observation from the silk-scarf trial');
  const o = obs[0]?.textContent.replace(/\s+/g, ' ') || '';
  is(['топло кафяво', '25.09.2026', 'ясен', 'ярко топло кафяво, шоколадово', 'копринен шал'].every(s => o.includes(s)),
     true, `colour, date, print quality, observation, trial title: „${o.trim()}“`);
  is(obs[0]?.querySelector('.thumb')?.getAttribute('style')?.includes('#9c846d'), true, 'with a swatch in its own colour');
  is(obs[0]?.querySelector('a.obslink')?.getAttribute('href'), '#/trials/tr-silk', 'and a way to open the trial');
  is(view.textContent.includes('неприсвоено наблюдение'), false, 'the unlinked yarrow is not guessed into it');
  is(view.textContent.includes('несвързан орех'), false,
     'nor an unlinked walnut leaf, though its plant and part are the record\'s own');
  const odd = view.querySelector('[data-observation="tr-odd"]')?.textContent.replace(/\s+/g, ' ') || '';
  is(/без описан цвят/.test(odd) && !/—\s*·/.test(odd), true, 'an empty placement shows no row of dashes');
  const combo1 = await db.get('combinations', WALNUT);
  is(JSON.stringify(combo1), JSON.stringify(combo0), 'the combination record is not touched by being read');
  const cj = JSON.stringify(combo1);
  is(['ярко топло кафяво, шоколадово', '#9c846d', 'tr-silk', 'p-walnut'].some(v => cj.includes(v)), false,
     'and carries nothing of the observation — not its words, colour, trial or placement');

  console.log('edit the trial, and Reference follows');
  const tr = await db.get('trials', 'tr-silk');
  tr.placements[0].resultColour = 'тъмно шоколадово';
  await db.putRaw('trials', tr);
  await go('#/reference'); await go(`#/reference/${WALNUT}`);
  is(view.querySelector('[data-observation="tr-silk"]')?.textContent.includes('тъмно шоколадово'), true, 'the new value shows');
  is(JSON.stringify(await db.get('combinations', WALNUT)), JSON.stringify(combo0), 'the combination still unchanged');

  console.log('a link to a missing record breaks nothing');
  await go('#/reference/records');
  is(rows().length > 150, true, `the Records table draws (${rows().length} rows)`);
  await go('#/reference/seed:no_such_record');
  is(['#/reference', '#/reference/records'].includes(location.hash) && !failed, true,
     `a missing record goes back to the list instead of throwing (${location.hash})`);

  console.log('Records: search');
  await go('#/reference/records');
  const total = rows().length;
  await type('орех');
  is(rows().length > 0 && rows().every(r => /орех/i.test(cell(r, 2))), true, `by plant: ${rows().length} rows, all walnut`);
  const colourWord = (combo0.expected?.colourText?.bg || '').split(/[\s,]+/).find(w => w.length > 4) || 'кафяв';
  await type(colourWord);
  is(rows().length > 0 && rows().every(r => cell(r, 1).toLowerCase().includes(colourWord.toLowerCase())
     || cell(r, 2).toLowerCase().includes(colourWord.toLowerCase()) || cell(r, 3).toLowerCase().includes(colourWord.toLowerCase())),
     true, `by result colour „${colourWord}“: ${rows().length} rows`);
  await type('еко принт');
  is(rows().length > 0 && rows().every(r => /еко принт/i.test(cell(r, 3))), true, `by process „еко принт“: ${rows().length} rows`);
  await type('стипца');
  is(rows().length > 0 && rows().every(r => /стипца/i.test(cell(r, 3))), true, `by mordant „стипца“: ${rows().length} rows`);
  await type('жжжжж');
  is([rows().length, !!view.querySelector('[data-nomatch]')], [0, true], 'nothing matching says so');
  await click(view.querySelector('[data-searchclear]'));
  is(rows().length, total, 'clearing the search brings every row back');

  console.log('Records: sort');
  const coll = new Intl.Collator('bg', { sensitivity: 'base', numeric: true });
  const sorted = (xs, dir) => xs.every((x, i) => i === 0 || coll.compare(xs[i - 1], x) * dir <= 0);
  await click(view.querySelector('[data-sort="source"]'));
  is(sorted(rows().map(r => cell(r, 2)), 1), true, 'dye source ascending');
  is(view.querySelector('[data-sort="source"]').classList.contains('asc'), true, 'with its arrow');
  await click(view.querySelector('[data-sort="source"]'));
  is(sorted(rows().map(r => cell(r, 2)), -1), true, 'the second press, descending');
  await click(view.querySelector('[data-sort="colour"]'));
  is(sorted(rows().map(r => cell(r, 1)), 1), true, 'result ascending');
  await click(view.querySelector('[data-sort="colour"]'));
  is(sorted(rows().map(r => cell(r, 1)), -1), true, 'result descending');
  // The owner's order (§13fr): my test > literature > practice > needs testing.
  const order = ['мой тест', 'от литература', 'практика', 'нуждае се от тест'];
  const { CONFIDENCE_RANK } = await import('../modules/reference.js');
  is(['own_trial', 'literature', 'practice', 'unverified'].map(c => CONFIDENCE_RANK[c]), [1, 2, 3, 4],
     'the rank is own trial, literature, practice, needs testing');
  // A record of each kind is needed to see the whole order; the library ships
  // no „own trial", so one is marked for the test.
  const mine = (await db.all('combinations'))[0];
  await db.putRaw('combinations', { ...mine, confidence: 'own_trial' });
  await go('#/reference'); await go('#/reference/records');
  await click(view.querySelector('[data-sort="confidence"]'));
  let ranks = rows().map(r => order.indexOf(cell(r, 4)));
  is(ranks[0] === 0 && ranks.every((x, i) => i === 0 || ranks[i - 1] <= x) && new Set(ranks).size >= 3, true,
     `▲ strongest first: ${[...new Set(rows().map(r => cell(r, 4)))].join(' → ')}`);
  await click(view.querySelector('[data-sort="confidence"]'));
  ranks = rows().map(r => order.indexOf(cell(r, 4)));
  is(ranks[ranks.length - 1] === 0 && ranks.every((x, i) => i === 0 || ranks[i - 1] >= x), true,
     `▼ weakest first: ${[...new Set(rows().map(r => cell(r, 4)))].join(' → ')}`);
  await db.putRaw('combinations', mine);
  await click(view.querySelector('[data-sort="source"]'));
  await type('орех');
  is(rows().length > 1 && sorted(rows().map(r => cell(r, 2)), 1), true, 'the sort stays applied while searching');
  is(view.querySelector('[data-sortsel]').value, 'source:1', 'and the phone\'s sort select says the same');

  console.log('Records: with the favourites filter');
  await type('');
  const ids = rows().slice(0, 3).map(r => r.dataset.open);
  const walnutRows = (await db.all('combinations')).filter(c => c.key?.dyeSource?.plantId === 'seed:juglans_regia').map(c => c.id);
  for (const id of [...ids, walnutRows[0]]) await db.toggleFavorite('combinations', id);
  await go('#/reference'); await go('#/reference/records');
  await click(view.querySelector('[data-favonly]'));
  const favCount = rows().length;
  await type('орех');
  is(rows().length >= 1 && rows().length < favCount && rows().every(r => /орех/i.test(cell(r, 2))), true,
     `favourites, then search: ${rows().length} of ${favCount}`);
  is(!!view.querySelector('[data-favonly]')?.closest('.box')?.classList.contains('active'), true,
     'the favourites filter is still on');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('reference observations FAILED'); process.exit(1); }
console.log('reference observations passed');
process.exit(0);

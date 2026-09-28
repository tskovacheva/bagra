// try-ecoprint.mjs — the eco-print trial, as the owner actually wrote one (§13fl).
//
// The fixture is her silk-scarf trial of 25 September 2026 from her backup,
// with the photographs replaced by a one-pixel stand-in: foil, an iron blanket,
// leaves, the silk on top, rolled round a rod, steamed. Every fault this
// package fixes was found in that record — a completion date a week before the
// work, 90 and 100 swapped between temperature and time, yarrow forced into
// `flower`, the silk entered as „laying the blanket".
//
// jsdom over an empty fake IndexedDB, through the real screens.

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
await wait(1500);
const dirty = await import('../dirty.js');
const { migrateEcoprintBundleLayers } = await import('../migrations.js');
const { printSideOf, bundleFromSteps } = await import('../ecoprint-bundle.js');
const view = document.getElementById('view');
const go = async (h) => { location.hash = h; await wait(300); };
const click = async (el) => {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await wait(300);
};
const set = async (el, v, ev = 'change') => {
  if (!el) throw new Error('no field to set');
  if (el.type === 'checkbox') el.checked = v; else el.value = v;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.dispatchEvent(new dom.window.Event(ev, { bubbles: true }));
  await wait(200);
};

const PX = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const step = (id, typeCode, roleCode, what, o = {}) => ({ id, typeCode, stageCode: 'colour', techniqueId: '',
  recipeId: '', chainId: '', roleCode, what, tempC: null, heldMinutes: null, restMinutes: null, mediumMod: null,
  applicationCode: '', lines: [], photos: [], note: '', tempApprox: false, ...o });
const place = (id, plantId, partCode, facing) => ({ id, stepId: null, plantId, partCode, condition: 'fresh', facing,
  printQuality: 'sharp', localTreatment: '', resultColour: '', resultHex: '', observation: '', photo: null,
  combinationId: null, extractionMode: '' });

// Her record, as the backup of 28 September holds it.
const HERS = {
  id: 'fx-silk', origin: 'user', status: 'complete', intent: 'Еко принт', planPhotos: [],
  date: '2026-09-25', finishedOn: '2026-09-18', title: 'копринен шал', processCode: 'ecoprint',
  enhancements: [], fabricIds: [], groundFrom: null, weightOfGoodsG: 28, techniqueIds: [],
  water: { sourceCode: '', note: '' },
  steps: [
    step('s0', 'lay_base', 'barrier', 'найлоново фолио'),
    step('s1', 'lay_blanket', 'carrier_blanket', 'железен разтвор'),
    step('s2', 'arrange', '', '', { photos: [PX] }),
    step('s3', 'lay_blanket', 'receiving_cloth', 'коприната', { photos: [PX] }),
    step('s4', 'bundle', '', ''),
    step('s5', 'bundle_steam', '', '', { tempC: 90, heldMinutes: 100, tempApprox: true }),
  ],
  placements: [
    place('p0', 'seed:juglans_regia', 'leaf', 'face_down'),
    place('p1', 'seed:eucalyptus_spp', 'leaf', 'face_up'),
    place('p2', 'seed:achillea_millefolium', 'flower', 'face_down'),
  ],
  assessment: 'partial', assessmentWhy: '', repeat: 'changes', nextTime: '', resultPhotos: [], notes: '',
  createdAt: '2026-09-18T12:07:55.236Z', updatedAt: '2026-09-28T07:00:28.439Z',
};

try {
  // ---------------------------------------------------------------- migration
  console.log('an older eco-print trial gains its bundle');
  await db.putRaw('trials', structuredClone(HERS));
  await db.putRaw('trials', { ...structuredClone(HERS), id: 'fx-bath', processCode: 'immersion' });
  const stepsBefore = JSON.stringify(HERS.steps);
  await migrateEcoprintBundleLayers();
  let tr = await db.get('trials', 'fx-silk');
  is(tr.bundle.layers.map(l => [l.kind, l.what, l.stepId]),
     [['barrier', 'найлоново фолио', 's0'], ['carrier_blanket', 'железен разтвор', 's1'],
      ['plants', '', 's2'], ['receiving_cloth', 'коприната', 's3']],
     'her four construction steps become four layers, bottom to top, by their roles');
  is(JSON.stringify(tr.steps), stepsBefore, 'the steps themselves are untouched');
  is(tr.placements.map(p => p.facing), ['face_down', 'face_up', 'face_down'], 'the old facing is untouched');
  is(tr.updatedAt, HERS.updatedAt, 'a structural write: updatedAt does not move');
  is('bundle' in (await db.get('trials', 'fx-bath')), false, 'a dye-bath trial is not given a bundle');
  const snap = JSON.stringify(await db.all('trials'));
  await migrateEcoprintBundleLayers();
  is(JSON.stringify(await db.all('trials')), snap, 'a second run changes nothing');
  is(bundleFromSteps([step('x', 'lay_base', '', 'дъска')], () => 'n').layers[0].kind, 'other',
     'a laying step with no role becomes `other`, its words kept, its kind not guessed');

  // ------------------------------------------------------------- print side
  console.log('which side faced the receiving cloth');
  const layers = tr.bundle.layers;
  is(printSideOf(HERS.placements[0], layers), { code: 'back_to_receiving', how: 'derived', from: 'face_down' },
     'face down with the silk ABOVE the leaves reads as the vein side toward the silk');
  is(printSideOf(HERS.placements[1], layers).code, 'face_to_receiving', 'face up reads as the face toward it');
  const reversed = [...layers].reverse();
  is(printSideOf(HERS.placements[0], reversed).code, 'face_to_receiving',
     'the same face down with the receiving cloth BELOW means the opposite');
  const twoCloths = [...layers, { kind: 'receiving_cloth' }];
  is(printSideOf(HERS.placements[0], twoCloths).how, 'legacy', 'two receiving cloths: shown as written, not read');
  is(printSideOf(HERS.placements[0], []).how, 'legacy', 'no bundle: shown as written');
  is(printSideOf({ ...HERS.placements[0], printSide: 'face_to_receiving' }, layers),
     { code: 'face_to_receiving', how: 'set' }, 'a side chosen in the new terms wins over the old words');

  // ------------------------------------------------------------ the screens
  console.log('the working screen shows the bundle once');
  await go('#/trials/fx-silk/work');
  const rows = [...view.querySelectorAll('.layerrow select[data-layer$=".kind"]')].map(s => s.value);
  is(rows, ['barrier', 'carrier_blanket', 'plants', 'receiving_cloth'], 'the bundle card lists the four layers');
  const listed = [...view.querySelectorAll('.stagecard:not(.bundlecard) [data-step-open] .steptype')].map(x => x.textContent.trim());
  is(listed.length, 1, `and the construction steps are not listed again as steps (${listed.join(', ')})`);
  is(view.querySelectorAll('.layerprep').length, 1, 'only the blanket carries a preparation block');
  is(view.querySelectorAll('.layerphotos img').length, 2, 'the photographs of the old steps are shown beside their layers');

  // Heat treatment: labels and order.
  await click(view.querySelector('.stagecard:not(.bundlecard) [data-step-open]'));
  const fields = [...view.querySelectorAll('.steptimefields .inlinefield')].map(l => [
    l.querySelector('span').textContent.trim(), l.querySelector('input').dataset.step.split('.')[1]]);
  is(fields.slice(0, 2), [['Продължителност (мин)', 'heldMinutes'], ['Температура (°C)', 'tempC']],
     'duration comes first and says so; temperature second, with its unit in its own label');
  const typeOptions = [...view.querySelectorAll('select[data-step$=".typeCode"] option')].map(o => o.value);
  is(['lay_base', 'arrange', 'lay_blanket', 'bundle'].filter(c => typeOptions.includes(c)), [],
     'an eco-print step no longer offers the four construction types');

  // The dirty mark: edit, save, go — no warning. Then edit, go — a warning.
  console.log('saving, and the unsaved-work guard');
  // The realistic date pattern: the trial was dated the 18th with the same
  // completion date, and then its date was moved to the 25th.
  await db.putRaw('trials', { ...(await db.get('trials', 'fx-silk')), date: '2026-09-18', finishedOn: '2026-09-18' });
  await go('#/trials'); await go('#/trials/fx-silk/work');
  await click(view.querySelector('.stagecard:not(.bundlecard) [data-step-open]'));
  await set(view.querySelector('[data-f="date"]'), '2026-09-25');
  const idx = HERS.steps.findIndex(s => s.id === 's5');
  await set(view.querySelector(`[data-step="${idx}.heldMinutes"]`), '90');
  await set(view.querySelector(`[data-step="${idx}.tempC"]`), '100');
  is(dirty.isDirty(), true, '(typing marks the form unsaved)');
  await click(view.querySelector('[data-save]'));
  tr = await db.get('trials', 'fx-silk');
  const steam = tr.steps.find(s => s.id === 's5');
  is([steam.heldMinutes, steam.tempC, steam.tempApprox], [90, 100, true],
     'Duration 90 and Temperature 100 are stored as heldMinutes 90 and tempC 100, approximate kept');
  is([tr.date, tr.finishedOn], ['2026-09-25', '2026-09-25'],
     'the date moved from the 18th to the 25th, and the completion date moved with it');
  is(dirty.isDirty(), false, 'after Save the form is not marked unsaved');
  let asks = dirty.askCount();
  await click(document.querySelector('#topbar [data-go="trials"]') || document.querySelector('[data-goto="#/trials"]'));
  is(dirty.askCount(), asks, 'edit → save → leave: no warning');
  await go('#/trials/fx-silk/work');
  await set(view.querySelector('[data-f="title"]') || view.querySelector('input[type=text]'), 'копринен шал 2', 'input');
  asks = dirty.askCount();
  await click(document.querySelector('#topbar [data-go="trials"]') || document.querySelector('[data-goto="#/trials"]'));
  is(dirty.askCount(), asks + 1, 'edit → leave without saving: the warning still comes');

  // A completion date on or after the work date is hers.
  await db.putRaw('trials', { ...(await db.get('trials', 'fx-silk')), finishedOn: '2026-09-27' });
  await go('#/trials'); await go('#/trials/fx-silk/work');
  await set(view.querySelector('[data-f="date"]'), '2026-09-26');
  await click(view.querySelector('[data-save]'));
  is((await db.get('trials', 'fx-silk')).finishedOn, '2026-09-27', 'a later completion date is kept when the date moves');
  // And an earlier one chosen for past work, with the trial date untouched.
  await db.putRaw('trials', { ...(await db.get('trials', 'fx-silk')), date: '2026-09-26', finishedOn: '2025-05-12' });
  await go('#/trials'); await go('#/trials/fx-silk/work');
  await click(view.querySelector('[data-save]'));
  is((await db.get('trials', 'fx-silk')).finishedOn, '2025-05-12',
     'past work finished before it was written down keeps its finishing day when the date is not touched');

  // ----------------------------------------------- the whole scenario, typed
  console.log('the silk-scarf workflow, entered on the new screen');
  await db.putRaw('trials', { ...structuredClone(HERS), id: 'fx-new', steps: [HERS.steps[5]], placements: [],
    bundle: { layers: [], roll: '' }, finishedOn: null, weightOfGoodsG: 28 });
  await go('#/trials/fx-new/work');
  // Added in the wrong order on purpose, then put right with the arrows.
  for (const [kind, what] of [['receiving_cloth', 'копринен шал'], ['barrier', 'фолио'],
                              ['carrier_blanket', 'памучно одеяло с желязо'], ['plants', '']]) {
    await click(view.querySelector('[data-layer-add]'));
    const n = view.querySelectorAll('.layerrow').length - 1;
    view.querySelector(`[data-layer="${n}.what"]`).value = what;
    await set(view.querySelector(`[data-layer="${n}.kind"]`), kind);
  }
  // receiving, barrier, blanket, plants → barrier, blanket, plants, receiving
  await click(view.querySelector('[data-layer-down="0"]'));
  await click(view.querySelector('[data-layer-down="1"]'));
  await click(view.querySelector('[data-layer-down="2"]'));
  const prep = (k) => view.querySelector(`[data-layer-prep="1.${k}"]`);
  await set(prep('washed'), true);
  prep('treatment').value = 'потопено в железен разтвор';
  prep('duration').value = '1–2 мин';
  prep('bath').value = '3 г железни соли / ~3 л вода, обща за 5 души';
  view.querySelector('[data-f="bundle.roll"]').value = 'около дървена пръчка';
  await click(view.querySelector('[data-place-add]'));
  let pi = 0;
  const pick = view.querySelector(`[data-place="${pi}.plantId"]`);
  if (pick) pick.value = 'seed:juglans_regia';
  await set(view.querySelector(`[data-place="${pi}.printSide"]`), 'back_to_receiving');
  await click(view.querySelector('[data-place-add]'));
  pi = 1;
  const pick2 = view.querySelector(`[data-place="${pi}.plantId"]`);
  if (pick2) pick2.value = 'seed:achillea_millefolium';
  await set(view.querySelector(`[data-place="${pi}.partCode"]`), 'aerial');
  await click(view.querySelector('[data-save]'));
  const made = await db.get('trials', 'fx-new');
  is(made.bundle.layers.map(l => [l.kind, l.what]),
     [['barrier', 'фолио'], ['carrier_blanket', 'памучно одеяло с желязо'], ['plants', ''], ['receiving_cloth', 'копринен шал']],
     'foil, iron blanket, plants, silk — bottom to top, after reordering');
  is(made.bundle.layers[1].prep, { washed: true, treatment: 'потопено в железен разтвор', duration: '1–2 мин',
     bath: '3 г железни соли / ~3 л вода, обща за 5 души', note: '' }, 'the blanket\'s preparation, in her words');
  is(made.bundle.roll, 'около дървена пръчка', 'rolled around a rod');
  is(made.placements.map(p => [p.plantId, p.partCode, p.printSide || '']),
     [['seed:juglans_regia', '', 'back_to_receiving'], ['seed:achillea_millefolium', 'aerial', '']],
     'a leaf with its vein side toward the silk, and yarrow as a whole sprig');
  is(made.placements.some(p => 'facing' in p && p.facing), false, 'nothing is written into the old facing field');

  // Read view.
  await db.putRaw('trials', { ...made, status: 'complete', finishedOn: '2026-09-25' });
  await go('#/trials'); await go('#/trials/fx-new');
  const items = [...view.querySelectorAll('.layerlist li')].map(li => li.textContent.replace(/\s+/g, ' ').trim());
  is(items.length, 4, 'the read view lists the four layers');
  is(/изпрано/.test(items[1]) && /1–2 мин/.test(items[1]), true, 'with the blanket\'s preparation under it');
  await go('#/trials'); await go('#/trials/fx-silk');
  const text = view.textContent;
  is(/жилките \/ печатащата страна към приемащия плат \(стар запис: с лицето надолу\)/.test(text), true,
     'her older walnut reads as vein side toward the silk, with the words it was written in');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('eco-print FAILED'); process.exit(1); }
console.log('eco-print passed');
process.exit(0);

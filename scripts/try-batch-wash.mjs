// try-batch-wash.mjs — washing thirteen scarves at once (§13fm).
//
// The owner's case of 28 September 2026: thirteen silk scarves entered as
// unwashed, all washed that day, recorded together with no recipe. And the
// mixed case: a group that also holds a piece already washed and one already
// finished, which must not be moved back to „washed".
//
// jsdom over an empty fake IndexedDB, through the real group-action screen.

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
const { currentState } = await import('../fabric-logic.js');
const view = document.getElementById('view');
const go = async (h) => { location.hash = h; await wait(300); };
const click = async (el) => {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await wait(300);
};
const tickPiece = async (id) => {
  const cb = view.querySelector(`[data-pick="${id}"]`);
  cb.checked = true;
  cb.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await wait(120);
};
const scarf = (n, actions = []) => db.newRecord({ id: `sc-${n}`, label: `П-${String(n).padStart(3, '0')}`,
  name: 'копринен шал', composition: [{ fibreCode: 'silk', percent: 100 }], weightG: 28, state: 'unwashed', actions });
const act = (code, date, o = {}) => ({ id: `a-${code}-${date}-${Math.random().toString(36).slice(2, 6)}`, actionCode: code,
  fromStateCode: null, date, recipeId: null, chainId: null, trialId: null, batchId: null, note: '', deviation: '',
  observation: '', createdAt: date + 'T10:00:00.000Z', ...o });

try {
  console.log('thirteen unwashed scarves, washed together, no recipe');
  const ids = [];
  for (let n = 20; n < 33; n++) { await db.putRaw('fabrics', scarf(n)); ids.push(`sc-${n}`); }
  await go('#/batch');
  await click(view.querySelector('[data-action="wash"]'));
  for (const id of ids) await tickPiece(id);
  const dateInput = view.querySelector('[data-date]');
  dateInput.value = '2026-09-28';
  dateInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  view.querySelector('[data-note]').value = 'изпрани на ръка, неутрален сапун';
  await click(view.querySelector('[data-box=""]'));   // any redraw, so the summary reads the date
  const outcome = view.querySelector('[data-outcome]')?.textContent.replace(/\s+/g, ' ').trim() || '';
  is(/13 ще бъдат отбелязани като „изпран“/.test(outcome), true, `the screen says what will happen: „${outcome}“`);
  is(/без рецепта/.test(outcome) && /28/.test(outcome), true, 'with the date and „no recipe"');
  is(view.querySelector('[data-recipe]').value, '', 'no recipe is chosen');
  is(view.querySelector('[data-save]').disabled, false, 'and the action can be recorded');
  await click(view.querySelector('[data-save]'));

  const after = (await db.all('fabrics')).filter(f => ids.includes(f.id));
  is([...new Set(after.map(currentState))], ['scoured'], 'all thirteen are washed');
  const acts = after.flatMap(f => f.actions || []);
  is([acts.length, [...new Set(acts.map(a => a.actionCode))], [...new Set(acts.map(a => a.recipeId))],
      [...new Set(acts.map(a => a.date))]], [13, ['wash'], [null], ['2026-09-28']],
     'one wash action each, no recipe, on the chosen date');
  const batchIds = [...new Set(acts.map(a => a.batchId))];
  const batch = await db.get('batchActions', batchIds[0]);
  is([batchIds.length, batch?.fabricIds.length, batch?.recipeId, batch?.date, batch?.note],
     [1, 13, null, '2026-09-28', 'изпрани на ръка, неутрален сапун'],
     'one batch for all thirteen, with the date and the note');
  is(/Записано за 13 парчета/.test(document.getElementById('flash')?.textContent || ''), true, 'the screen says it was recorded');
  is(location.hash, '#/fabrics', 'and returns to the fabrics');
  is(dirty.isDirty(), false, 'with nothing left marked unsaved');
  is(ids.every(id => view.textContent.includes(`П-0${id.slice(3)}`)), true, 'the list shows the pieces without a reload');

  console.log('a mixed group: nothing moves backwards');
  await db.putRaw('fabrics', scarf(40));
  await db.putRaw('fabrics', scarf(41));
  await db.putRaw('fabrics', scarf(42, [act('wash', '2026-08-01')]));
  await db.putRaw('fabrics', scarf(43, [act('wash', '2026-07-01'), act('mordant', '2026-07-02'), act('finish', '2026-07-10')]));
  const before42 = JSON.stringify((await db.get('fabrics', 'sc-42')).actions);
  const before43 = JSON.stringify((await db.get('fabrics', 'sc-43')).actions);
  await go('#/batch');
  await click(view.querySelector('[data-action="wash"]'));
  for (const id of ['sc-40', 'sc-41', 'sc-42', 'sc-43']) await tickPiece(id);
  const out2 = view.querySelector('[data-outcome]')?.textContent.replace(/\s+/g, ' ').trim() || '';
  is(/2 ще бъдат отбелязани като „изпран“/.test(out2), true, `two will be washed: „${out2}“`);
  is(/2 вече са след това състояние/.test(out2) && /П-042/.test(out2) && /П-043/.test(out2), true,
     'and the two already past it are named');
  await click(view.querySelector('[data-save]'));
  is([currentState(await db.get('fabrics', 'sc-40')), currentState(await db.get('fabrics', 'sc-41'))],
     ['scoured', 'scoured'], 'the unwashed two advance');
  is([currentState(await db.get('fabrics', 'sc-42')), currentState(await db.get('fabrics', 'sc-43'))],
     ['scoured', 'finished'], 'the washed one stays washed, the finished one is not moved back');
  is([JSON.stringify((await db.get('fabrics', 'sc-42')).actions), JSON.stringify((await db.get('fabrics', 'sc-43')).actions)],
     [before42, before43], 'and neither gains a wash it did not have');
  is(/2 не са променени/.test(document.getElementById('flash')?.textContent || ''), true, 'the message says two were left alone');

  console.log('nothing eligible, and other actions unchanged');
  await go('#/batch');
  await click(view.querySelector('[data-action="wash"]'));
  await tickPiece('sc-43');
  is(view.querySelector('[data-save]').disabled, true, 'a wash with nothing to wash cannot be recorded');
  await click(view.querySelector('[data-action="mordant"]'));
  await tickPiece('sc-43');
  is(view.querySelector('[data-save]').disabled, false, 'mordanting a finished piece is still allowed — that is rework (§13am)');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('batch wash FAILED'); process.exit(1); }
console.log('batch wash passed');
process.exit(0);

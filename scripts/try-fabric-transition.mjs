// try-fabric-transition.mjs — a change of box on a piece's form is its own act (§13fo).
//
// It is written at once, to the SAVED piece: a batch of one and the action that
// points at it, in one transaction. What is typed in the form and not saved
// stays unsaved — in the form, and marked so. A later Save keeps the new action
// rather than writing back the history the form was opened with. „Unwashed" is
// not a change that can be made. And a write that fails writes nothing.
//
// jsdom over an empty fake IndexedDB, through the real fabric form.

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
let answer = true;
define('confirm', () => answer);
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
  const openForm = async (id) => { await go('#/fabrics'); await go(`#/fabrics/${id}/edit`); };
  const choose = async (code, date = '2026-09-28') => {
    const sel = view.querySelector('[data-newstate]');
    if (![...sel.options].some(o => o.value === code)) {
      const o = document.createElement('option'); o.value = code; o.textContent = code; sel.appendChild(o);
    }
    sel.value = code;
    sel.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    view.querySelector('[data-newstate-date]').value = date;
    await click(view.querySelector('[data-add-state]'));
  };
  const typeInto = (sel, v) => {
    const el = view.querySelector(sel);
    el.value = v;
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const batches = async () => (await db.all('batchActions')).length;
  const A = act('wash', '2026-08-01');
  await db.putRaw('fabrics', { ...scarf(1, [A]), name: 'old name', notes: 'old note' });

  console.log('„unwashed" is not a change of box');
  await openForm('sc-1');
  is(!!view.querySelector('[data-newstate] option[value="unwashed"]'), false, 'it is not offered on an existing piece');
  let nb = await batches();
  await choose('unwashed');
  let f = await db.get('fabrics', 'sc-1');
  is([f.actions.length, await batches(), currentState(f)], [1, nb, 'scoured'],
     'chosen anyway, it writes no `other`, no batch, and the piece stays where it was');
  await go('#/fabrics/new');
  is(!!view.querySelector('[data-f="state"] option[value="unwashed"]'), true, 'it is still an initial box for a new piece');

  console.log('a change of box with nothing else typed');
  await openForm('sc-1');
  const asks0 = dirty.askCount();
  await choose('mordanted');
  f = await db.get('fabrics', 'sc-1');
  is(f.actions.map(a => a.actionCode), ['wash', 'mordant'], 'the action is written at once');
  is(dirty.isDirty(), false, 'and the form is not marked unsaved by it');
  await go('#/fabrics');
  is(dirty.askCount(), asks0, 'leaving asks nothing');

  console.log('a change of box with unsaved typing beside it');
  await openForm('sc-1');
  typeInto('[data-f="name"]', 'new unsaved name');
  typeInto('[data-f="notes"]', 'new unsaved note');
  nb = await batches();
  await choose('mordanted', '2026-09-29');
  f = await db.get('fabrics', 'sc-1');
  is([f.name, f.notes], ['old name', 'old note'], 'the saved piece keeps its saved name and notes');
  is([f.actions.length, f.actions[2]?.actionCode, f.actions[2]?.date, await batches()], [3, 'mordant', '2026-09-29', nb + 1],
     'and has the new action, with a batch of one');
  is(!!(await db.get('batchActions', f.actions[2].batchId)), true, 'the action points at its batch');
  is([view.querySelector('[data-f="name"]').value, view.querySelector('[data-f="notes"]').value],
     ['new unsaved name', 'new unsaved note'], 'the form still shows what was typed');
  is(dirty.isDirty(), true, 'and is still marked unsaved');
  answer = false;
  const asks1 = dirty.askCount();
  location.hash = '#/fabrics'; await wait(300);
  is([dirty.askCount(), location.hash], [asks1 + 1, '#/fabrics/sc-1/edit'], 'leaving warns — and staying keeps the form');
  answer = true;
  await click(view.querySelector('[data-save]'));
  f = await db.get('fabrics', 'sc-1');
  is([f.name, f.notes], ['new unsaved name', 'new unsaved note'], 'Save then writes the typing');
  is(f.actions.map(a => a.id), [A.id, ...f.actions.slice(1).map(a => a.id)], '(history starts with the original action)');
  is([f.actions.length, new Set(f.actions.map(a => a.id)).size], [3, 3],
     'and keeps both actions written since — [A, B, C], each once, not the stale [A] the form was opened with');

  console.log('a write that fails writes nothing');
  await openForm('sc-1');
  typeInto('[data-f="notes"]', 'typed before the failure');
  const beforeFail = JSON.stringify(await db.get('fabrics', 'sc-1'));
  nb = await batches();
  const realPut = IDBObjectStore.prototype.put;
  let calls = 0;
  IDBObjectStore.prototype.put = function (...a) { if (++calls === 2) throw new Error('disk full'); return realPut.apply(this, a); };
  await choose('dyed');
  IDBObjectStore.prototype.put = realPut;
  is([JSON.stringify(await db.get('fabrics', 'sc-1')), await batches()], [beforeFail, nb],
     'the batch written first is rolled back with the failed piece — neither exists');
  is(/не се записа/.test(document.getElementById('flash')?.textContent || ''), true, 'and the screen says so');
  is([view.querySelector('[data-f="notes"]').value, dirty.isDirty()], ['typed before the failure', true],
     'the typing is still there, still unsaved');

  console.log('the rc113 rules hold');
  const fin = { ...scarf(9, [act('wash', '2026-05-01'), act('mordant', '2026-05-02'), act('finish', '2026-05-10')]) };
  await db.putRaw('fabrics', fin);
  await openForm('sc-9');
  await choose('scoured');
  is((await db.get('fabrics', 'sc-9')).actions.length, 3, 'a finished piece is not washed back');
  await choose('mordanted');
  f = await db.get('fabrics', 'sc-9');
  is([f.actions.length, currentState(f)], [4, 'mordanted'], 'and can still be mordanted again');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('fabric transition FAILED'); process.exit(1); }
console.log('fabric transition passed');
process.exit(0);

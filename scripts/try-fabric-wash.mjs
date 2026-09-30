// try-fabric-wash.mjs — washing one piece, by the same rule as a group (§13fn).
//
// The change-of-box field on a piece's own form. An unwashed piece can be
// washed, with no recipe, and gets one wash action. A piece already washed, or
// mordanted, dyed or finished, is not offered „washed" and — if the choice is
// forced past the disabled option — gets no event and stays where it is.
// Mordanting a finished piece again (rework, §13am) is unchanged. And the
// group action and this screen answer from one function.
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
  const { eligibleFor } = await import('../fabric-logic.js');
  const pieces = {
    raw: scarf(1),
    washed: scarf(2, [act('wash', '2026-08-01')]),
    mordanted: scarf(3, [act('wash', '2026-07-01'), act('mordant', '2026-07-02')]),
    dyed: scarf(4, [act('wash', '2026-06-01'), act('mordant', '2026-06-02'), act('dye', '2026-06-10')]),
    finished: scarf(5, [act('wash', '2026-05-01'), act('mordant', '2026-05-02'), act('finish', '2026-05-10')]),
  };
  for (const f of Object.values(pieces)) await db.putRaw('fabrics', f);

  const openForm = async (id) => { await go('#/fabrics'); await go(`#/fabrics/${id}/edit`); };
  const offer = () => view.querySelector('[data-newstate] option[value="scoured"]');
  const record = async (code, date) => {
    const sel = view.querySelector('[data-newstate]');
    // Chosen by value even when the option is disabled: the check behind the
    // disabled option is what is being tested, not only the option.
    sel.value = code;
    if (sel.value !== code) { const o = offer(); o.disabled = false; sel.value = code; }
    view.querySelector('[data-newstate-date]').value = date;
    await click(view.querySelector('[data-add-state]'));
  };

  console.log('an unwashed piece is washed');
  await openForm('sc-1');
  is(offer()?.disabled, false, '„washed" is offered');
  await record('scoured', '2026-09-28');
  let f = await db.get('fabrics', 'sc-1');
  is(currentState(f), 'scoured', 'the piece is washed');
  is(f.actions.map(a => [a.actionCode, a.date, a.recipeId]), [['wash', '2026-09-28', null]],
     'with one wash action, no recipe, on the chosen date');
  is(!!(await db.get('batchActions', f.actions[0].batchId)), true, 'belonging to a batch of one, as every action does');

  for (const which of ['washed', 'mordanted', 'dyed', 'finished']) {
    console.log(`a ${which} piece is not washed back`);
    const id = pieces[which].id;
    const before = JSON.stringify((await db.get('fabrics', id)).actions);
    const boxBefore = currentState(await db.get('fabrics', id));
    await openForm(id);
    is(offer()?.disabled, true, '„washed" is shown and disabled');
    is(/не се предлага/.test(view.textContent), true, 'with the reason under it');
    await record('scoured', '2026-09-28');
    f = await db.get('fabrics', id);
    is([currentState(f), JSON.stringify(f.actions)], [boxBefore, before],
       'forced anyway, nothing is written and the box stays');
  }

  console.log('rework is unchanged');
  await openForm('sc-5');
  await record('mordanted', '2026-09-28');
  f = await db.get('fabrics', 'sc-5');
  is([currentState(f), f.actions.length], ['mordanted', 4], 'a finished piece can still be mordanted again');

  console.log('one rule for one piece and for a group');
  for (const [which, want] of [['raw', true], ['washed', false], ['mordanted', false], ['dyed', false], ['finished', false]]) {
    const p = pieces[which];
    is(eligibleFor('wash', p), want, `wash on ${which}: ${want}`);
  }
  const batchSrc = fs.readFileSync('modules/batch.js', 'utf8');
  is(/eligibleFor\s*\}\s*from '\.\.\/fabric-logic\.js'|eligibleFor[^;]*from '\.\.\/fabric-logic\.js'/.test(batchSrc)
     && !/export function eligibleFor/.test(batchSrc), true, 'the group action imports the same function, and has no copy of its own');
  is(['tannin', 'mordant', 'iron', 'other'].every(a => eligibleFor(a, pieces.finished)), true,
     'no other action is refused on a later piece');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('fabric wash FAILED'); process.exit(1); }
console.log('fabric wash passed');
process.exit(0);

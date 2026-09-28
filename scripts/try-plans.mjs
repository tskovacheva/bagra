// try-plans.mjs — Plans v1, through the real screen (§13fj).
//
// Boots the application in jsdom over an empty fake IndexedDB and does what a
// person does: types, ticks, adds and removes lines, saves, reopens, deletes —
// then asks the database what was written, and whether a backup carries it
// back. Layout at 390 and 320px is scripts/try-plans-screens.mjs; this one has
// no layout engine and does not pretend to.
//
// Requires jsdom and fake-indexeddb, as check-boot.mjs does.

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
  url: 'https://example.org/bagra/', runScripts: 'outside-only',
});
const define = (name, value) =>
  Object.defineProperty(global, name, { value, configurable: true, writable: true });
for (const k of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Image',
  'FileReader', 'Blob', 'URL', 'Event', 'MouseEvent', 'CustomEvent', 'MutationObserver'])
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
process.on('unhandledRejection', (e) => fail('rejection: ' + (e?.message || e)));

const db = await import('../db.js');
await import('../app.js');
await wait(1500);
const { exportAll, importBackup } = await import('../backup.js');
const view = document.getElementById('view');

const go = async (hash) => { location.hash = hash; await wait(250); };
const click = async (el) => {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await wait(250);
};
const type = (sel, value) => {
  const el = view.querySelector(sel);
  if (!el) throw new Error('no field ' + sel);
  el.value = value;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const tick = (i, on) => {
  const el = view.querySelector(`[data-i="${i}.checked"]`);
  el.checked = on;
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
};
const only = async () => {
  const all = await db.all('plans');
  if (all.length !== 1) throw new Error(`expected one plan, found ${all.length}`);
  return all[0];
};

try {
  console.log('the shape');
  is(await db.all('plans'), [], 'a fresh installation has an empty plans store');

  // 1, 4. Create, with lines.
  await go('#/plans/new');
  type('[data-f="title"]', 'Сравнение на закрепители');
  type('[data-f="notes"]', 'Същото платно, същите листа.');
  view.querySelector('[data-f="status"]').value = 'planned';
  for (const text of ['N0 — без Fe', 'N5 — с 5 г Fe', '']) {
    await click(view.querySelector('[data-item-add]'));
    const inputs = view.querySelectorAll('.checkitem input[type=text]');
    inputs[inputs.length - 1].value = text;
  }
  tick(1, true);
  await click(view.querySelector('[data-save]'));
  let p = await only();
  is(Object.keys(p).sort(), ['createdAt', 'id', 'items', 'notes', 'status', 'title', 'updatedAt'],
     'a plan carries exactly its seven fields');
  is([p.title, p.status, p.notes], ['Сравнение на закрепители', 'planned', 'Същото платно, същите листа.'],
     'title, status and notes are saved as typed');
  is(p.items.map(i => [i.text, i.checked]), [['N0 — без Fe', false], ['N5 — с 5 г Fe', true]],
     'two lines are saved, the ticked one ticked, and the empty third is not kept');
  is(p.items.every(i => Object.keys(i).sort().join() === 'checked,id,text'), true,
     'a line carries exactly id, text and checked');
  is(location.hash, '#/plans', 'saving returns to the list');
  is(view.querySelector('tbody tr td.num')?.textContent.trim(), '1 / 2', 'the list shows its progress');

  // 2, 3, 5, 6. Edit everything, reopen, and look again.
  const firstStamp = p.updatedAt;
  await wait(20);
  await go('#/plans/' + p.id);
  type('[data-f="title"]', 'Сравнение на закрепители, памук');
  type('[data-f="notes"]', 'Пара 90 минути.');
  view.querySelector('[data-f="status"]').value = 'active';
  view.querySelector('[data-i="0.text"]').value = 'N0 — оригинал без Fe';
  tick(0, true);
  tick(1, false);
  await click(view.querySelector('[data-save]'));
  p = await only();
  is([p.title, p.notes, p.status], ['Сравнение на закрепители, памук', 'Пара 90 минути.', 'active'],
     'an edited title, notes and status are saved');
  is(p.items.map(i => [i.text, i.checked]), [['N0 — оригинал без Fe', true], ['N5 — с 5 г Fe', false]],
     'an edited line is saved, and a tick can be taken off as well as put on');
  is(p.updatedAt > firstStamp, true, 'saving moves updatedAt');
  await go('#/plans/' + p.id);
  is(view.querySelector('[data-f="status"]').value, 'active', 'the status reads back on reopening');

  // 7. Remove a line.
  await click(view.querySelector('[data-item-del="0"]'));
  await click(view.querySelector('[data-save]'));
  p = await only();
  is(p.items.map(i => i.text), ['N5 — с 5 г Fe'], 'a removed line is gone after saving');

  // 9, 10. Backup and restore.
  console.log('backup and restore');
  const backup = await exportAll();
  is(backup.data.plans?.map(x => x.id), [p.id], 'a backup carries the plans');
  await importBackup({ ...backup, data: { ...backup.data, plans: [] } }, 'replace');
  is(await db.all('plans'), [], '(a restore of a file with no plans in it empties the store)');
  await importBackup(backup, 'replace');
  is(await db.get('plans', p.id), p, 'a replace restore brings the plan back unchanged, updatedAt included');
  await db.removeSystem('plans', p.id);
  await importBackup(backup, 'merge');
  is(await db.get('plans', p.id), p, 'and so does a merge');

  // 11. A backup from before Plans existed.
  const old = JSON.parse(zlib.gunzipSync(fs.readFileSync('test/older-backups/bagra-1.0.0-rc56.json.gz')).toString('utf8'));
  is('plans' in old.data, false, '(the rc56 fixture has no plans store)');
  await db.removeSystem('plans', p.id);
  let threw = null;
  try { await importBackup(old, 'replace'); } catch (e) { threw = e.message; }
  is(threw, null, 'a backup without plans restores');
  is(await db.all('plans'), [], 'and the plans are an empty collection');
  // The documented rule for a store a file does not carry (§13co): it is left
  // alone, not cleared. A plan written since stays.
  await db.put('plans', p);
  await importBackup(old, 'replace');
  is((await db.all('plans')).length, 1, 'an older backup does not delete plans written since (§13co)');

  // 8. Delete, through the same dialog every other delete uses.
  console.log('deleting');
  await go('#/plans/' + p.id);
  await click(view.querySelector('[data-delete]'));
  const okBtn = document.querySelector('.modalback [data-ok]');
  is(!!okBtn, true, 'deleting asks first, in the shared confirmation dialog');
  await click(okBtn);
  is(await db.all('plans'), [], 'confirmed, the plan is gone');
  is(location.hash, '#/plans', 'and the list is shown');
  is(!!view.querySelector('.emptystate'), true, 'which says there is nothing yet');

  // 12. Both languages, and nothing the module asks for is missing.
  console.log('strings');
  const src = fs.readFileSync('i18n.js', 'utf8');
  const at = src.indexOf('\n  en: {');
  const keys = (s) => new Set([...s.matchAll(/\n\s+'([^']+)':/g)].map(m => m[1]));
  const BG = keys(src.slice(src.indexOf('\n  bg: {'), at)), EN = keys(src.slice(at));
  const used = new Set([...fs.readFileSync('modules/plans.js', 'utf8').matchAll(/\bt\('([^']+)'/g)].map(m => m[1]));
  for (const s of ['idea', 'planned', 'active', 'done']) used.add('plans.status.' + s);
  used.add('nav.plans');
  const missing = [...used].filter(k => k !== 'plans.status.' && (!BG.has(k) || !EN.has(k)));
  is(missing, [], `every one of ${used.size} keys the screen uses is in both languages`);
  const cyr = fs.readFileSync('modules/plans.js', 'utf8').split('\n')
    .filter(l => !l.trim().startsWith('//') && /[А-Яа-я]/.test(l));
  is(cyr, [], 'no Bulgarian written into the module itself');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('plans FAILED'); process.exit(1); }
console.log('plans passed');
process.exit(0);

// try-recipe-provenance.mjs — the commercial recipe library and the owner's own (§13fs).
//
// Sixteen recipes ship, each crediting the studio's practice and none naming a
// person or a book; the books stay in the Library. Seven recipes that shipped
// until rc117 are not distributed any more — and on a copy that has them, they
// are handed over to the owner, unchanged and under the same id, never removed.
//
// jsdom over an empty fake IndexedDB: a fresh install first, then an installed
// rc117 library simulated in the same database and updated.

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

const KEEP = ['silk-scour', 'cellulose-scour', 'tannin-bath', 'silk-mordant', 'cellulose-alum-soda-mordant', 'madder-dye',
  'aluminium-acetate-prep', 'aluminium-acetate-mordant', 'chalk-bath', 'pigment-lake-master', 'watercolour-from-pigment',
  'watercolour-binder', 'mordant-print-paste', 'dye-mordant-print-paste', 'compound-mordant-bright', 'oatmeal-fixing-bath'];
const PERSONAL = ['nicoleta-al-fe-impregnation', 'pastels-from-pigment', 'pastel-binder-oat', 'dye-print-paste',
  'compound-mordant-dark', 'soy-milk-bath', 'iron-bath-dark'];
const PEOPLE = /Boutrup|Ellis|Stopka|Стопка|Joanne|Грийн|Cliffe|Клиф|Kelly|Кели|Garcia|Гарсия|Maiwa|Майва|Flint|Флинт|Nicoleta|Николета|Recipe 11B|Рецепта 11B/;
const ld = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

try {
  console.log('the pack files');
  const pack = ld('seed/recipes.json');
  is(pack.recipes.map(r => r.code), KEEP, 'sixteen recipes, the agreed ones, in order');
  is(pack.retiredToPersonal, true, 'and the pack hands what it no longer carries to the owner');
  const seedText = fs.readdirSync('seed').filter(f => f.endsWith('.json')).map(f => fs.readFileSync('seed/' + f, 'utf8')).join('\n');
  is(/nicoleta|николета/i.test(seedText), false, 'no seed file names Nicoleta');
  is(pack.recipes.every(r => JSON.stringify(r.sourceCodes) === '["crafty-place-practice"]'), true,
     'every recipe credits the studio\'s practice and nothing else');
  const hits = pack.recipes.flatMap(r => PEOPLE.test(JSON.stringify([r.name, r.notes, r.steps, r.ingredients.map(i => i.note)]))
    ? [r.code] : []);
  is(hits, [], 'no recipe names a person, a book or a numbered recipe in its text');
  const sources = ld('seed/sources.json').sources.map(s => s.code);
  is(['boutrup-ellis', 'natalie-stopka-pigment', 'joanne-green-watercolour', 'nicola-cliffe-printing', 'maiwa-print-paint',
      'alison-kelly-printing', 'michel-garcia', 'crafty-place-practice'].every(c => sources.includes(c)), true,
     'the books and articles stay in the Library');
  is(sources.includes('nicoleta-practice'), false, 'the practitioner source made only for the withdrawn recipe is gone');

  console.log('the aluminium–iron mordant');
  const b = pack.recipes.find(r => r.code === 'compound-mordant-bright');
  is([b.name.bg, b.name.en], ['Алуминиево-железен закрепител за еко принт', 'Aluminium–iron mordant for eco-print'], 'renamed, same id');
  is(b.ingredients.map(i => [i.roleCode, i.quantityMin, i.quantityMax, i.options[0].substanceId]),
     [['acid_source', 200, 200, 'seed:acetic_acid'], ['aluminium_source', 20, 20, 'seed:alum_potassium_12'],
      ['modifier', 0.4, 0.8, 'seed:iron_sulfate'], ['alkali', 10, 10, 'seed:soda_ash']],
     'the tested figures: 20 % alum, 200 % vinegar, 0.4–0.8 % iron, 10 % soda');
  is(/по-тъмни и по-сиви/.test(b.notes.bg) && /test on a sample first/.test(b.notes.en), true, 'with the general note on more iron');
  is(/2[–-]4|12 ?%|12 г|12 g/.test(JSON.stringify(b)), false, 'and no trace of the darker formula');
  is(b.requiredFollowOn, ['seed:oatmeal-fixing-bath'], 'still followed by the oatmeal bath');

  console.log('a fresh install');
  const db = await import('../db.js');
  await db.setSetting('language', 'bg');
  await import('../app.js');
  await wait(2500);
  const installed = (await db.all('recipes')).filter(r => r.origin === 'seed').map(r => r.id).sort();
  is(installed, KEEP.map(c => 'seed:' + c).sort(), 'receives the sixteen and nothing else');
  is((await db.all('sources')).some(s => s.id === 'seed:nicoleta-practice'), false, 'and no practitioner source for them');
  const view = document.getElementById('view');
  location.hash = '#/recipes'; await wait(500);
  is(/подбрани и адаптирани в практиката на Crafty Place/.test(view.querySelector('[data-provenance-note]')?.textContent || ''),
     true, 'the recipe list carries the short note');
  location.hash = '#/about'; await wait(500);
  is(/не означава, че конкретна рецепта възпроизвежда дословно/.test(view.querySelector('[data-provenance]')?.textContent || ''),
     true, 'About carries the full note');

  console.log('a copy that has the rc117 library');
  const seed = await import('../seed.js');
  const packId = pack.packId;
  const old = (code, extra = {}) => ({ id: 'seed:' + code, origin: 'seed', packId, packVersion: '0.20.1',
    editedByUser: false, editedFields: [], type: 'mordant', output: 'none', scaleBy: 'weight', appliesTo: ['cellulose'],
    name: { bg: 'стара ' + code, en: 'old ' + code }, notes: { bg: 'бележка', en: 'note' }, steps: [],
    ingredients: [{ id: 'i1', roleCode: 'modifier', basis: 'percent_wof', unit: 'g', quantity: 3, quantityMin: 3, quantityMax: 3,
                    options: [] }], sourceCodes: ['nicoleta-practice'], createdAt: '2026-09-01T10:00:00.000Z', ...extra });
  for (const c of PERSONAL) await db.putSystem('recipes', old(c, c === 'soy-milk-bath'
    ? { editedByUser: true, editedFields: ['notes'], notes: { bg: 'моя бележка', en: 'my note' } } : {}));
  // Her work points at three of them, three different ways.
  await db.put('trials', db.newRecord({ id: 'zz-trial', status: 'complete', date: '2026-09-02', title: 'x', processCode: 'immersion',
    steps: [{ id: 's1', typeCode: 'mordant_bath', stageCode: 'prepare', recipeId: 'seed:iron-bath-dark', photos: [] }], placements: [] }));
  await db.put('pigmentBatches', db.newRecord({ id: 'zz-pb', status: 'done', viaKind: 'recipe', viaId: 'seed:pastels-from-pigment',
    lines: [], swatches: [] }));
  await db.put('recipes', db.newRecord({ id: 'own-madder-pigment', type: 'pigment', output: 'pigment', scaleBy: 'raw',
    name: { bg: 'Пигмент от брош', en: 'Madder pigment' }, notes: { bg: '', en: '' }, ingredients: [], steps: [] }));
  const snap = Object.fromEntries((await Promise.all(PERSONAL.map(c => db.get('recipes', 'seed:' + c)))).map(r => [r.id, r]));

  const diff = await seed.diffPack('recipes');
  is(diff.retired.map(e => e.id).sort(), PERSONAL.map(c => 'seed:' + c).sort(), 'all seven are offered as becoming hers');
  is(diff.withdrawn, [], 'none is offered for removal');
  const chosen = seed.defaultChosen(diff);
  is(PERSONAL.every(c => chosen.has('seed:' + c)), true, 'ticked, since handing over removes nothing');
  is(await seed.recordStatus('recipes', 'seed:soy-milk-bath'), { retired: true }, 'a record says it is being handed over');
  await seed.applyDiff('recipes', diff.retired.filter(e => chosen.has(e.id)), diff.pack);

  for (const c of PERSONAL) {
    const r = await db.get('recipes', 'seed:' + c);
    const was = snap['seed:' + c];
    const { origin, packId: p, packVersion: v, retiredFrom, updatedAt: u1, ...keep } = r || {};
    const { origin: o0, packId: p0, packVersion: v0, updatedAt: u0, ...keep0 } = was;
    if (!r || origin !== 'user' || p || v || retiredFrom !== packId || JSON.stringify(keep) !== JSON.stringify(keep0))
      fail(`${c}: not handed over intact — ${JSON.stringify({ origin, p, v, retiredFrom })}`);
  }
  ok('each is now hers — same id, same content, origin user, marked as retired from the pack');
  is((await db.get('recipes', 'seed:soy-milk-bath')).notes.bg, 'моя бележка', 'her edit to one of them is kept');
  is([!!(await db.get('recipes', (await db.get('trials', 'zz-trial')).steps[0].recipeId)),
      !!(await db.get('recipes', (await db.get('pigmentBatches', 'zz-pb')).viaId))], [true, true],
     'the trial and the pigment batch still find their recipes');
  is((await seed.diffPack('recipes')).retired, [], 'a second update finds nothing more to hand over');
  const all = await db.all('recipes');
  is([all.filter(r => r.origin === 'seed').length, all.filter(r => r.origin !== 'seed').length], [16, 8],
     'the copy holds the sixteen, the seven now hers, and her own madder pigment');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('recipe provenance FAILED'); process.exit(1); }
console.log('recipe provenance passed');
process.exit(0);

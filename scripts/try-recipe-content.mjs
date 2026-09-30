// try-recipe-content.mjs — the aluminium acetate working solution, reworded (§13fq),
// and the chalk bath's words (§13fr).
//
// The AA recipe keeps its id, its quantities and its scaling; only how it is
// made reads differently. The chalk bath says „the treated fabric".
//
// Data read straight from seed/, the scaling from calc/scale.js, and the AA
// recipe resolved in the real application in jsdom.

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

const ld = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const recipes = ld('seed/recipes.json').recipes;
const subs = ld('seed/substances.json').substances.map(s => ({ ...s, id: 'seed:' + s.code }));
const sources = ld('seed/sources.json').sources;
const pick = (code) => { const r = recipes.find(x => x.code === code); return r && { ...r, id: 'seed:' + code }; };
const { scaleRecipe } = await import('../calc/scale.js');
const scaled = (r, w) => scaleRecipe(r, { weightG: w, litres: 5 }, subs).ingredients
  .map(i => [i.roleCode, i.scaledAmount ?? i.scaledMin, i.scaledUnit]);

try {
  console.log('the aluminium acetate working solution');
  const aa = pick('aluminium-acetate-prep');
  is(!!aa, true, 'is still seed:aluminium-acetate-prep');
  is(aa.ingredients.map(i => [i.roleCode, i.basis, i.unit, i.quantity, i.options[0].substanceId]),
     [['aluminium_source', 'percent_wof', 'g', 18, 'seed:alum_potassium_12'],
      ['sodium_source', 'percent_wof', 'g', 10, 'seed:soda_ash'],
      ['acid_source', 'percent_wof', 'ml', 240, 'seed:acetic_acid']], 'with the same three ingredients at 18 / 10 / 240 % WOF');
  is([aa.type, aa.scaleBy, aa.appliesTo, aa.requiredFollowOn, aa.vinegarPercent],
     ['mordant', 'weight', ['cellulose', 'protein'], ['seed:aluminium-acetate-mordant'], 5], 'type, scaling, fibres, follow-on and vinegar unchanged');
  is(scaled(aa, 100), [['aluminium_source', 18, 'g'], ['sodium_source', 10, 'g'], ['acid_source', 240, 'ml']], 'scaled for 100 g as before');
  is(scaled(aa, 364), [['aluminium_source', 65.52, 'g'], ['sodium_source', 36.4, 'g'], ['acid_source', 873.6, 'ml']], 'and for 364 g');
  const st = aa.steps.map(s => s.text.bg);
  is(st.length, 5, 'five steps');
  is([/стипцата в топла вода/.test(st[0]) && !/сод|карбонат|оцет/.test(st[0]),
      /оцета/.test(st[1]) && !/карбонат|сод/.test(st[1]),
      /натриевия карбонат бавно и на малки порции/.test(st[2]),
      /CO₂/.test(st[3]),
      /работен разтвор на алуминиев ацетат/.test(st[4])], [true, true, true, true, true],
     'alum in warm water, then vinegar and water, then the soda slowly — never all at once');
  is(aa.steps.every(s => s.text.en && s.text.bg), true, 'every step in both languages');
  is(/Приготви работния разтвор непосредствено преди употреба/.test(aa.notes.bg)
     && /may foam strongly/.test(aa.notes.en) && !/чист алуминиев ацетат\./.test(aa.notes.bg.split('\n')[0]),
     true, 'the helper sentence and the safety note lead the notes');

  console.log('the chalk bath (§13fr)');
  const chalk = pick('chalk-bath');
  is([!!chalk, chalk.scaleBy, chalk.defaultLitres, chalk.heldMinutes,
      chalk.ingredients.map(i => [i.basis, i.quantity, i.unit, i.options[0].substanceId])],
     [true, 'volume', 5, 10, [['grams_per_litre', 10, 'g', 'seed:calcium_carbonate']]],
     'is still seed:chalk-bath at 10 g/L, 5 L, 10 minutes');
  is(chalk.steps.map(s => s.id), ['cb-s1', 'cb-s2', 'cb-s3'], 'with the same three steps');
  is(chalk.steps[1].text, { bg: 'Потопи обработената тъкан в банята с калциев карбонат за около 10 минути и я движи периодично.',
     en: 'Immerse the treated fabric in the calcium carbonate bath for about 10 minutes, moving it periodically.' },
     'its second step says „the treated fabric"');
  is(/алуминиев|aluminium/i.test(JSON.stringify(chalk.steps) + chalk.notes.bg.split('.')[0] + chalk.notes.en.split('.')[0]), false,
     'and nothing in its steps or opening assumes aluminium acetate');

  // Nicoleta's Al/Fe impregnation left the distributed library at rc118 — a
  // privately shared practitioner recipe is not commercial seed (§13fs). Its
  // absence and the handover to the owner are held in try-recipe-provenance.mjs.

  console.log('both, in the application');
  const db = await import('../db.js');
  await db.setSetting('language', 'bg');
  await import('../app.js');
  await wait(2500);
  const view = document.getElementById('view');
  is((await db.get('recipes', 'seed:aluminium-acetate-prep'))?.name?.bg, aa.name.bg,
     'an old recipeId pointing at seed:aluminium-acetate-prep still resolves to it');
} catch (e) {
  fail('the run stopped: ' + (e?.stack || e));
}

if (failed) { console.log('recipe content FAILED'); process.exit(1); }
console.log('recipe content passed');
process.exit(0);

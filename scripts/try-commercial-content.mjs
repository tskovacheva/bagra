// try-commercial-content.mjs — what a paying customer receives, checked (§13fx).
//
// Recipes: exactly the sixteen, by code; each credited to the studio's practice
// and nothing else; none of the seven personal recipes anywhere in what ships.
// Provenance: every source code any pack names resolves (an empty code is the
// application's own „no source", library.js); no Library note says that a
// shipped recipe's content came from a particular work — the phrases rc121 still
// carried, in both languages. Assets: the release artifact is built into a
// temporary directory and every non-code file in it has a known licence — in
// assets.json, or per photograph in photoCredit — and none is non-commercial.
//
// Fresh install and upgrade are proved by try-recipe-provenance.mjs and
// try-data-safety.mjs and are not repeated here.
//
// Run on its own:  node scripts/try-commercial-content.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);
let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const SIXTEEN = ['silk-scour', 'cellulose-scour', 'tannin-bath', 'silk-mordant', 'cellulose-alum-soda-mordant',
  'madder-dye', 'aluminium-acetate-prep', 'aluminium-acetate-mordant', 'chalk-bath', 'pigment-lake-master',
  'watercolour-from-pigment', 'watercolour-binder', 'mordant-print-paste', 'dye-mordant-print-paste',
  'compound-mordant-bright', 'oatmeal-fixing-bath'];
const PERSONAL = ['nicoleta-al-fe-impregnation', 'pastels-from-pigment', 'pastel-binder-oat', 'dye-print-paste',
  'compound-mordant-dark', 'soy-milk-bath', 'iron-bath-dark'];

// ---- recipes
const pack = read('seed/recipes.json');
const codes = pack.recipes.map(r => r.code);
JSON.stringify([...codes].sort()) === JSON.stringify([...SIXTEEN].sort()) && codes.length === 16
  ? ok('exactly the sixteen commercial recipes') : fail('the recipe pack holds ' + JSON.stringify(codes));
new Set(codes).size !== codes.length ? fail('a recipe code appears twice') : ok('no recipe code twice');
const credit = pack.recipes.filter(r => JSON.stringify(r.sourceCodes) !== JSON.stringify(['crafty-place-practice']) || r.learnedFrom);
credit.length ? fail('credited to something else: ' + credit.map(r => r.code).join(', ')) : ok('every one credited to crafty-place-practice alone');
pack.retiredToPersonal === true ? ok('the pack hands withdrawn recipes over rather than removing them') : fail('retiredToPersonal is not set');
is(pack.recipes.filter(r => r.code === 'aluminium-acetate-prep').length, 1, 'aluminium-acetate-prep is there exactly once');

// ---- provenance
const sources = read('seed/sources.json').sources;
const known = new Set(sources.map(s => s.code));
sources.length === known.size ? ok(`${known.size} sources, no code twice`) : fail('a source code appears twice');
known.has('crafty-place-practice') ? ok('crafty-place-practice is in the Library') : fail('crafty-place-practice is missing');
const dangling = [];
for (const f of fs.readdirSync('seed').filter(f => f.endsWith('.json') && f !== 'sources.json')) {
  (function walk(o, where) {
    if (Array.isArray(o)) return o.forEach(x => walk(x, where));
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'sourceCodes' || k === 'sourceCode') {
        for (const c of [].concat(v)) if (c && typeof c === 'string' && !known.has(c)) dangling.push(`${f}: ${c}`);
      } else walk(v, where);
    }
  })(read('seed/' + f), f);
}
dangling.length ? fail('source codes that resolve to nothing: ' + dangling.join(', ')) : ok('every source code in every pack resolves');

// The phrases that said a shipped recipe's content came from a particular work.
// Narrow on purpose: a note may describe what a book contains; it may not say
// that Bagra took it.
const LEAKS = [/taken from here/i, /reaches Bagra/i, /chosen for the library/i, /the version used/i,
  /взети предупрежденията/i, /идва само чрез/i, /избрана за библиотеката/i, /от него са взети/i];
const leaking = sources.flatMap(s => ['bg', 'en'].flatMap(l => LEAKS.filter(re => re.test(s.note?.[l] || ''))
  .map(re => `${s.code} (${l}): ${re}`)));
leaking.length ? fail('a Library note claims a shipped recipe came from it: ' + leaking.join('; ')) : ok('no Library note claims a shipped recipe came from it');

// ---- the release artifact, built to a temporary directory
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'bagra-release-'));
try {
  execFileSync(process.execPath, ['scripts/make-release.mjs', OUT], { stdio: 'pipe' });
  ok('the release artifact builds and checks itself');
} catch (e) { fail('make-release failed:\n' + (e.stdout || '')); }
const shipped = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p) : shipped.push(path.relative(OUT, p).split(path.sep).join('/'));
  }
})(OUT);

const blob = shipped.filter(f => /\.(js|json|html)$/.test(f)).map(f => fs.readFileSync(path.join(OUT, f), 'utf8')).join('\n');
const personalShipped = PERSONAL.filter(c => blob.includes(c));
personalShipped.length ? fail('a personal recipe is named in what ships: ' + personalShipped.join(', ')) : ok('none of the seven personal recipes is named anywhere in what ships');
/nicoleta|николет/i.test(blob) ? fail('Nicoleta is named in what ships') : ok('no private practitioner is named in what ships');

// The product is Bagra / Багра (§13gb). „Rubia" survives only where it is the
// genus — Rubia tinctorum and its relatives, Rubiaceae, a file named after one.
const PRODUCT_RUBIA = /\bRubia\b(?!\s+(?:tinctorum|peregrina|cordifolia|munjista|akane|[a-z]+\b))|\bRubia\b(?=\s*[—–-]\s|\s*·)/;
const rubia = shipped.filter(f => /\.(js|json|html)$/.test(f))
  .filter(f => fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').some(l => PRODUCT_RUBIA.test(l) && !/Rubia_/.test(l)));
rubia.length ? fail('the old product name „Rubia" is in what ships: ' + rubia.join(', ')) : ok('the product is called Bagra in everything that ships; Rubia is only the genus');
const enName = /'app\.name':\s*'([^']+)'/g;
const names = [...fs.readFileSync(path.join(OUT, 'i18n.js'), 'utf8').matchAll(enName)].map(m => m[1]);
JSON.stringify(names) === JSON.stringify(['Багра', 'Bagra']) ? ok('the window title names the product Багра / Bagra') : fail('app.name is ' + JSON.stringify(names));

const reg = read('assets.json');

// A photograph's credit, judged (§13fy). The licence must be one Bagra
// recognises for commercial distribution, its URL must be THAT licence's deed
// (derived here independently, so a wrong link fails), and an attribution
// licence needs the author, the source and what was done to the file.
// NoDerivatives is not „a commercial licence like any other": it is allowed
// only for a file listed here with the evidence that it was not adapted —
// and the list is empty.
const ND_AUDITED = {};
function deedOf(lic) {
  if (lic === 'CC0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (lic === 'Public Domain') return 'https://creativecommons.org/publicdomain/mark/1.0/';
  const m = /^CC (BY(?:-SA|-ND)?) (\d\.\d)( US)?$/.exec(lic || '');
  return m ? `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/${m[3] ? 'us/' : ''}` : null;
}
function photoProblem(c) {
  if (!c) return 'no plant credits it';
  if (!c.licence || NONCOMMERCIAL.test(c.licence)) return `licence ${JSON.stringify(c.licence)} is unknown or non-commercial`;
  if (/GFDL/.test(c.licence)) return 'distributed under the GFDL — use the CC alternative the source offers';
  const deed = deedOf(c.licence);
  if (!deed) return `licence ${JSON.stringify(c.licence)} is not one Bagra recognises`;
  if (c.licenceUrl !== deed) return `licenceUrl ${JSON.stringify(c.licenceUrl)} is not the deed of ${c.licence} (${deed})`;
  if (/-ND/.test(c.licence) && !ND_AUDITED[c.source]) return 'NoDerivatives without an audited no-adaptation record';
  if (!c.source) return 'no source';
  if (/^CC BY/.test(c.licence) && !c.author) return 'an attribution licence without an author';
  if (c.modified === 'cropped-resized' && /-ND/.test(c.licence)) return 'cropped under a NoDerivatives licence';
  if (!['resized', 'cropped-resized', 'none'].includes(c.modified)) return `modification status ${JSON.stringify(c.modified)} missing or unrecognised`;
  return '';
}
const NONCOMMERCIAL = /\bNC\b|non-?commercial|unknown|unclear|^$/i;
const plants = read('seed/plants.json').plants;
const credit2 = new Map(plants.filter(p => p.photoSrc).map(p => [p.photoSrc, p.photoCredit]));
const unlicensed = [];
for (const f of shipped) {
  if (/\.(js|json|html)$/.test(f) || f === 'sw.js') continue;           // code and first-party data
  if (f === '_headers') continue;                                         // the host's configuration, not served (§13ga)
  if (reg.licenceTexts.includes(f)) continue;
  if (f.startsWith('seed/images/plants/')) {
    const c = credit2.get(f);
    const why = photoProblem(c);
    if (why) unlicensed.push(`${f}: ${why}`);
    continue;
  }
  const e = reg.entries.find(x => f.startsWith(x.path));
  if (!e || NONCOMMERCIAL.test(e.licence)) unlicensed.push(f);
}
unlicensed.length ? fail('shipped without a known commercial licence: ' + unlicensed.join(', '))
  : ok(`every shipped asset has a known licence (${shipped.filter(f => !/\.(js|json|html)$/.test(f) && f !== '_headers').length} non-code files)`);
// The GFDL text ships if and only if something ships under the GFDL (§13fy).
// rc123 moved both GFDL photographs to the CC licences their sources also
// offer, so neither the text nor the licence is in the release.
const gfdl = shipped.filter(f => /GFDL/.test(credit2.get(f)?.licence || ''));
const gfdlText = shipped.some(f => /GFDL/i.test(f));
gfdl.length === 0 && !gfdlText ? ok('nothing ships under the GFDL, and neither does its text')
  : gfdl.length && gfdlText ? ok('the GFDL text ships with its photographs')
  : fail(gfdl.length ? 'GFDL photographs ship without the GFDL text' : 'the GFDL text ships with nothing licensed under it');
reg.entries.some(e => e.path === 'index.html#sprite') && shipped.includes('licences/LICENSE-lucide.txt')
  ? ok('the icon sprite is registered and its licence notice ships') : fail('the icon sprite has no registered licence or its notice is missing');
fs.rmSync(OUT, { recursive: true, force: true });

function is(got, want, m) { JSON.stringify(got) === JSON.stringify(want) ? ok(m) : fail(`${m} — ${JSON.stringify(got)}`); }
console.log(failed ? 'commercial content FAILED' : 'commercial content passed');
process.exit(failed ? 1 : 0);

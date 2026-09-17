// try-language.mjs — the language package's guards (§13eh), step 1 of five.
//
//   node scripts/try-language.mjs              ratchet: a NEW fault fails, a known one is counted
//   node scripts/try-language.mjs --strict     every fault fails, known or not (the 1.0 run)
//   node scripts/try-language.mjs --list       print every finding, grouped
//   node scripts/try-language.mjs --write-known      rewrite test/language/known-gaps.json
//   node scripts/try-language.mjs --accept-data      rewrite test/language/data-fingerprint.json
//
// WHY A RATCHET. rc66 ships 603 reference fields with no English, ten duplicate
// dictionary keys and more besides. A guard that fails on all of them blocks every
// release until the whole package is done; a guard that passes on all of them is
// not a guard. So the known faults are LISTED, by name, in known-gaps.json:
//
//   - a finding not on the list fails            (a new fault cannot slip in)
//   - a listed finding that is no longer found fails  (the list cannot go stale —
//     a fixed fault must be crossed off, so the list always says what is left)
//   - --strict fails on the list itself          (1.0 ships with the list empty)
//
// Exceptions are different from gaps. exceptions.json holds findings that are
// RIGHT — a Bulgarian book title cited in an English section — each with a reason.
// An exception whose finding no longer exists fails too.
//
// WHAT IS NOT CHECKED HERE. Whether the English is good. `bg === en` is not an
// error and is not treated as one: a botanical name, a citation or a hex value is
// the same in both. This finds the English that is ABSENT, or not English, or
// written in the wrong English — never the English that is merely poor.
//
// THE FINGERPRINT (task 8, items 5 and 6). Every seed record is hashed with the
// text of each {bg, en} pair blanked out. Numbers, codes, ids, temperatures,
// percentages, the order of steps, the shape of the record — all of it is in the
// hash; the words are not. Language work that moves a single figure in a recipe,
// or turns a pair into a plain string, fails here and names the record. A
// deliberate data change is accepted with --accept-data, which prints what moved.

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ARGS = new Set(process.argv.slice(2));
const STRICT = ARGS.has('--strict');
const DIR = 'test/language';
const KNOWN_FILE = `${DIR}/known-gaps.json`;
const EXC_FILE = `${DIR}/exceptions.json`;
const PRINT_FILE = `${DIR}/data-fingerprint.json`;

const CYRILLIC = /[\u0400-\u04FF]/;
// Letters of the Cyrillic block that Bulgarian does not use. „адјективно" was
// written with the Serbian ј and reads correctly on screen, which is exactly why
// nobody saw it: it does not match a search for the word it looks like.
// NOT ѝ or Ѝ: the pronoun „ѝ" is correct Bulgarian and is on the list of letters
// the first version of this check wrongly refused (five dictionary strings).
const FOREIGN_CYRILLIC = /[\u0400-\u040C\u040E\u040F\u0450-\u045C\u045E\u045F\u0460-\u04FF]/;
// Bulgarian opening quote in English text. English uses “ ” or " ".
const LOW_QUOTE = /„/;
// British English (the owner's standard). Only forms that are unambiguously
// American; `-ize` is British too and is not on the list. `meter` is not either:
// a pH meter is a meter in Britain.
const US_SPELLING = [
  [/\bcolor/i, 'color'], [/\bfiber/i, 'fiber'], [/\bgray/i, 'gray'],
  [/\baluminum/i, 'aluminum'], [/\bfavorite/i, 'favorite'], [/\bcenter/i, 'center'],
  [/\bliters?\b/i, 'liter'], [/\bmold(s|ed|ing)?\b/i, 'mold'], [/\bcatalog\b/i, 'catalog'],
];

// „Mordant" in Bulgarian (§13ej, the owner's decision of 16 September 2026). The
// interface says „закрепител"; „мордант" may stand only as an explanation IN
// BRACKETS straight after it — „Закрепител (мордант)", „обработка със закрепител
// (в литературата — мордантиране)". Search aliases are plain strings and are not
// read here, so the word stays findable. Every inflection is caught: мордант,
// морданта, мордантът, морданти, мордантен, мордантиран, мордансиран.
const EXPLAINED = /закрепител[\p{L}]*\s*\([^)]*\)/giu;
const MORDANT_WORD = /(^|[^\p{L}])(морд[\p{L}]*)/iu;
// The terms the decision replaced, which must not come back into the interface.
const RETIRED = /(^|[^\p{L}])(закрепващ[\p{L}]*\s+средств[\p{L}]*|байц[\p{L}]*)/iu;
function standaloneMordant(bg) {
  const m = String(bg).replace(EXPLAINED, ' ').match(MORDANT_WORD);
  return m ? m[2] : null;
}
function retiredTerm(bg) {
  const m = String(bg).replace(EXPLAINED, ' ').match(RETIRED);
  return m ? m[2] : null;
}

const findings = new Map();   // id -> detail
const add = (category, id, detail = '') => findings.set(`${category} | ${id}`, String(detail).replace(/\s+/g, ' '));

// ---------------------------------------------------------------- dictionary

const src = fs.readFileSync('i18n.js', 'utf8');
const dictStart = src.indexOf('const DICT = {');
const dictEnd = src.indexOf('\n};', dictStart);
const DICT = vm.runInNewContext('(' + src.slice(dictStart + 'const DICT = '.length, dictEnd + 2) + ')');
const bgAt = src.indexOf('  bg: {', dictStart);
const enAt = src.indexOf('  en: {', dictStart);

for (const [lang, from, to] of [['bg', bgAt, enAt], ['en', enAt, dictEnd]]) {
  // Duplicates are invisible to the evaluated object — the last one silently wins —
  // so they are counted from the text.
  const seen = new Map();
  for (const m of src.slice(from, to).matchAll(/^\s*'([a-zA-Z0-9_.\-]+)'\s*:\s*(.*)$/gm)) {
    const [, key, rest] = m;
    if (seen.has(key)) {
      const same = seen.get(key).replace(/,\s*$/, '') === rest.replace(/,\s*$/, '');
      add('dict.duplicate', `${lang}:${key}`, same ? 'same text twice' : 'two different texts; the LAST is what the screen shows');
    }
    seen.set(key, rest);
  }
}
// A letter check on the TEXT as well as on the evaluated object: a value shadowed
// by a later duplicate is invisible to the object, and it is still in the file,
// one deletion away from being the one on screen.
for (const m of src.slice(bgAt, enAt).matchAll(/^\s*'([a-zA-Z0-9_.\-]+)'\s*:\s*(.*)$/gm)) {
  if (FOREIGN_CYRILLIC.test(m[2]) && !FOREIGN_CYRILLIC.test(DICT.bg[m[1]] ?? '')) add('dict.foreignLetter', `${m[1]} (shadowed copy)`, m[2].slice(0, 80));
}
for (const key of new Set([...Object.keys(DICT.bg), ...Object.keys(DICT.en)])) {
  const bg = DICT.bg[key], en = DICT.en[key];
  if (bg === undefined) add('dict.onlyEnglish', key);
  if (en === undefined) { add('dict.onlyBulgarian', key); continue; }
  if (typeof en !== 'string' || typeof bg !== 'string') { add('dict.notText', key); continue; }
  if (!en.trim() && bg.trim()) add('dict.emptyEnglish', key);
  if (standaloneMordant(bg)) add('term.mordantInInterface', `dict ${key}`, bg.slice(0, 80));
  if (retiredTerm(bg)) add('term.retiredInInterface', `dict ${key}`, retiredTerm(bg));
  if (CYRILLIC.test(en)) add('dict.cyrillicInEnglish', key, en.slice(0, 80));
  if (FOREIGN_CYRILLIC.test(bg)) add('dict.foreignLetter', key, bg.slice(0, 80));
  if (LOW_QUOTE.test(en)) add('dict.bulgarianQuoteInEnglish', key, en.slice(0, 80));
  for (const [re, word] of US_SPELLING) if (re.test(en)) add('dict.usSpelling', `${key}:${word}`, en.slice(0, 80));
}

// ---------------------------------------------------------------- vocabulary

const { VOCABULARY } = await import(process.cwd() + '/vocab.js');
const vocabSeen = new Set();
for (const v of VOCABULARY) {
  const id = `${v.dimension}:${v.code}`;
  if (vocabSeen.has(id)) add('vocab.duplicate', id);
  vocabSeen.add(id);
  for (const [field, pair] of [['label', v.label], ['description', v.description]]) {
    if (!pair) continue;
    checkPair('vocab', `${id} ${field}`, pair);
  }
}

// ---------------------------------------------------------------- seed

function isPair(o) { return o && typeof o === 'object' && !Array.isArray(o) && 'bg' in o; }

function checkPair(scope, id, pair) {
  const extra = Object.keys(pair).filter(k => k !== 'bg' && k !== 'en');
  if (extra.length || typeof pair.bg !== 'string' || (pair.en !== undefined && typeof pair.en !== 'string')) {
    add(`${scope}.badPair`, id, `keys ${Object.keys(pair).join(',')}`);
    return;
  }
  const bg = pair.bg, en = pair.en ?? '';
  if (bg.trim() && !en.trim()) add(`${scope}.untranslated`, id, bg.slice(0, 80));
  // The vocabulary and the glossary ARE interface: a label, a term, the words a
  // definition is read in. Reference prose in the other packs is ratcheted and
  // corrected record by record in steps 3 to 5.
  const iface = scope === 'vocab' || id.startsWith('glossary.json:');
  const mw = standaloneMordant(bg);
  if (mw) add(iface ? 'term.mordantInInterface' : 'seed.mordantInProse', id, mw);
  const rw = retiredTerm(bg);
  if (rw) add(iface ? 'term.retiredInInterface' : 'seed.retiredTermInProse', id, rw);
  if (CYRILLIC.test(en)) add(`${scope}.cyrillicInEnglish`, id, en.slice(0, 80));
  if (FOREIGN_CYRILLIC.test(bg)) add(`${scope}.foreignLetter`, id, bg.slice(0, 80));
  // One word in two scripts: „Гram" — a Latin r, a and m inside a Cyrillic word.
  // It reads correctly, so no one sees it; it does not match a search for the word
  // it looks like (§13em). A formula such as FeSO₄ has no Cyrillic and is not caught.
  for (const [lang, v] of [['bg', bg], ['en', en]]) {
    const w = String(v).match(/[\p{L}]*(?:[а-яА-ЯёЁ][a-zA-Z]|[a-zA-Z][а-яА-ЯёЁ])[\p{L}]*/u);
    if (w) add(`${scope}.mixedScriptWord`, `${id} ${lang}`, w[0]);
  }
  if (LOW_QUOTE.test(en)) add(`${scope}.bulgarianQuoteInEnglish`, id, en.slice(0, 80));
  for (const [re, word] of US_SPELLING) if (re.test(en)) add(`${scope}.usSpelling`, `${id}:${word}`, en.slice(0, 80));
}

// A path named by meaning where the array has one: `sections[Източници].body`
// survives a section being inserted above it; `sections[3].body` would not, and
// every such insertion would read as one gap fixed and a new one opened.
function step(parent, key, i, item) {
  if (item && typeof item === 'object') {
    if (typeof item.code === 'string') return `${key}[${item.code}]`;
    if (typeof item.partCode === 'string') return `${key}[${item.partCode}]`;
    if (isPair(item.title)) return `${key}[${item.title.bg}]`;
    if (typeof item.factor === 'string') return `${key}[${item.factor}#${i}]`;
  }
  return `${key}[${i}]`;
}

function walkRecord(scope, id, node, path) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkRecord(scope, id, item, step(node, path, i, item)));
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (isPair(node)) { checkPair(scope, `${id} ${path}`, node); return; }
  for (const [k, v] of Object.entries(node)) walkRecord(scope, id, v, path ? `${path}.${k}` : k);
}

// Blank the words, keep everything else — including whether a pair IS a pair.
function withoutWords(node) {
  if (Array.isArray(node)) return node.map(withoutWords);
  if (!node || typeof node !== 'object') return node;
  if (isPair(node)) {
    const extra = Object.keys(node).filter(k => k !== 'bg' && k !== 'en');
    return extra.length ? Object.fromEntries(Object.entries(node).map(([k, v]) => [k, withoutWords(v)])) : '<pair>';
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, withoutWords(v)]));
}
const hash = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

const print = {};
const SEED_FILES = fs.readdirSync('seed').filter(f => f.endsWith('.json')).sort();
for (const file of SEED_FILES) {
  const json = JSON.parse(fs.readFileSync(`seed/${file}`, 'utf8'));
  const scope = 'seed';
  for (const [top, value] of Object.entries(json)) {
    if (Array.isArray(value)) {
      value.forEach((rec, i) => {
        const code = rec?.code ?? rec?.id ?? `#${i}`;
        walkRecord(scope, `${file}:${code}`, rec, '');
        print[`${file}:${top}:${code}`] = hash(withoutWords(rec));
      });
      print[`${file}:${top}:#order`] = hash(value.map((r, i) => r?.code ?? r?.id ?? i));
    } else if (top !== 'packVersion') {
      // packVersion moves with any change to the pack, including a translation;
      // it is held in step with the manifest by try-manifest-agrees.mjs.
      walkRecord(scope, `${file}:${top}`, value, '');
      print[`${file}:#${top}`] = hash(withoutWords(value));
    }
  }
}
print['vocab.js:#entries'] = hash(VOCABULARY.map(v => ({ ...v, label: '<pair>', description: v.description ? '<pair>' : null })));

// ---------------------------------------------------------------- hard-coded text

// A Bulgarian word written straight into a module reaches the English screen
// whatever the dictionary says. Found by line CONTENT, not number: a line number
// moves with every edit above it and would churn the list for no reason.
const MODULE_FILES = fs.readdirSync('modules').map(f => 'modules/' + f)
  .concat(['app.js', 'ui.js', 'seed-ui.js', 'backup.js', 'photo.js', 'fabric-logic.js', 'units.js', 'recipe-lines.js', 'stock-logic.js'])
  .filter(f => f.endsWith('.js') && fs.existsSync(f));
for (const f of MODULE_FILES) {
  let inBlock = false;
  for (const raw of fs.readFileSync(f, 'utf8').split('\n')) {
    const line = raw.trim();
    if (inBlock) { if (line.includes('*/')) inBlock = false; continue; }
    if (line.startsWith('/*') && !line.includes('*/')) { inBlock = true; continue; }
    if (line.startsWith('//') || line.startsWith('*')) continue;
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (CYRILLIC.test(code)) add('code.cyrillic', `${f}: ${code.slice(0, 100)}`);
  }
}

// ---------------------------------------------------------------- verdict

const readJson = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;

if (ARGS.has('--accept-data')) {
  const old = readJson(PRINT_FILE, {});
  const moved = Object.keys({ ...old, ...print }).filter(k => old[k] !== print[k]);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(PRINT_FILE, JSON.stringify(print, null, 1) + '\n');
  console.log(`data fingerprint written: ${Object.keys(print).length} entries, ${moved.length} changed`);
  moved.slice(0, 40).forEach(k => console.log('   ', k));
  process.exit(0);
}
if (ARGS.has('--write-known')) {
  const exc = new Set(readJson(EXC_FILE, { exceptions: [] }).exceptions.map(e => e.id));
  const known = [...findings.keys()].filter(k => !exc.has(k)).sort();
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(KNOWN_FILE, JSON.stringify({
    note: 'Language faults known at the time of writing. Each one must be crossed off when fixed; the guard fails on a line that is no longer true. 1.0 ships with this list empty (--strict).',
    gaps: known,
  }, null, 1) + '\n');
  console.log(`known gaps written: ${known.length}`);
  process.exit(0);
}

let failed = false;
const fail = (msg) => { failed = true; console.log('FAIL ' + msg); };

const exceptions = readJson(EXC_FILE, { exceptions: [] }).exceptions;
const excIds = new Set(exceptions.map(e => e.id));
for (const e of exceptions) {
  if (!e.reason || !String(e.reason).trim()) fail(`exception with no reason: ${e.id}`);
  if (!findings.has(e.id)) fail(`exception no longer matches anything — remove it: ${e.id}`);
}
const known = new Set(readJson(KNOWN_FILE, { gaps: [] }).gaps);

const byCategory = {};
for (const [id, detail] of findings) {
  if (excIds.has(id)) continue;
  const cat = id.split(' | ')[0];
  (byCategory[cat] ||= { known: 0, fresh: [] });
  if (known.has(id)) {
    byCategory[cat].known++;
    if (STRICT) fail(`${id}${detail ? '  — ' + detail : ''}`);
  } else {
    byCategory[cat].fresh.push(id);
    fail(`NEW ${id}${detail ? '  — ' + detail : ''}`);
  }
}
for (const id of known) {
  if (!findings.has(id)) fail(`fixed but still listed — cross it off known-gaps.json: ${id}`);
}

const baseline = readJson(PRINT_FILE, null);
if (!baseline) fail(`no data fingerprint at ${PRINT_FILE}`);
else {
  const moved = Object.keys({ ...baseline, ...print }).filter(k => baseline[k] !== print[k]);
  for (const k of moved.slice(0, 20)) {
    const what = !(k in baseline) ? 'a record that was not there'
      : !(k in print) ? 'a record that is gone'
      : k.startsWith('seed/recipes.json') || k.startsWith('recipes.json') ? 'a figure, code or shape in a RECIPE changed'
      : 'a figure, code or shape changed';
    fail(`data: ${k} — ${what}. Language work does not move data; if this was meant, --accept-data`);
  }
  if (moved.length > 20) fail(`data: ${moved.length - 20} more records changed`);
}

if (ARGS.has('--list')) {
  const grouped = {};
  for (const [id, detail] of findings) {
    if (excIds.has(id)) continue;
    const [cat, rest] = id.split(' | ');
    (grouped[cat] ||= []).push(rest + (detail ? '  — ' + detail : ''));
  }
  for (const [cat, rows] of Object.entries(grouped)) {
    console.log(`\n${cat} (${rows.length})`);
    rows.forEach(r => console.log('   ' + r));
  }
}

const summary = Object.entries(byCategory).map(([c, v]) => `${c} ${v.known}${v.fresh.length ? '+' + v.fresh.length + ' NEW' : ''}`);
console.log(`  language: ${findings.size - excIds.size} findings, ${excIds.size} documented exceptions; known and not yet fixed — ${summary.join(', ') || 'none'}`);
console.log(`  language: data fingerprint over ${Object.keys(print).length} records and headers`);
// exitCode, not exit(): a piped stdout is written asynchronously, and exit() cut
// the strict run's list off at 399 of its 641 lines — the verdict was right and
// the evidence under it was not all there.
if (failed) { console.log(STRICT ? 'language check FAILED (strict: 1.0 needs the known list empty)' : 'language check FAILED'); process.exitCode = 1; }
else console.log('language check passed');

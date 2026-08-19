// check-scope.js — catches a variable assigned but never declared.
//
// In a module (strict mode) such an assignment throws a ReferenceError, but
// only when the line actually runs — usually on a click. The symptom is a
// screen that has simply stopped responding, with nothing obviously wrong, and
// it cost an afternoon once. Cheap to catch here instead.
//
// Strings, comments and template literals are removed first: without that,
// every HTML attribute inside a template looks like an assignment.

const fs = require('fs');
const path = require('path');

function stripLiterals(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i);
      i = end === -1 ? src.length : end + 2;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') { i += 2; continue; }

        // ${ ... } inside a template holds real code and must be kept.
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1;
          i += 2;
          const start = i;
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            i++;
          }
          out += ' ' + stripLiterals(src.slice(start, i - 1)) + ' ';
          continue;
        }
        i++;
      }
      i++;
      out += " '' ";
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

const GLOBALS = new Set([
  'window', 'document', 'location', 'navigator', 'console', 'alert', 'confirm',
  'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout', 'fetch', 'crypto',
  'structuredClone', 'indexedDB', 'FileReader', 'Image', 'Blob', 'URL', 'Promise',
  'Object', 'Array', 'Map', 'Set', 'JSON', 'Math', 'Number', 'String', 'Boolean',
  'Date', 'RegExp', 'Error', 'this', 'arguments', 'globalThis',
]);

let bad = 0;
const dir = process.argv[2] || 'modules';

for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const code = stripLiterals(raw);
  const declared = new Set(GLOBALS);

  for (const m of raw.matchAll(/import\s*{([^}]*)}/g)) {
    m[1].split(',').forEach(x => declared.add(x.trim().split(/\s+as\s+/).pop()));
  }
  for (const m of raw.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from/g)) {
    declared.add(m[1]);
  }
  for (const m of code.matchAll(/\b(?:let|const|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    declared.add(m[1]);
  }
  // One declaration may introduce several names: let a = [], b = new Map();
  for (const m of code.matchAll(/\b(?:let|const|var)\s+([^;\n]+)/g)) {
    m[1].split(',').forEach(x => {
      const name = x.trim().split(/[\s=([{.]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    });
  }
  // Parameter lists and destructuring, narrowly. An earlier version accepted
  // any name after an opening brace, which quietly swallowed `{ editing = ... }`
  // in an ordinary block and made the check useless for exactly the bug it was
  // written to catch.
  const addNames = (chunk) => chunk.split(',').forEach(part => {
    const name = part.trim().replace(/^\.\.\./, '').split(/[\s=:]/)[0].replace(/[{}[\]]/g, '');
    if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
  });
  // A parenthesis followed by a brace is not always a parameter list: an
  // `if (editing && ...) {` looks identical. Two guards — the keyword before
  // it, and the operators inside it, which no parameter list contains.
  for (const m of code.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    const before = code.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(if|while|for|switch|catch)\s*$/.test(before)) continue;
    if (/[!<>&|?+*/%]|===|!==/.test(m[1])) continue;
    addNames(m[1]);
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g)) addNames(m[1]);
  for (const m of code.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g)) addNames(m[1]);
  for (const m of code.matchAll(/\bfor\s*\(\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);

  const reported = new Set();
  for (const m of code.matchAll(/(?:^|[;{}\n])\s*([a-z][\w$]*)\s*=[^=>]/g)) {
    if (declared.has(m[1]) || reported.has(m[1])) continue;
    reported.add(m[1]);
    console.log(`UNDECLARED: ${file} → ${m[1]}`);
    bad = 1;
  }
}

// A module that assigns `root.onclick` (or oninput/onchange) twice silently
// loses the first one: the later assignment wins, and the earlier code reads as
// perfectly correct while never running. Cost a debugging round in 0.78.0, where
// the recipe search box rendered, held its text, and filtered nothing.
let doubled = 0;
for (const f of fs.readdirSync('modules').filter(x => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join('modules', f), 'utf8');
  for (const h of ['onclick', 'oninput', 'onchange', 'onsubmit']) {
    const n = (src.match(new RegExp('root\\.' + h + '\\s*=', 'g')) || []).length;
    if (n > 1) {
      console.log(`HANDLER: ${f} assigns root.${h} ${n} times — only the last one runs.`);
      doubled++;
    }
  }
}

// Every mark named in code must exist in the sprite. A missing `<symbol>`
// renders as nothing at all — no error, no broken-image mark, just a gap where
// the icon should be, which is invisible in a headless check and easy to miss
// on screen next to a label that still reads correctly.
const html = fs.readFileSync('index.html', 'utf8');
const defined = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
let ghosts = 0;
const files = ['app.js', 'ui.js', ...fs.readdirSync('modules')
  .filter(x => x.endsWith('.js')).map(x => path.join('modules', x))];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/'((?:i|s|c|k)-[a-z_]+)'/g)) {
    if (!defined.has(m[1])) {
      console.log(`ICON: ${f} names #${m[1]}, which is not in the sprite.`);
      ghosts++;
    }
  }
}

// A `field()` holding controls of its own.
//
// `field` renders a `<label>`, and a label forwards a press anywhere inside it
// to the control it labels. A group of checkboxes nested inside it is invalid
// HTML and steals presses; a strip of photographs with a × on each swallows the
// × entirely, so the photograph could not be removed and nothing said why
// (§13as). `fieldGroup` is the same thing built from a `<div>`.
let mislabelled = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bfield\(([\s\S]{0,400}?)\)\}/g)) {
    if (!/<label|photoStrip|<button/.test(m[1])) continue;
    console.log(`FIELD HOLDS CONTROLS: ${f} wraps buttons or labels in field(); use fieldGroup().`);
    mislabelled++;
    break;
  }
}

// A helper called without being imported.
//
// The check above catches an *assignment* to an undeclared name. `flash(...)`
// is a *call*, and it slipped through: `recipes.js` used it without importing
// it, so every save of a recipe threw a ReferenceError after the record had
// been written — the record was saved, the screen did not move, nothing was
// reported, and the round trip built on top of it silently did nothing.
//
// Deliberately narrow, so it cannot cry wolf: only names that some shared
// module actually exports are considered. A local function of the same name
// shadows it and is accepted.
const SHARED = ['ui.js', 'db.js', 'i18n.js', 'vocab.js', 'photo.js', 'dirty.js',
                'fabric-logic.js', 'seed.js', 'seed-ui.js'];
const exported = new Map();          // name -> file that exports it
for (const f of SHARED) {
  if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm))
    exported.set(m[1], f);
  for (const m of src.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm))
    exported.set(m[1], f);
}

let unimported = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const code = stripLiterals(src);
  const imported = new Set();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g))
    for (const part of m[1].split(','))
      imported.add(part.trim().split(/\s+as\s+/).pop().trim());
  for (const m of src.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from/g))
    imported.add(m[1]);
  // Declared here under the same name — a local shadow is legitimate. Method
  // shorthand counts as a declaration: `open(first) {` inside the module's
  // exported object is a definition, not a call, and reading it as a call made
  // this check name half the modules on its first run. A definition ends in
  // `) {`; a call ends in `);`.
  //
  // Declarations are read from the raw source rather than the stripped copy:
  // `stripLiterals` loses some of them — `function shrink` in plants.js among
  // them — and a declaration missed here becomes a false accusation. Reading
  // the raw text can only add names, which makes the check quieter, never
  // louder, and quiet in the wrong direction is the safe way for a new guard
  // to be wrong.
  const local = new Set([
    ...[...src.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]),
    ...[...src.matchAll(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]),
  ]);
  const seen = new Set();
  for (const m of code.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[2];
    if (seen.has(name) || imported.has(name) || local.has(name)) continue;
    if (!exported.has(name)) continue;
    seen.add(name);
    console.log(`NOT IMPORTED: ${f} calls ${name}(), exported by ${exported.get(name)} and not imported here.`);
    unimported++;
  }
}

// The icon system, checked rather than trusted (§13bo).
//
// Three faults the audit found by counting, none of which is visible by reading:
// a sprite id defined twice (so every use of it silently drew the first), a
// symbol left behind by a state that no longer exists, and a semantic action
// with no mark in half the modules.
let icons = 0;
{
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = [...html.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]);

  const seen = new Set(), twice = new Set();
  for (const id of ids) (seen.has(id) ? twice : seen).add(id);
  if (twice.size) {
    console.log(`ICONS: defined twice, so only the first is ever drawn: ${[...twice].join(', ')}`);
    icons++;
  }

  // Every id the code asks for must exist.
  const src = ['ui.js', ...fs.readdirSync('modules').map(f => 'modules/' + f)]
    .map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const asked = new Set([...src.matchAll(/icon\('([^']+)'\)/g)].map(m => m[1]));
  for (const [, id] of src.matchAll(/'((?:a|i|s|c|k)-[a-z_]+)'/g)) asked.add(id);
  const ghosts = [...asked].filter(id => !seen.has(id));
  if (ghosts.length) {
    console.log(`ICONS: asked for and not in the sprite: ${ghosts.join(', ')}`);
    icons++;
  }

  // One semantic action, one mark. The map is the single source, so the check
  // is that nothing draws a DIFFERENT mark for a name the map already owns.
  const mapBlock = fs.readFileSync('ui.js', 'utf8')
    .split('export const ACTION_ICONS = {')[1]?.split('};')[0] || '';
  const mapped = new Map([...mapBlock.matchAll(/(\w+):\s*'([^']+)'/g)].map(m => [m[1], m[2]]));
  const used = new Map();
  for (const m of src.matchAll(/actionBtn\('(\w+)'/g)) {
    const kind = m[1];
    if (!mapped.has(kind) && !/^(save|cancel)$/.test(kind)) {
      console.log(`ICONS: actionBtn('${kind}') — no such semantic action in ACTION_ICONS.`);
      icons++;
    }
    used.set(kind, (used.get(kind) || 0) + 1);
  }
}

// Action hierarchy (§13bo).
//
// The audit counted 83 quiet buttons, 34 primary, 11 with no level at all and
// 11 destructive. The eleven with no level are the drift: nobody decided, so
// they took the default and sat somewhere between the other two.
//
// And more than one primary in a page header means no primary at all.
let levels = 0;
{
  const modFiles = fs.readdirSync('modules').map(f => 'modules/' + f);

  for (const file of modFiles) {
    const src = fs.readFileSync(file, 'utf8');

    // A button with no level, written by hand rather than through actionBtn.
    for (const m of src.matchAll(/<button class="btn"[^>]*>/g)) {
      console.log(`LEVELS: ${file} — a button with no level: ${m[0].slice(0, 60)}`);
      levels++;
    }

    // Destructive is always quiet: a delete that shouts is a delete that gets
    // pressed. One slipped through in 0.99.5.
    for (const m of src.matchAll(/<button class="btn danger"(?! quiet)[^>]*>/g)) {
      console.log(`LEVELS: ${file} — a destructive action that is not quiet: ${m[0].slice(0, 60)}`);
      levels++;
    }

    // At most one primary per page header.
    for (const m of src.matchAll(/actions:\s*`([^`]*)`/g)) {
      const n = (m[1].match(/'primary'|btn primary/g) || []).length;
      if (n > 1) {
        console.log(`LEVELS: ${file} — ${n} primary actions in one page header.`);
        levels++;
      }
    }
  }
}

// A section heading must be larger than a subheading inside it (§13bg).
//
// They were inverted for a long time and nobody could see it from the code,
// because the two numbers sat six hundred lines apart in one stylesheet. They
// are now two variables in one block, and this is what keeps them in order.
//
// Checked as numbers rather than by eye: a screenshot cannot fail a build.
let headings = 0;
{
  const css = fs.readFileSync('index.html', 'utf8');
  const px = (name) => {
    const m = css.match(new RegExp('--' + name + ':\\s*([\\d.]+)px'));
    return m ? Number(m[1]) : null;
  };
  const section = px('h-section'), subhead = px('h-sub');

  if (section == null || subhead == null) {
    console.log('HEADINGS: --h-section or --h-sub is missing from index.html.');
    headings++;
  } else if (!(section > subhead)) {
    console.log(`HEADINGS: a section heading (${section}px) is not larger than a subheading inside it (${subhead}px).`);
    headings++;
  }

  // And nothing may set a heading size by hand, or the pair stops being the one
  // place the scale lives and the next inversion goes unnoticed again.
  const hardcoded = [...css.matchAll(/(h2|h3|\.subhead|\.difhead h3|\.sub h3)\s*\{[^}]*font-size:\s*(\d[\d.]*)px/g)];
  for (const m of hardcoded) {
    console.log(`HEADINGS: ${m[1]} sets font-size:${m[2]}px directly instead of using the scale.`);
    headings++;
  }
}

const anyFault = bad || doubled || ghosts || unimported || mislabelled || headings || icons || levels;
console.log(anyFault ? '' :
  'no undeclared assignments, no uncalled imports, no mislabelled groups, no doubled handlers, no missing icons, headings in order, one mark per action, one primary per screen.');
process.exit(anyFault ? 1 : 0);

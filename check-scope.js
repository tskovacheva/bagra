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

console.log(bad ? '' : 'no undeclared assignments.');
process.exit(bad);

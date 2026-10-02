// make-release.mjs — the commercial release artifact (§13fx).
//
// Until rc122 the release WAS the repository, and the repository is served
// whole by a static host: the owner's own journal backups (test/older-backups),
// withdrawn records (archive/), the attribution working notes (docs/), the
// specification and the decision log would all have been published beside the
// application. This builds `dist/` from an ALLOWLIST and nothing else:
//
//   - every file in the service worker's FILES — which since §13fu is, by
//     definition, the release: the files an installed copy runs from;
//   - sw.js itself;
//   - the licence texts listed in assets.json → licenceTexts.
//
// Then it checks what it built: the file set is exactly that (no more, no
// less), no path is under a forbidden prefix, every file the worker lists is
// present, every file index.html loads is present. A forbidden prefix is a
// second line, not the mechanism: a file reaches dist/ only by being named.
//
// Usage:  node scripts/make-release.mjs [outDir]      (default: dist)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);
const OUT = path.resolve(process.argv[2] || 'dist');
if (OUT === ROOT || !OUT.startsWith(ROOT + path.sep) && !process.argv[2]) {
  console.log('FAIL release: refusing to build into ' + OUT); process.exit(1);
}

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };

const sw = fs.readFileSync('sw.js', 'utf8');
const block = sw.slice(sw.indexOf('const FILES = ['), sw.indexOf('];', sw.indexOf('const FILES = [')));
const files = [...block.matchAll(/'([^']+)'/g)].map(m => m[1])
  .filter(f => f !== './').map(f => f.replace(/^\.\//, ''));
const assets = JSON.parse(fs.readFileSync('assets.json', 'utf8'));
// `_headers` is the host's configuration, read by the host and not served (§13ga).
// It lives in deploy/ and lands at the artifact's root.
const CONFIG = { '_headers': 'deploy/_headers' };
const allow = [...new Set([...files, 'sw.js', ...assets.licenceTexts, ...Object.keys(CONFIG)])].sort();

// Build clean.
fs.rmSync(OUT, { recursive: true, force: true });
for (const f of allow) {
  const from = CONFIG[f] || f;
  if (!fs.existsSync(from)) { fail('allowed but not on disk: ' + from); continue; }
  fs.mkdirSync(path.join(OUT, path.dirname(f)), { recursive: true });
  fs.copyFileSync(from, path.join(OUT, f));
}

// Check what was built.
const built = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else built.push(path.relative(OUT, p).split(path.sep).join('/'));
  }
})(OUT);
built.sort();
const extra = built.filter(f => !allow.includes(f));
const missing = allow.filter(f => !built.includes(f));
extra.length ? fail('in the artifact but not allowed: ' + extra.join(', ')) : ok(`${built.length} files, every one allowed`);
missing.length ? fail('allowed but missing from the artifact: ' + missing.join(', ')) : ok('every allowed file is in the artifact');

const FORBIDDEN = [/^test\//, /^archive\//, /^docs\//, /^prototype\//, /^scripts\//, /^\.git/, /^node_modules\//,
  /^_reviews\//, /\.md$/i, /\.mjs$/, /\.sh$/, /\.py$/, /\.gz$/, /^package(-lock)?\.json$/, /^assets\.json$/];
const bad = built.filter(f => FORBIDDEN.some(re => re.test(f)));
bad.length ? fail('forbidden content in the artifact: ' + bad.join(', ')) : ok('no test, archive, docs, prototype, script, document or backup');

const notIn = files.filter(f => !fs.existsSync(path.join(OUT, f)));
notIn.length ? fail('the worker lists files the artifact lacks: ' + notIn.join(', ')) : ok(`all ${files.length} files the worker installs are present`);
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map(m => m[1].replace(/^\.\//, ''))
  .filter(u => !u.startsWith('data:') && !u.startsWith('http'));
const loose = [...new Set(refs)].filter(u => !fs.existsSync(path.join(OUT, u)));
loose.length ? fail('index.html loads files the artifact lacks: ' + loose.join(', ')) : ok('everything index.html loads is present');

console.log(failed ? `release artifact FAILED (${path.relative(ROOT, OUT)})` : `release artifact built: ${path.relative(ROOT, OUT)}/`);
process.exit(failed ? 1 : 0);

// try-production.mjs — is dist/ deployable as https://bagra.crafty.place/ ? (§13ga)
//
// Static: the artifact is built twice into temporary directories and must be
// byte-identical (reproducible); it must run from its own root (no repository
// prefix, no host, no load from another origin); the manifest and the worker
// must fit a root deployment; the version must be visible and agree everywhere;
// the host configuration (_headers) must say what §13ga says — revalidate, never
// `immutable`, a CSP that allows no inline or evaluated script; and nothing that
// looks like a credential may be in what ships.
//
// That the application actually RUNS under those headers is try-update.mjs's
// job: the release gate runs it against dist/ with them applied.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);
let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };

function build() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bagra-prod-'));
  execFileSync(process.execPath, ['scripts/make-release.mjs', out], { stdio: 'pipe' });
  return out;
}
function tree(dir) {
  const out = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  })(dir);
  return out;
}

let A, B;
try { A = build(); B = build(); } catch (e) { fail('make-release failed: ' + (e.stdout || e)); process.exit(1); }
const ta = tree(A), tb = tree(B);
JSON.stringify(ta) === JSON.stringify(tb) ? ok(`two builds are byte-identical (${Object.keys(ta).length} files)`) : fail('two builds differ — the artifact is not reproducible');
const D = A;
const read = (f) => fs.readFileSync(path.join(D, f), 'utf8');
const code = Object.keys(ta).filter(f => /\.(js|html|json)$/.test(f));

// Runs from its own root.
// Code, not prose: comments explain where Bagra has been served, and that is not
// an assumption about where it runs.
const codeOnly = (f) => f.endsWith('.js')
  ? read(f).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\s\/\/\s.*$/, '')).join('\n')
  : read(f);
const prefixed = code.filter(f => /github\.io|vercel\.app|pages\.dev|netlify\.app|['"`]\/bagra\//.test(codeOnly(f)) && f !== 'manifest.json');
prefixed.length ? fail('assumes a host or a repository prefix: ' + prefixed.join(', ')) : ok('no host and no repository prefix in what runs');
const remote = code.filter(f => /\b(?:fetch|import|importScripts)\(\s*['"`]https?:\/\//.test(read(f)) || /<(?:script|link)[^>]+(?:src|href)="https?:\/\//.test(read(f)));
remote.length ? fail('loads from another origin: ' + remote.join(', ')) : ok('loads nothing from another origin');

// Manifest and worker fit a root deployment.
const m = JSON.parse(read('manifest.json'));
const want = { start_url: './', scope: './', id: '/bagra', display: 'standalone' };
const off = Object.entries(want).filter(([k, v]) => m[k] !== v);
off.length ? fail('manifest: ' + off.map(([k, v]) => `${k} is ${JSON.stringify(m[k])}, expected ${JSON.stringify(v)}`).join('; '))
  : ok('manifest: start_url and scope ./, id /bagra, standalone');
/navigator\.serviceWorker\.register\('sw\.js'/.test(read('app.js')) && ta['sw.js']
  ? ok('the worker is registered by a relative path and sits at the root, so its scope is the whole origin')
  : fail('the worker is not registered as sw.js at the artifact root');

// The version is visible and agrees.
const ver = read('version.js').match(/VERSION = '([^']+)'/)?.[1];
const cache = read('sw.js').match(/const CACHE = 'bagra-v([^']+)'/)?.[1];
const head = fs.readFileSync('CHANGELOG.md', 'utf8').match(/^## (\S+)/m)?.[1];
ver && ver === cache && ver === head ? ok(`version ${ver} — version.js, the worker's cache and the changelog agree`)
  : fail(`version disagrees: version.js ${ver}, sw.js ${cache}, changelog ${head}`);

// The host configuration.
const H = ta['_headers'] ? read('_headers') : '';
if (!H) fail('dist/_headers is missing');
else {
  const rules = []; let cur = null;
  for (const line of H.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { path: line.trim(), h: {} }; rules.push(cur); continue; }
    const i = line.indexOf(':'); if (cur && i > 0) cur.h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const at = (p) => Object.assign({}, ...rules.filter(r => r.path === p || (r.path.endsWith('*') && p.startsWith(r.path.slice(0, -1)))).map(r => r.h));
  for (const p of ['/sw.js', '/', '/index.html', '/manifest.json', '/app.js', '/seed/plants.json', '/fonts/x.woff2', '/seed/images/plants/x.jpg']) {
    const cc = at(p)['cache-control'] || '';
    if (!/no-cache|max-age=0/.test(cc)) fail(`${p}: Cache-Control ${JSON.stringify(cc)} does not revalidate`);
  }
  /immutable/i.test(H.replace(/^#.*$/gm, '')) ? fail('a header says immutable — nothing in Bagra is content-hashed') : ok('every path revalidates; nothing is immutable');
  const csp = at('/index.html')['content-security-policy'] || '';
  const script = (csp.match(/script-src([^;]*)/) || [])[1] || '';
  csp && /'self'/.test(script) && !/unsafe-inline|unsafe-eval|\*|https?:/.test(script) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp)
    ? ok('CSP: script only from the origin, no inline or eval; no framing; no plugins') : fail('CSP missing or weaker than §13ga: ' + JSON.stringify(csp));
  (at('/app.js')['x-content-type-options'] || '') === 'nosniff' ? ok('nosniff') : fail('X-Content-Type-Options: nosniff missing');
}

// Nothing that looks like a credential.
const SECRETS = [/AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bsk_(live|test)_[0-9A-Za-z]{16,}/, /\bgh[pousr]_[0-9A-Za-z]{30,}/,
  /\bxox[abprs]-[0-9A-Za-z-]{10,}/, /\bAIza[0-9A-Za-z_-]{35}\b/, /\bwhsec_[0-9A-Za-z]{20,}/, /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][0-9A-Za-z_\-]{20,}['"]/i];
const leaks = Object.keys(ta).filter(f => !/\.(jpg|png|woff2)$/.test(f)).flatMap(f => SECRETS.filter(re => re.test(read(f))).map(re => `${f}: ${re}`));
leaks.length ? fail('looks like a credential in what ships: ' + leaks.join('; ')) : ok('no credential pattern in what ships');

fs.rmSync(A, { recursive: true, force: true }); fs.rmSync(B, { recursive: true, force: true });
console.log(failed ? 'production readiness FAILED' : 'production readiness passed');
process.exit(failed ? 1 : 0);

// try-release-files.mjs — the release as a set of files, checked before it ships (§13fu).
//
// check.sh already required every .js, every top-level seed file and every
// plant photograph to be in the worker's list. Since rc120 the worker's list
// IS the release: `install` stores exactly these files, all or nothing, and
// every page is answered from them. So a name in the list with no file behind
// it no longer „stops updating" — it makes every install of that release fail,
// and the update never arrives for anyone. This asks it of EVERY entry, and the
// rest of what an installed copy depends on, with nothing installed.
//
// Run on its own:  node scripts/try-release-files.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);
let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };

const sw = fs.readFileSync('sw.js', 'utf8');
try { new vm.Script(sw, { filename: 'sw.js' }); ok('sw.js parses'); } catch (e) { fail('sw.js does not parse: ' + e.message); }

const list = [...sw.slice(sw.indexOf('const FILES = ['), sw.indexOf('];', sw.indexOf('const FILES = ['))).matchAll(/'([^']+)'/g)].map(m => m[1]);
const dupes = list.filter((f, i) => list.indexOf(f) !== i);
dupes.length ? fail('listed twice in sw.js: ' + dupes.join(', ')) : ok(`${list.length} files in the release, none listed twice`);
const absent = list.filter(f => f !== './' && !fs.existsSync(f));
absent.length ? fail('in the release but not on disk (every install would fail): ' + absent.join(', ')) : ok('every file in the release exists');
for (const must of ['./', './index.html', './app.js', './version.js', './manifest.json'])
  if (!list.includes(must)) fail('the shell is incomplete without ' + must);

// What the shell itself loads must be in the release, or the offline copy
// lacks it: the stylesheet's fonts, the manifest, the icons in <head>.
const html = fs.readFileSync('index.html', 'utf8');
const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g), ...html.matchAll(/url\(([^)'"]+)\)/g)]
  .map(m => m[1]).filter(u => !u.startsWith('data:') && !u.startsWith('http'));
const loose = [...new Set(refs)].filter(u => !list.includes('./' + u.replace(/^\.\//, '')));
loose.length ? fail('index.html loads files the release does not carry: ' + loose.join(', ')) : ok(`all ${new Set(refs).size} files index.html loads are in the release`);

// The table of shipped photographs names only shipped files (§13gd). rc122
// stopped shipping one and left its entry: the table then said a file shipped
// that did not, and a kept record pointing at it looked fine to every check.
const photoTable = JSON.parse(fs.readFileSync('seed/plant-photos.json', 'utf8')).photos;
const notShipped = Object.entries(photoTable).filter(([, e]) => !fs.existsSync(e.src) || !list.includes('./' + e.src)).map(([k, e]) => `${k} → ${e.src}`);
notShipped.length ? fail('plant-photos.json names files the release does not ship: ' + notShipped.join(', '))
  : ok(`every one of the ${Object.keys(photoTable).length} photographs in plant-photos.json is on disk and in the release`);

const ver = fs.readFileSync('version.js', 'utf8').match(/VERSION = '([^']+)'/)[1];
sw.includes(`const CACHE = 'bagra-v${ver}'`) ? ok(`the release is named for ${ver}`) : fail('the worker cache name does not carry ' + ver);
const head = fs.readFileSync('CHANGELOG.md', 'utf8').match(/^## (\S+)/m)?.[1];
head === ver ? ok('the changelog\'s newest entry is ' + ver) : fail(`the changelog's newest entry is ${head}, the version is ${ver}`);

const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons'])
  if (m[k] == null) fail('manifest has no ' + k);
if (/^(https?:)?\/\//.test(m.start_url) || /^(https?:)?\/\//.test(m.scope)) fail('manifest names a host — it must stay relative to where it is served');
if (m.start_url.startsWith('/') || m.scope.startsWith('/')) fail('manifest start_url/scope are absolute paths — they would break under a sub-path');
// The application's identity to the browser (§13fv). An installed copy is
// known by it; changing it after anyone has installed makes the browser treat
// the application as a different one. Pinned, so a change is a decision.
const ID = '/bagra';
if (m.id !== ID) fail(`manifest id is ${JSON.stringify(m.id)}, pinned as ${ID} — changing it makes installed copies a different app`);
else ok('manifest id is the pinned ' + ID + ', path-only');
const icons = (m.icons || []).map(i => i.src);
const badIcon = icons.filter(i => !fs.existsSync(i) || !list.includes('./' + i));
badIcon.length ? fail('manifest icons missing or not in the release: ' + badIcon.join(', ')) : ok(`manifest: relative start_url and scope, ${icons.length} icons present and in the release`);
if (!(m.icons || []).some(i => i.sizes === '512x512') || !(m.icons || []).some(i => i.sizes === '192x192')) fail('installability wants a 192 and a 512 icon');

console.log(failed ? 'release files FAILED' : 'release files passed');
process.exit(failed ? 1 : 0);

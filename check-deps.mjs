// check-deps.mjs — is a test layer able to run, and does it matter that it cannot?
//
// The suite has six layers and three of them need something installed. When it
// is not, `check.sh` printed a line saying so and carried on with status 0. On
// a laptop mid-afternoon that is right: the static guards are fast and the
// runtime ones are not always worth the wait.
//
// On a release candidate it is the same fault as §1 of check.sh, which cost a
// release: a guard that reports and does not stop is not a guard. A run of
// 1.0.0-rc25 in a clean environment printed
//
//     boot check skipped (npm install --no-save jsdom fake-indexeddb)
//     all held
//
// and left with status 0. Three of the six layers had not run, the pipeline
// said the candidate was checked, and nothing on the screen distinguished that
// from a run in which they had.
//
// So the two runs are named apart. A development run may skip; a release run
// may not. The invariant, in one line:
//
//     a candidate cannot be called checked if a layer of its release policy
//     never started.
//
// Usage:
//   node check-deps.mjs [--release] [--chromium] module...
//
// Exit 0  — everything present, the layer can run.
//      1  — something missing AND this is a release run. Fatal.
//      2  — something missing on a development run. The caller skips the layer
//           and says so. Deliberately not 1: a shell `||` must be able to tell
//           „cannot run here" from „must not ship".

import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const release  = args.includes('--release');
const chromium = args.includes('--chromium');
const modules  = args.filter(a => !a.startsWith('--'));

const missing = [];

for (const name of modules) {
  try { require.resolve(name); }
  catch { missing.push(name); }
}

// `screen-check.mjs` needs a browser on disk as well as the library that drives
// it, and it had a silent skip of its own INSIDE the script — with
// puppeteer-core installed and no Chromium present it printed „screen check
// skipped (no chromium found)" and exited 0. Closing the gate only in the shell
// would have left that second door open, so the browser is checked here, where
// the release run can refuse it.
// `BAGRA_CHROME` names one browser and overrides the search. It exists for two
// reasons: an installation somewhere the list does not know about, and the test
// of this gate — which cannot create a missing browser by deleting one.
export const CHROME = process.env.BAGRA_CHROME
  ? [process.env.BAGRA_CHROME]
  : ['/opt/google/chrome/chrome', '/usr/bin/chromium',
     '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
let noBrowser = false;
if (chromium && !CHROME.some(p => fs.existsSync(p))) {
  noBrowser = true;
}

if (!missing.length && !noBrowser) process.exit(0);

// The message says what is missing and how to get it. A fail that only says
// „missing dependency" sends the reader to the source to find out which.
const lines = [];
if (missing.length) {
  lines.push(`missing node module(s): ${missing.join(', ')}`);
  lines.push(`  npm install --no-save ${missing.join(' ')}`);
}
if (noBrowser) {
  lines.push('no Chromium on disk — screen-check drives a real browser');
  lines.push(`  looked in: ${CHROME.join(', ')}`);
  lines.push('  apt-get install -y chromium   (or set one of those paths)');
}

if (release) {
  console.log('RELEASE CHECK CANNOT RUN A REQUIRED LAYER:');
  for (const l of lines) console.log('  ' + l);
  console.log('  A release candidate is not checked if a layer never started.');
  process.exit(1);
}

console.log('skipping a layer — ' + lines[0]);
console.log(' ' + lines[1]);
process.exit(2);

// scripts/try-manifest-agrees.mjs — the manifest says what the packs say.
//
// WHY THIS EXISTS.
//
// `seed/manifest.json` is a second copy of a fact each pack already states.
// `ensurePacks` reads ONLY the manifest to decide whether a pack needs loading:
//
//     if (shipped && known && known.seededVersion === shipped.version) skip
//
// So a manifest left behind at the old version makes an installed copy conclude
// it already has the new pack and skip it. Nothing is logged, nothing fails,
// and the records simply never arrive. A bumped pack with a stale manifest is a
// release that quietly ships nothing.
//
// This is the third hand-maintained list in two releases found to have drifted
// from the code it describes — after the screen route list and the pack update
// buttons. The pattern is the finding: a second place holding the same fact,
// with nothing holding the two together.
//
// WHAT IT CHECKS, in both directions:
//   - every pack in PACKS has a manifest entry, and every manifest entry is a
//     declared pack;
//   - the version in the manifest is the version in the pack file;
//   - the packId in the manifest is the packId in the pack file.
//
// It does NOT judge the shape of a version. Six packs use semver strings and
// `sources` uses a bare number; that inconsistency predates this guard, is
// harmless because manifest versions are only ever compared with each other,
// and is noted rather than enforced — a guard that fails on something it was
// not written to police is a guard that gets switched off.
//
// STATIC. Reads JSON and one source file. No browser, no shim.

import { readFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));

const seed = readFileSync(here('../seed.js'), 'utf8');
const packsBlock = seed.match(/export const PACKS = \{([\s\S]*?)\n\};/);
if (!packsBlock) {
  console.log('MANIFEST: cannot find the PACKS registry in seed.js.');
  process.exit(1);
}

// name -> the pack's own file, from `file: 'seed/x.json'`.
const files = new Map();
for (const m of packsBlock[1].matchAll(/\n {2}([a-zA-Z0-9_]+): \{[\s\S]*?file: '([^']+)'/g)) {
  files.set(m[1], m[2]);
}
if (!files.size) {
  console.log('MANIFEST: PACKS parsed to nothing — the shape has changed.');
  process.exit(1);
}

const manifest = read('../seed/manifest.json').packs || {};
let bad = 0;

for (const [name, file] of files) {
  const entry = manifest[name];
  if (!entry) {
    console.log(`MANIFEST MISSING: ${name} is a declared pack with no manifest entry.`);
    console.log('  ensurePacks reads the manifest to decide what to load.');
    bad = 1;
    continue;
  }
  const pack = read('../' + file);
  if (String(entry.version) !== String(pack.packVersion)) {
    console.log(`MANIFEST STALE: ${name} — manifest says ${JSON.stringify(entry.version)}, `
              + `${file} says ${JSON.stringify(pack.packVersion)}.`);
    console.log('  An installed copy will decide it already has this pack and skip it,');
    console.log('  silently, so the release ships the records to nobody.');
    bad = 1;
  }
  if (String(entry.packId) !== String(pack.packId)) {
    console.log(`MANIFEST PACKID: ${name} — manifest says ${JSON.stringify(entry.packId)}, `
              + `${file} says ${JSON.stringify(pack.packId)}.`);
    bad = 1;
  }
}

for (const name of Object.keys(manifest)) {
  if (files.has(name)) continue;
  console.log(`MANIFEST ORPHAN: ${name} is in the manifest and is not a declared pack.`);
  bad = 1;
}

if (bad) process.exit(1);
console.log(`manifest: ${files.size} packs, version and id agree with the pack files.`);

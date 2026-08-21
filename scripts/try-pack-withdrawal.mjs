// scripts/try-pack-withdrawal.mjs — does a withdrawn record actually leave?
//
// Not a guard in check.sh but the proof behind one (§13cb). It runs the real
// `diffPack` and `applyDiff` against a database seeded with the OLD glossary
// pack and the NEW pack file on disk, which is exactly the owner's installed
// copy meeting this release.
//
// It answers four questions, and each is asked in both directions:
//
//   1. Are the five withdrawn terms seen at all? (Before rc13 they were not:
//      diffPack walked the pack, so a record that had left it was invisible.)
//   2. Does applying actually remove them from the store?
//   3. Is a record the user edited left alone unless she says otherwise?
//   4. Is a record she wrote herself never touched?
//
//   node scripts/try-pack-withdrawal.mjs

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

// `diffPack` fetches the pack file over HTTP; off a server there is none.
const packFile = JSON.parse(fs.readFileSync('seed/glossary.json', 'utf8'));
globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  json: async () => JSON.parse(fs.readFileSync(String(url), 'utf8')),
});

const { open: openDb, put, all, get } = await import('../db.js');
const { diffPack, applyDiff } = await import('../seed.js');

await openDb();

// The installed copy: every term in the new pack, plus the five this release
// withdrew, plus one of the user's own.
const WITHDRAWN = ['affinity', 'buffer', 'hapa_zome', 'bundling', 'discharge'];

for (const row of packFile.terms) {
  const { code, ...rest } = row;
  await put('glossary', {
    id: 'seed:' + code, origin: 'seed', packId: packFile.packId,
    packVersion: '0.1.0', editedByUser: false, ...rest,
  });
}
for (const code of WITHDRAWN) {
  await put('glossary', {
    id: 'seed:' + code, origin: 'seed', packId: packFile.packId,
    packVersion: '0.1.0',
    // `buffer` is the one she edited, so it must arrive unticked.
    editedByUser: code === 'buffer',
    term: { bg: 'Стар термин ' + code, en: 'Old term ' + code },
    definition: { bg: '.', en: '.' }, group: 'process', aliases: [], seeAlso: [],
  });
}
await put('glossary', {
  id: 'mine-1', origin: 'user',
  term: { bg: 'Моя дума', en: 'My word' },
  definition: { bg: '.', en: '.' }, group: 'basics', aliases: [], seeAlso: [],
});

const before = (await all('glossary')).length;

let failures = 0;
const check = (ok, said) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${said}`);
  if (!ok) failures++;
};

const diff = await diffPack('glossary');

// 1. Seen.
const seen = diff.withdrawn.map(e => e.id.replace('seed:', '')).sort();
check(JSON.stringify(seen) === JSON.stringify([...WITHDRAWN].sort()),
  `all five withdrawals are seen: ${seen.join(', ') || '(none — this is the rc12 fault)'}`);

// 4. Her own record is not in there.
check(!diff.withdrawn.some(e => e.id === 'mine-1'),
  'a record she wrote herself is not offered for withdrawal');

// 3. The edited one is marked as such, so the UI leaves it unticked.
const buffer = diff.withdrawn.find(e => e.id === 'seed:buffer');
check(buffer && buffer.edited === true,
  'the one she edited is marked edited, and so arrives unticked');

// 2. Applying removes them — and only the ones chosen.
const chosen = diff.withdrawn.filter(e => !e.edited);
const n = await applyDiff(diff.store, chosen, diff.pack);
check(n === 4, `four withdrawals applied (reported ${n})`);

for (const code of WITHDRAWN) {
  const still = await get('glossary', 'seed:' + code);
  const shouldRemain = code === 'buffer';
  check(!!still === shouldRemain,
    shouldRemain
      ? 'the edited one is still there, untouched'
      : `${code} is gone from the store`);
}

check(!!(await get('glossary', 'mine-1')), 'her own record survived');

const after = (await all('glossary')).length;
check(after === before - 4, `store went from ${before} to ${after}`);

// And the other direction: run the update again and nothing more is withdrawn.
const again = await diffPack('glossary');
check(again.withdrawn.length === 1 && again.withdrawn[0].id === 'seed:buffer',
  'a second run offers only the one still there — it does not repeat itself');

console.log(failures ? `\n${failures} failed` : '\nall held');
process.exit(failures ? 1 : 0);

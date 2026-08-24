// scripts/try-pack-lifecycle.mjs — does a fast start pretend an update is applied?
//
// rc28 recorded ONE version per pack and asked it two different questions.
// After a boot against a newer pack, `seedPack` added the genuinely new records
// and correctly left the changed ones alone — and then the version was written
// down as installed. `packsWithNewVersion()` compared the manifest against that
// same field and answered: nothing new.
//
// So booting could silently retire an update the owner had never been shown.
// The changed records were still the old ones, the withdrawn ones were still
// there, and the notice that would have told her had been switched off by the
// act of opening the application.
//
// The second half of this file is the same class of fault one register along:
// a SOURCE could be deleted while glossary terms, recipes and colour swatches
// went on crediting it. Attribution is history too.
//
//   node scripts/try-pack-lifecycle.mjs

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

let failed = false;
const ok   = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is   = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want))
  ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

// A pack and a manifest we control, so a „new shipped version" can be created
// without editing anything that ships.
let OVERRIDE = {};
const fetched = [];
globalThis.fetch = async (url) => {
  const p = String(url).replace(/^.*\/bagra\//, '');
  fetched.push(p);
  if (OVERRIDE[p]) return { ok: true, status: 200, json: async () => OVERRIDE[p] };
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

const db = await import('../db.js');
const { ensurePacks, packsWithNewVersion, recordApplied, diffPack, applyDiff } = await import('../seed.js');
const { findReferences, danglingReferences } = await import('../refs.js');
await db.open();

const realGlossary = JSON.parse(fs.readFileSync('seed/glossary.json', 'utf8'));
const realManifest = JSON.parse(fs.readFileSync('seed/manifest.json', 'utf8'));

const ship = (version, terms) => {
  OVERRIDE['seed/glossary.json'] = { ...realGlossary, packVersion: version, terms };
  OVERRIDE['seed/manifest.json'] = {
    packs: { ...realManifest.packs, glossary: { ...realManifest.packs.glossary, version } },
  };
};

const term = (code, body) => ({ code, group: 'process', term: { bg: code, en: code }, body: { bg: body, en: body } });

const base = [term('a', 'първо'), term('b', 'второ'), term('c', 'трето')];
const state = async () => (await db.getSetting('packState'))?.glossary || {};

// ---------------------------------------------------------------- install
console.log('\na fresh install is applied, because there was nothing to review');

ship('0.10', base);
await ensurePacks();
is(await packsWithNewVersion(), [], 'nothing is pending after a fresh install');
is((await state()).appliedVersion, '0.10', 'and the installed version counts as applied');

// ---------------------------------------------------------------- case 1
console.log('\n0.10 installed, 0.11 shipped, an existing record changed');

ship('0.11', [term('a', 'ПРЕРАБОТЕНО'), term('b', 'второ'), term('c', 'трето')]);
await ensurePacks();

is((await db.get('glossary', 'seed:a')).body.bg, 'първо',
   'the boot did not overwrite the changed record');
(await packsWithNewVersion()).includes('glossary')
  ? ok('and the update is STILL pending after the boot')
  : fail('booting retired an update the owner was never shown');
is((await state()).seededVersion, '0.11', 'the boot recorded what it has seeded');
is((await state()).appliedVersion, '0.10', 'and left the applied version alone');

// ---------------------------------------------------------------- case 2
console.log('\n0.10 installed, 0.11 shipped, and 0.11 also adds a record nobody has yet');

// Put the state back to „0.10 installed and applied", so this is the audit's
// case 2 on its own rather than a second boot on top of case 1. A pack that
// changes its CONTENT without changing its VERSION is a packaging error and not
// a case the gate is asked to detect — see §13cu.
await db.setSetting('packState', {
  ...(await db.getSetting('packState')),
  glossary: { ...(await state()), seededVersion: '0.10', appliedVersion: '0.10' },
});
ship('0.11', [term('a', 'ПРЕРАБОТЕНО'), term('b', 'второ'), term('c', 'трето'), term('d', 'четвърто')]);
await ensurePacks();

(await db.get('glossary', 'seed:d'))
  ? ok('the genuinely new record was seeded, as the policy allows')
  : fail('a truly new record was not added');
(await packsWithNewVersion()).includes('glossary')
  ? ok('and the update is still pending for the changed one')
  : fail('adding a new record retired the whole version');

// ---------------------------------------------------------------- case 4
console.log('\nan edited seeded record is never overwritten and stays visible as edited');

const mine = await db.get('glossary', 'seed:b');
mine.body = { bg: 'моят текст', en: 'mine' };
mine.editedByUser = true;
await db.put('glossary', mine);

ship('0.11', [term('a', 'ПРЕРАБОТЕНО'), term('b', 'ПАКЕТЪТ ГО СМЕНИ'), term('c', 'трето'), term('d', 'четвърто')]);
await ensurePacks();
is((await db.get('glossary', 'seed:b')).body.bg, 'моят текст',
   'the boot left her text where it was');

let diff = await diffPack('glossary');
diff.edited.some(e => e.id === 'seed:b')
  ? ok('and the preview still shows it as edited, not as changed')
  : fail('an edited record stopped being offered as edited');

// ---------------------------------------------------------------- case 5
console.log('\na withdrawn record is not deleted by a boot');

ship('0.12', [term('a', 'ПРЕРАБОТЕНО'), term('b', 'ПАКЕТЪТ ГО СМЕНИ'), term('d', 'четвърто')]);
await ensurePacks();

(await db.get('glossary', 'seed:c'))
  ? ok('the withdrawn record is still there — a boot does not remove')
  : fail('a boot deleted a record without asking');
diff = await diffPack('glossary');
diff.withdrawn.some(e => e.id === 'seed:c')
  ? ok('and the preview offers the withdrawal')
  : fail('the withdrawal was not offered');
(await packsWithNewVersion()).includes('glossary')
  ? ok('the update stays pending until it is chosen')
  : fail('a withdrawal was counted as applied by the boot');

// ---------------------------------------------------------------- case 3
console.log('\nafter the preview applies, the version is applied');

// Partial first: she ticks some of what was offered and leaves the rest.
const offered = [...diff.added, ...diff.changed, ...diff.edited, ...diff.withdrawn];
await applyDiff(diff.store, diff.changed, diff.pack);
await recordApplied('glossary', { full: diff.changed.length === offered.length });
(await packsWithNewVersion()).includes('glossary')
  ? ok('a partial apply leaves the pack pending — the untouched entries are the point')
  : fail('a partial apply closed the update');

// Then the whole of it.
diff = await diffPack('glossary');
const rest = [...diff.added, ...diff.changed, ...diff.edited, ...diff.withdrawn];
await applyDiff(diff.store, rest, diff.pack);
await recordApplied('glossary', { full: true });

is(await packsWithNewVersion(), [], 'a full apply closes it');
is((await state()).appliedVersion, '0.12', 'and the applied version is recorded');

// ---------------------------------------------------------------- unchanged
console.log('\nand none of this made a normal start read the library again');

const n = fetched.length;
await ensurePacks();
const read = fetched.slice(n);
is(read, ['seed/manifest.json'], 'an unchanged start still reads one file');

// A record deleted by hand must still come back, at the same version.
await db.remove('glossary', 'seed:a');
await ensurePacks();
(await db.get('glossary', 'seed:a'))
  ? ok('a seeded record deleted by hand still comes back')
  : fail('the recovery path was lost');

OVERRIDE = {};

// ================================================================ sources
console.log('\nattribution cannot be deleted out from under a claim');

await ensurePacks();   // the real packs, so the real credits are in place

const used = await findReferences('sources', 'seed:boutrup-ellis');
used.total > 0
  ? ok(`a source credited by the library is refused — ${used.byStore.map(b => b.store).join(', ')}`)
  : fail('a credited source could be deleted');

const byGlossary = await findReferences('sources', 'seed:jenny-dean-wild-colour');
byGlossary.byStore.some(b => b.store === 'glossary')
  ? ok('a source used by a glossary term is seen')
  : fail('the glossary path is not checked');

const byRecipe = await findReferences('sources', 'seed:joanne-green-watercolour');
byRecipe.byStore.some(b => b.store === 'recipes')
  ? ok('a source used by a recipe is seen')
  : fail('the recipe path is not checked');

// Not in the audit's list: every colour swatch on a plant credits where the
// colour was read from, and four of the ten sources are named ONLY there.
const byColour = await findReferences('sources', 'seed:natures-rainbow');
byColour.byStore.some(b => b.store === 'plants')
  ? ok(`a source named only by colour swatches is seen — ${byColour.byStore[0].records} plants`)
  : fail('plants.colours[].source is not checked');

await db.putRaw('sources', { id: 'src-unused', code: 'nobody-cites-this', origin: 'user' });
is((await findReferences('sources', 'src-unused')).total, 0,
   'an uncited source can still be deleted');

// The alternate key must not have broken the id-based entities.
await db.putRaw('recipes', { id: 'rec-plain', name: { bg: 'x', en: 'x' } });
is((await findReferences('recipes', 'rec-plain')).total, 0,
   'an id-matched entity still answers correctly');

// A source matched on its CODE, not its id: writing the id into sourceCode must
// not count, or the checker is matching the wrong thing and happens to be right.
await db.putRaw('glossary', { id: 'g-wrong', sourceCode: 'seed:nobody-cites-this', origin: 'user' });
is((await findReferences('sources', 'src-unused')).total, 0,
   'a prefixed id in sourceCode is not a credit — the code is what counts');
await db.remove('glossary', 'g-wrong');

// The false positive worth naming: `trials.water.sourceCode` holds a
// water_source vocabulary code — rain, tap, well — and has nothing to do with
// the sources register. A checker matching on field name would block a delete
// because somebody wrote down where the water came from.
await db.putRaw('sources', { id: 'src-rain', code: 'rain', origin: 'user' });
await db.putRaw('trials', { id: 'tr-water', water: { sourceCode: 'rain' }, steps: [], placements: [], origin: 'user' });
is((await findReferences('sources', 'src-rain')).total, 0,
   'a water source is not a citation');

console.log('\nand a missing source code is caught');
await db.putRaw('glossary', { id: 'g-dangle', sourceCode: 'a-source-that-went', origin: 'user' });
(await danglingReferences()).some(d => d.target === 'sources' && d.id === 'a-source-that-went')
  ? ok('a credit naming no source is reported')
  : fail('a dangling source code went unseen');

console.log(failed ? '\nPACK LIFECYCLE CHECK FAILED' : '\nall held');
process.exit(failed ? 1 : 0);

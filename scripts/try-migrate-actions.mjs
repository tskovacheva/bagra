// try-migrate-actions.mjs — run the fabric-action migration against a backup
// file and print what it would do. Writes nothing.
//
//   node scripts/try-migrate-actions.mjs ../bagra-2026-08-17.json
//
// This exists so the migration can be read in its results before it is ever
// run against a live database. A migration whose output nobody has looked at
// is a guess with a version number on it.

import { readFileSync } from 'node:fs';
import { migrateAll, migrateFabric } from '../migrate-actions.js';
import { currentState as boxOf, treatmentsOf } from '../fabric-logic.js';

const path = process.argv[2];
if (!path) { console.error('usage: try-migrate-actions.mjs <backup.json>'); process.exit(1); }

const backup = JSON.parse(readFileSync(path, 'utf8'));
const fabrics = backup.data?.fabrics || [];

const { fabrics: after, batches, report } = migrateAll(fabrics);

console.log('=== what it read ===');
console.log(`${report.fabrics} fabrics, ${report.actions} actions`);
console.log('by action:', report.byAction);
console.log(`${report.batches} batches created (one per action not written by a trial)`);

if (report.unmapped.length) {
  console.log('\n=== state codes with no action, kept as "other" ===');
  for (const a of report.unmapped) console.log(' ', a.fromStateCode, a.date, a.fabricId);
} else {
  console.log('\nno unmapped state codes.');
}

console.log('\n=== every piece that has any history ===');
for (const f of after) {
  if (!(f.actions || []).length) continue;
  const box = boxOf(f);
  const carried = treatmentsOf(f);
  console.log(`${(f.label || '?').padEnd(7)} ${(f.name || '').slice(0, 26).padEnd(28)} box=${String(box).padEnd(10)}${carried.length ? ' carries=' + carried.join(',') : ''}`);
  for (const a of f.actions) {
    console.log(`         ${a.date || '(no date)'}  ${a.actionCode.padEnd(9)} ` +
      `${a.trialId ? 'trial ' + a.trialId.slice(0, 8) : 'batch ' + String(a.batchId).slice(6, 14)}` +
      `${a.fromStateCode && a.fromStateCode !== 'scoured' && a.fromStateCode !== 'mordanted' ? '   was:' + a.fromStateCode : ''}`);
  }
}

console.log('\n=== the invariant: every action belongs to a batch or a trial ===');
let orphans = 0;
for (const f of after) for (const a of f.actions || []) {
  if (!a.batchId && !a.trialId) { orphans++; console.log('  ORPHAN', f.label, a.actionCode, a.date); }
}
console.log(orphans ? `${orphans} orphaned actions — the migration is wrong` : 'holds: no orphans.');

console.log('\n=== idempotence: running it twice changes nothing ===');
const twice = migrateAll(after);
const same = JSON.stringify(twice.fabrics) === JSON.stringify(after);
console.log(same ? 'holds: second run is a no-op.' : 'FAILS: second run changed the data.');
console.log(twice.batches.length === 0
  ? 'holds: second run creates no further batches.'
  : `FAILS: second run created ${twice.batches.length} more batches.`);

console.log('\n=== the box rule, checked by hand ===');
const probe = migrateFabric({
  id: 'probe', label: 'TEST', name: 'scoured then tanned', state: 'unwashed',
  stateEvents: [
    { id: 'e1', date: '2026-01-01', stateCode: 'scoured' },
    { id: 'e2', date: '2026-01-02', stateCode: 'tanned' },
  ],
}).fabric;
console.log(`a piece scoured then tanned reports box=${boxOf(probe)} carries=${treatmentsOf(probe).join(',')}`);
console.log(boxOf(probe) === 'scoured'
  ? 'holds: tanning did not move the box.'
  : 'FAILS: tanning moved the box.');

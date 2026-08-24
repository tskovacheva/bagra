// backup.js — the personal safety net (§11).
//
// Distinct from reference packs (§10): a backup is a round trip of everything
// the owner has entered, meant to restore a device. A pack carries knowledge
// and merges. Mixing the two would make both unreliable.

import { STORES, all, get, putRaw, removeSystem, replaceStores, getSetting, setSetting, open } from './db.js';

const SCHEMA_VERSION = 3;

// Vocabulary and bands are regenerated from code on every start, so they are
// not worth carrying. Everything else is either the user's work or a seeded
// record she may have edited — both must survive.
const SKIP = ['vocabulary', 'bands'];

export async function exportAll() {
  const data = {};
  for (const name of Object.keys(STORES)) {
    if (SKIP.includes(name)) continue;
    data[name] = await all(name);
  }

  return {
    format: 'bagra-backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    data,
  };
}

export async function downloadBackup() {
  const payload = await exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bagra-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  await setSetting('lastExportAt', new Date().toISOString());
  await setSetting('changeCounter', 0);
  return payload.counts;
}

/**
 * Read the file and say whether it can be restored — BEFORE anything is
 * written. A destructive operation must not discover halfway through that the
 * file it is restoring from is unusable.
 *
 * Returns the stores that will actually be touched, so `replace` knows its own
 * scope and the confirmation can say how much is involved.
 */
export function validateBackup(payload) {
  if (payload?.format !== 'bagra-backup') {
    throw new Error('not a Багра backup file');
  }
  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error('backup is from a newer version of the app');
  }
  const data = payload.data;
  if (!data || typeof data !== 'object') {
    throw new Error('the backup carries no data');
  }

  const stores = [];
  for (const [name, rows] of Object.entries(data)) {
    if (!STORES[name] || SKIP.includes(name)) continue;
    if (!Array.isArray(rows)) throw new Error(`${name}: not a list of records`);
    const keyPath = STORES[name].keyPath;
    // A row with no key cannot be written, and finding that out inside the
    // restore transaction would abort a restore that had already been
    // announced. Cheaper to refuse the file.
    const n = rows.findIndex(r => !r || r[keyPath] === undefined || r[keyPath] === null);
    if (n !== -1) throw new Error(`${name}: record ${n + 1} has no ${keyPath}`);
    stores.push(name);
  }
  if (!stores.length) throw new Error('the backup holds no restorable store');
  return { stores, counts: Object.fromEntries(stores.map(s => [s, data[s].length])) };
}

/**
 * Restore from a backup file.
 *
 * @param {'merge'|'replace'} mode
 *   merge   — adds records whose id is not already present, touches nothing
 *             else. The safe default: it can only ever add.
 *   replace — brings the database back to what the file holds. Used when moving
 *             to a new device or recovering from real loss.
 *
 * WHAT `replace` USED TO DO, and why it was wrong.
 *
 * It wrote every record from the file over the one with the same id and added
 * the ones that were missing — and stopped there. A record that existed in the
 * database and NOT in the file simply stayed. So restoring last week's backup
 * did not return the database to last week: it returned last week's records
 * and kept everything written since, mixed together with no way to tell them
 * apart. That is a merge with overwriting, and it was offered under a label
 * that promised a snapshot, to a person who had reached for it because
 * something had already gone wrong.
 *
 * Both modes now write RAW. A restored record keeps the `updatedAt` the file
 * gives it: the file records when the work was last touched, and stamping every
 * restored record with the hour of the restore erases that, permanently and
 * without saying so. Nor does either mode count against the backup reminder —
 * a restored database is, by definition, the contents of a backup file.
 */
export async function importBackup(payload, mode = 'merge') {
  const { stores } = validateBackup(payload);
  const data = payload.data;

  if (mode === 'replace') {
    const subset = Object.fromEntries(stores.map(name => [name, data[name]]));

    // WHAT ACTUALLY WENT, not how many fewer there are.
    //
    // The first version subtracted the count after from the count before, which
    // is right only when the file is a subset of the database. Current {A,B}
    // against a backup of {B,C} is two records before and two after, so the
    // arithmetic reported nothing removed — while A had gone. The one thing a
    // person wants to know after a snapshot restore is precisely how many of
    // her records the file did not carry, and that is a set difference.
    const gone = {};
    for (const name of stores) {
      const keyPath = STORES[name].keyPath;
      const inFile = new Set(data[name].map(r => r[keyPath]));
      gone[name] = (await all(name)).filter(r => !inFile.has(r[keyPath])).length;
    }

    // `language` is a property of the DEVICE, not of the work (§13co). Nobody
    // reaches for a restore in order to change the language, and a person
    // recovering from data loss should not be met with an interface in the
    // other one. `fabricLabelCounter` stays in the snapshot: losing it means
    // the next piece takes a number that is already on a label in the studio.
    // Absence is preserved as carefully as a value — no row means Bulgarian by
    // default (i18n.js), so restoring one where there was none would change the
    // language just as surely.
    const language = await get('settings', 'language');

    const { written } = await replaceStores(subset);

    if (language) await putRaw('settings', language);
    else await removeSystem('settings', 'language');

    const report = { added: 0, replaced: 0, skipped: 0, removed: 0, restored: written, byStore: {} };
    for (const name of stores) {
      report.byStore[name] = { restored: data[name].length, removed: gone[name] };
      report.removed += gone[name];
      report.replaced += data[name].length;
    }

    // The file carries its OWN `changeCounter` and `lastExportAt`, and both are
    // stale by construction: `downloadBackup` exports first and resets the
    // counter afterwards, so what travels in the file is the count from before
    // the export. Restoring them verbatim would tell her she has unsaved work
    // at the exact moment the database equals a file on her disk. It does not,
    // and the file's own date is the truthful answer to when it was last saved.
    await setSetting('changeCounter', 0);
    await setSetting('lastExportAt', payload.exportedAt || new Date().toISOString());
    // A handoff address from another session, pointing at a screen this restore
    // may have just removed the record for (§13bo).
    await setSetting('returnTo', null);

    return report;
  }

  const report = { added: 0, replaced: 0, skipped: 0, removed: 0, byStore: {} };

  for (const name of stores) {
    const existing = new Set((await all(name)).map(r => r[STORES[name].keyPath]));
    let added = 0, skipped = 0;

    for (const row of data[name]) {
      if (existing.has(row[STORES[name].keyPath])) { skipped++; continue; }
      await putRaw(name, row);
      added++;
    }

    report.byStore[name] = { added, skipped };
    report.added += added;
    report.skipped += skipped;
  }

  return report;
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------- state

/**
 * How exposed the data currently is: how many edits since the last export,
 * and how long ago that was. Shown plainly rather than as a nag — the point
 * is that the answer should never be a surprise.
 */
export async function backupState() {
  const lastExportAt = await getSetting('lastExportAt', null);
  const changes = await getSetting('changeCounter', 0);
  const days = lastExportAt
    ? Math.floor((Date.now() - new Date(lastExportAt).getTime()) / 86400000)
    : null;
  return { lastExportAt, changes, days, never: !lastExportAt };
}

/**
 * Ask the browser not to evict this database when storage runs low.
 * Without it, data is "best effort" and can be cleared silently. Also reports
 * whether storage persists at all — in a private window it does not, and
 * anything entered there is lost when the window closes.
 */
export async function ensurePersistence() {
  const out = { supported: false, persisted: false, quota: null, usage: null };
  if (!navigator.storage) return out;

  out.supported = true;
  try {
    out.persisted = await navigator.storage.persisted?.() || false;
    if (!out.persisted && navigator.storage.persist) {
      out.persisted = await navigator.storage.persist();
    }
    const est = await navigator.storage.estimate?.();
    if (est) { out.quota = est.quota; out.usage = est.usage; }
  } catch { /* nothing to do; the flag simply stays false */ }

  await open();
  return out;
}

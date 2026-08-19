// backup.js — the personal safety net (§11).
//
// Distinct from reference packs (§10): a backup is a round trip of everything
// the owner has entered, meant to restore a device. A pack carries knowledge
// and merges. Mixing the two would make both unreliable.

import { STORES, all, put, getSetting, setSetting, open } from './db.js';

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
 * Restore from a backup file.
 *
 * @param {'merge'|'replace'} mode
 *   merge   — adds records whose id is not already present, touches nothing else.
 *             The safe default: it can only ever add.
 *   replace — writes every record from the file over what is there. Used when
 *             moving to a new device or recovering from real loss.
 */
export async function importBackup(payload, mode = 'merge') {
  if (payload?.format !== 'bagra-backup') {
    throw new Error('not a Багра backup file');
  }
  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error('backup is from a newer version of the app');
  }

  const report = { added: 0, replaced: 0, skipped: 0, byStore: {} };

  for (const [name, rows] of Object.entries(payload.data || {})) {
    if (!STORES[name] || SKIP.includes(name)) continue;

    const existing = new Set((await all(name)).map(r => r[STORES[name].keyPath]));
    let added = 0, replaced = 0, skipped = 0;

    for (const row of rows) {
      const key = row[STORES[name].keyPath];
      if (existing.has(key)) {
        if (mode === 'replace') { await put(name, row); replaced++; }
        else skipped++;
      } else {
        await put(name, row);
        added++;
      }
    }

    report.byStore[name] = { added, replaced, skipped };
    report.added += added;
    report.replaced += replaced;
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

// try-language-default.mjs — the language a device opens in (§13fi).
//
//   no stored choice          → English, and nothing is written
//   stored `bg` / stored `en` → that, on every launch
//   a click on a language     → stored through setLang, and read back
//   a restore                 → never changes the device's choice
//
// Each launch is a separate process: the application reads the setting once,
// at start-up, and a module graph cannot be booted twice in one process. The
// parent spawns one child per starting state; each child boots the real app in
// jsdom over its own empty fake IndexedDB and reports what it saw.
//
// Requires jsdom and fake-indexeddb, as check-boot.mjs does.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT);

const mode = process.argv[2] === '--child' ? process.argv[3] : null;

if (mode) {
  // ---- one launch --------------------------------------------------------
  const { JSDOM } = await import('jsdom');
  await import('fake-indexeddb/auto');
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
    url: 'https://example.org/bagra/', runScripts: 'outside-only',
  });
  const define = (name, value) =>
    Object.defineProperty(global, name, { value, configurable: true, writable: true });
  for (const k of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Image',
    'FileReader', 'Blob', 'URL', 'Event', 'MouseEvent', 'CustomEvent', 'MutationObserver'])
    define(k, k === 'window' ? dom.window : dom.window[k]);
  define('alert', () => {});
  define('confirm', () => true);
  define('crypto', { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) });
  define('fetch', async (u) => {
    const p = String(u).replace(/^.*\/bagra\//, '');
    if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
  });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const db = await import('../db.js');
  // The starting state: a device that has chosen, or one that never has.
  if (mode !== 'none') await db.setSetting('language', mode);
  const shellLang = document.documentElement.lang;   // before the app runs

  await import('../app.js');
  await wait(1500);
  const { getLang } = await import('../i18n.js');

  const seen = () => {
    const space = document.querySelector('#topbar .spacebtn span')?.textContent || '';
    const pressed = [...document.querySelectorAll('[data-lang][aria-pressed="true"]')]
      .map(b => b.dataset.lang);
    return { lang: getLang(), html: document.documentElement.lang, space,
             cyrillic: /[А-Яа-я]/.test(space), pressed };
  };
  const out = { shellLang, boot: seen(), stored: (await db.get('settings', 'language'))?.value ?? null };

  // The switch, through the interface a person uses — the button, which calls
  // setLang — and not by writing the setting behind its back.
  if (mode === 'none') {
    const click = async (code) => {
      const b = document.querySelector(`[data-lang="${code}"]`);
      b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await wait(300);
      return { ...seen(), stored: await db.getSetting('language', null) };
    };
    out.toBg = await click('bg');
    out.toEn = await click('en');
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the parent -------------------------------------------------------------

let failed = false;
const ok = (m) => console.log('  ok   ' + m);
const fail = (m) => { failed = true; console.log('  FAIL ' + m); };
const is = (got, want, m) => JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

const launch = (start) => {
  const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, '--child', start],
    { encoding: 'utf8', timeout: 60000 });
  const line = (r.stdout || '').split('\n').find(l => l.startsWith('RESULT '));
  if (!line) { fail(`the launch with ${start} did not report: ${(r.stderr || r.stdout).slice(0, 300)}`); return null; }
  return JSON.parse(line.slice(7));
};

console.log('a device that has never chosen');
const none = launch('none');
if (none) {
  is(none.shellLang, 'en', 'the page shell says English before the application has run');
  is(none.boot.lang, 'en', 'the application initialises in English');
  is(none.boot.html, 'en', 'and <html lang> follows it');
  is([none.boot.cyrillic, none.boot.pressed], [false, ['en']],
     'the visible bar is English, and the English button is the pressed one');
  is(none.stored, null, 'the default was applied without writing a setting');
  is([none.toBg.lang, none.toBg.html, none.toBg.stored, none.toBg.cyrillic], ['bg', 'bg', 'bg', true],
     'choosing Bulgarian switches the interface and stores bg');
  is([none.toEn.lang, none.toEn.html, none.toEn.stored, none.toEn.cyrillic], ['en', 'en', 'en', false],
     'choosing English again switches back and stores en');
}

console.log('a device that chose Bulgarian');
const bg = launch('bg');
if (bg) {
  is([bg.boot.lang, bg.boot.html, bg.boot.cyrillic, bg.boot.pressed], ['bg', 'bg', true, ['bg']],
     'it opens in Bulgarian, <html lang> and the bar included');
  is(bg.stored, 'bg', 'and its choice is still stored');
}

console.log('a device that chose English');
const en = launch('en');
if (en) {
  is([en.boot.lang, en.boot.html, en.boot.cyrillic, en.boot.pressed], ['en', 'en', false, ['en']],
     'it opens in English');
  is(en.stored, 'en', 'and its choice is still stored, not dropped as equal to the default');
}

// The restore half lives in try-backup-restore.mjs, beside the rest of the
// restore contract; it is not repeated here.

if (failed) { console.log('language default FAILED'); process.exit(1); }
console.log('language default passed');

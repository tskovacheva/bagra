// ui.js — the shared rendering vocabulary.
//
// Fixed here once so seven modules do not end up looking as though seven
// people wrote them. Nothing in this file knows about any particular module.

import { all } from './db.js';
import { text, getLang, t, needsTranslation } from './i18n.js';

let _vocab = null;

export async function vocab() {
  if (!_vocab) _vocab = await all('vocabulary');
  return _vocab;
}

export function invalidateVocab() { _vocab = null; }

// All terms of one dimension, in their declared order.
export async function terms(dimension) {
  return (await vocab())
    .filter(v => v.dimension === dimension)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// A single code rendered in the current language.
export async function label(dimension, code) {
  if (!code) return '';
  const row = (await vocab()).find(v => v.dimension === dimension && v.code === code);
  return row ? text(row.label) : code;
}

export async function options(dimension, selected, placeholder = '—') {
  const list = await terms(dimension);
  return `<option value="">${placeholder}</option>` + list.map(v =>
    `<option value="${v.code}"${v.code === selected ? ' selected' : ''}>${esc(text(v.label))}</option>`
  ).join('');
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(getLang() === 'bg' ? 'bg-BG' : 'en-GB',
    { year: 'numeric', month: 'short', day: 'numeric' });
};

export const today = () => new Date().toISOString().slice(0, 10);

// Page furniture, identical across modules.
export function page({ title, sub, actions = '', body }) {
  return `
    <div class="pagehead">
      <div>
        <h1>${esc(title)}</h1>
        ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
      </div>
      <div class="pageactions">${actions}</div>
    </div>
    ${body}`;
}

export const panel = (inner, cls = '') => `<div class="panel ${cls}">${inner}</div>`;

export const empty = (msg, hint = '') =>
  `<div class="emptystate"><p>${esc(msg)}</p>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;

export const field = (labelText, control, hint = '') => `
  <label class="field">
    <span class="fieldlabel">${esc(labelText)}</span>
    ${control}
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
  </label>`;

// A short, quiet notice. Used for derived facts and warnings that should be
// noticed but not shouted — the app states what it inferred, and why.
export const note = (msg, kind = '') =>
  `<p class="note ${kind}">${msg}</p>`;


// A bilingual reference field (§13.1, kind 3). The second language is optional
// and never blocks: the record is complete with only one half filled. The
// translation half stays collapsed until asked for, with a quiet marker when
// it is empty.
export function pairField(labelText, name, pair = {}, { multiline = false, placeholder = '' } = {}) {
  const other = getLang() === 'bg' ? 'en' : 'bg';
  const primary = getLang();
  const control = (langCode, value) => multiline
    ? `<textarea data-pair="${name}.${langCode}" rows="3" placeholder="${esc(placeholder)}">${esc(value || '')}</textarea>`
    : `<input type="text" data-pair="${name}.${langCode}" value="${esc(value || '')}" placeholder="${esc(placeholder)}">`;

  const missing = needsTranslation(pair, other);

  return `
    <div class="field pairfield">
      <span class="fieldlabel">${esc(labelText)}
        ${missing ? `<span class="untranslated" title="${esc(t('i18n.missing'))}">${esc(t('i18n.missingShort'))}</span>` : ''}
      </span>
      ${control(primary, pair[primary])}
      <details class="pairalt"${missing ? '' : ' open'}>
        <summary>${esc(t('i18n.otherLang', { lang: other.toUpperCase() }))}</summary>
        ${control(other, pair[other])}
      </details>
    </div>`;
}

// Reads every [data-pair] control back into { bg, en } objects on the target.
export function readPairs(root, target) {
  for (const el of root.querySelectorAll('[data-pair]')) {
    const [name, langCode] = el.dataset.pair.split('.');
    target[name] = target[name] || {};
    target[name][langCode] = el.value.trim();
  }
}

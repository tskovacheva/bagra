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

  // Only flag a missing translation once there is something to translate.
  // An empty record is not "untranslated", it is empty.
  const missing = !!(pair && pair[primary] && needsTranslation(pair, other));

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


// A short ordered vocabulary reads better as a row of buttons than as a
// dropdown: the whole scale is visible at once, and choosing is one click.
export async function segmented(dimension, name, selected, { allowEmpty = true } = {}) {
  const list = await terms(dimension);
  const cells = list.map(v => `
    <label class="seg">
      <input type="radio" name="${name}" data-f="${name}" value="${v.code}"${v.code === selected ? ' checked' : ''}>
      <span>${esc(text(v.label))}</span>
    </label>`).join('');
  const none = allowEmpty
    ? `<label class="seg"><input type="radio" name="${name}" data-f="${name}" value=""${!selected ? ' checked' : ''}><span>—</span></label>`
    : '';
  return `<div class="segrow">${none}${cells}</div>`;
}


// A modal used for decisions that must not be taken blindly — chiefly the
// preview before a reference pack overwrites anything.
export function dialog({ title, body, confirmLabel, cancelLabel }) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'modalback';
    el.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        <div class="modalbody">${body}</div>
        <div class="modalfoot">
          <button class="btn quiet" data-cancel>${esc(cancelLabel)}</button>
          <button class="btn primary" data-ok>${esc(confirmLabel)}</button>
        </div>
      </div>`;
    const close = (value) => { el.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-cancel]')) close(false);
      if (e.target.closest('[data-ok]')) close(true);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(el);
    el.querySelector('[data-ok]').focus();
  });
}


/**
 * A field with a confidence marker attached to the claim it holds.
 *
 * Three dots rather than words: at a glance one sees which numbers are solid
 * and which are somebody's guess, without the marker competing with the value.
 */
export async function confField(labelText, control, path, current, hint = '') {
  const list = await terms('claim_confidence');

  // Dots alone proved invisible: the marker went unnoticed until pointed out,
  // which defeats its purpose. The chosen level now reads as a word; the
  // alternatives stay as dots so the row does not compete with the value.
  const chosen = list.find(v => v.code === current);

  const options = [{ code: '', label: { bg: '—', en: '—' } }, ...list].map(v => `
    <label class="conf conf-${v.code || 'none'}${v.code === (current || '') ? ' picked' : ''}">
      <input type="radio" name="conf.${path}" data-conf="${path}" value="${v.code}"${v.code === (current || '') ? ' checked' : ''}>
      <span class="confdot"></span>
      <span class="conftext">${esc(text(v.label))}</span>
    </label>`).join('');

  return `
    <div class="field conffield">
      <span class="fieldlabel">${esc(labelText)}</span>
      ${control}
      <div class="confrow" role="radiogroup" aria-label="${esc(t('plants.confidence'))}">
        <span class="conflabel">${esc(t('plants.confidence'))}:</span>
        ${options}
      </div>
      ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
    </div>`;
}

/** Reads every confidence marker back into a { path: code } map. */
export function readConfidence(root) {
  const out = {};
  for (const el of root.querySelectorAll('[data-conf]')) {
    if (el.checked && el.value) out[el.dataset.conf] = el.value;
  }
  return out;
}


// ---------------------------------------------------------------- read mode
//
// Most records are written once and read many times. A plant profile is edited
// on the evening it is researched and consulted every time one walks past the
// bed. Opening it as a form makes administering the record look like the main
// thing one does with it, and buries the four or five facts actually wanted at
// the bench among fifty controls.

/** One fact. Renders nothing at all when there is nothing to say. */
export function fact(labelText, value, hint = '') {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  const shown = Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
  if (!shown) return '';
  return `
    <div class="fact">
      <span class="factlabel">${esc(labelText)}</span>
      <span class="factvalue">${shown}</span>
      ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
    </div>`;
}

export const facts = (rows) => {
  const inner = rows.filter(Boolean).join('');
  return inner ? `<div class="factgrid">${inner}</div>` : '';
};

/** A prose block from a { bg, en } pair, with paragraphs preserved. */
export function prose(pair) {
  const body = text(pair);
  if (!body) return '';
  return `<div class="prose">${body.split('\n').filter(Boolean)
    .map(line => `<p>${esc(line)}</p>`).join('')}</div>`;
}

/** A section that only appears when it has content. */
// A star, not a heart: the same mark on a plant, a recipe and a combination,
// and one that reads at list size. `data-fav` carries the id so a list row and
// a read header can share one handler.
// Going to another module's record. Assigning an unchanged hash fires no
// event, so the navigation would silently do nothing — which is exactly what
// happens when a piece already at `#/trials/<id>` is asked to open it again.
// Lives here rather than in app.js because modules import ui.js, and importing
// app.js back would be a cycle.
export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new Event('hashchange'));
  else location.hash = hash;
}

export const favStar = (record, big = false) => `
  <button class="fav${record?.favorite ? ' on' : ''}${big ? ' big' : ''}"
          data-fav="${record?.id || ''}"
          aria-pressed="${record?.favorite ? 'true' : 'false'}"
          title="${t(record?.favorite ? 'common.unfavorite' : 'common.favorite')}"
          >${record?.favorite ? '★' : '☆'}</button>`;

export const readBlock = (title, inner) =>
  inner ? panel(`${title ? `<h2>${esc(title)}</h2>` : ''}${inner}`) : '';

/**
 * A group in an editing form that can be folded away.
 *
 * The summary carries a hint of what is inside, so collapsing does not mean
 * hiding: a section reading "3 filled" is still answering a question from the
 * outside.
 */
export const foldable = (title, inner, { open = false, badge = '' } = {}) => `
  <details class="fold"${open ? ' open' : ''}>
    <summary><span class="foldtitle">${esc(title)}</span>${badge ? `<span class="foldbadge">${esc(badge)}</span>` : ''}</summary>
    <div class="foldbody">${inner}</div>
  </details>`;

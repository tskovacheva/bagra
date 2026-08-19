// ui.js — the shared rendering vocabulary.
//
// Fixed here once so seven modules do not end up looking as though seven
// people wrote them. Nothing in this file knows about any particular module.

import { all } from './db.js';
import { text, getLang, t, needsTranslation } from './i18n.js';

let _vocab = null;

export async function vocab() {
  // Bands are terms too. They live in their own store because they carry a
  // range as well as a label, but `label()` and `terms()` only ever read the
  // vocabulary, so every band code rendered as its raw English self: a chip
  // reading "калиева стипца (medium)", and empty dropdowns for band and pH in
  // the reference search, since `options('concentration', …)` found nothing.
  // The two stores are read as one list here — nothing else needs to know.
  if (!_vocab) _vocab = [...await all('vocabulary'), ...await all('bands')];
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

/**
 * What a term means, when the label alone does not say it.
 *
 * Most terms need nothing — „лист" explains itself. A few carry knowledge in the
 * word: the owner, who is the domain expert, did not know that „акумулатор"
 * meant a plant that can stand in for a mordant (§13aw). A label that has to be
 * learned from somewhere else is a label that will be misread.
 *
 * Empty for terms that carry no description, so callers can render nothing.
 */
export async function describe(dimension, code) {
  if (!code) return '';
  const row = (await vocab()).find(v => v.dimension === dimension && v.code === code);
  return row?.description ? text(row.description) : '';
}

export async function options(dimension, selected, placeholder = '—') {
  const list = await terms(dimension);
  // A code the vocabulary does not know must still survive the form. Built only
  // from the vocabulary, the select falls back to the empty option, and saving
  // a record without touching it silently erases the value — avocado lost its
  // `seed` part that way, from a form nobody had edited. The stray code is
  // shown as itself, so it reads as something wrong rather than as nothing.
  const stray = selected && !list.some(v => v.code === selected)
    ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>`
    : '';
  return `<option value="">${placeholder}</option>` + stray + list.map(v =>
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
// ---------------------------------------------------------------- actions
//
// One mark per semantic action, in one place (§13bo).
//
// The audit found the opposite of what was expected: not too many icons, but a
// sprite of fifty symbols used in seven modules out of fourteen, no semantic
// action marked at all, one id defined twice — so every use of it drew the
// wrong picture — and one symbol left behind by a state that no longer exists.
//
// A map rather than a habit, because a habit drifts and a map can be checked.
export const ACTION_ICONS = {
  add: 'a-add', edit: 'a-edit', delete: 'a-delete', duplicate: 'a-copy',
  favourite: 'a-star', back: 'a-back', search: 'a-search', filter: 'a-filter',
  photo: 'a-photo', more: 'a-more',
  save: null,          // the primary button carries the weight; a mark on it is noise
  cancel: null,

  // The domain actions. These already had marks from §13bh; naming them here is
  // what stops a second one being drawn for the same thing.
  plant: 'i-plant', fabric: 'i-fabric', recipe: 'i-recipe', trial: 'i-trial',
  wash: 'i-drops', tannin: 'i-layers', mordant: 'i-flask', dye: 'i-beaker',
  ecoprint: 'i-plant', repeat: 'i-again', finish: 'i-finish',
};

// The four levels, named. `quiet` was doing duty for two different things —
// second action on a screen, and add-a-row inside a list — and they do not want
// the same weight.
const LEVEL_CLASS = {
  primary: 'btn primary',
  secondary: 'btn quiet',
  contextual: 'btn quiet contextual',
  destructive: 'btn danger quiet',
};

/**
 * A button that knows what kind of action it is.
 *
 * `actionBtn('edit', t('common.edit'), 'data-edit', 'primary')`
 *
 * Icon and text together, never icon alone: an action that cannot be read is
 * an action that has to be learned, and a mark accompanies a label rather than
 * replacing it (§13ac).
 */
export function actionBtn(kind, text, attrs = '', level = 'secondary') {
  const mark = ACTION_ICONS[kind];
  return `<button class="${LEVEL_CLASS[level] || LEVEL_CLASS.secondary}" ${attrs}>${
    mark ? icon(mark) : ''}${esc(text)}</button>`;
}

// ------------------------------------------------------------------ headers
//
// Four variants over one `page()`, so the screens feel related without being
// forced into one shape (§13bo).

/** A list: the module's own name, and the one thing you come here to do. */
export const pageList = ({ title, sub, primary = '', extra = '', body }) =>
  page({ title, sub, actions: `${extra}${primary}`, body });

/**
 * A record being read. The primary action is EDIT — it was `new` in eight
 * modules, which offered to create another of the thing you are looking at as
 * the most prominent act on the screen.
 *
 * The way out is the module, named, and it is an address rather than a step
 * back through history: the address is the state (§13q), and a bookmarked or
 * shared record has no history to step back through.
 */
export const pageRead = ({ title, sub, up, upLabel, primary = '', extra = '', body }) =>
  page({
    title, sub,
    actions: `${up ? backTo(up, upLabel) : ''}${extra}${primary}`,
    body,
  });

/** A form: cancel quietly, save loudly. */
export const pageForm = ({ title, sub, save = '', cancel = '', extra = '', body }) =>
  page({ title, sub, actions: `${cancel}${extra}${save}`, body });

/** A workflow step: the way on is the primary, the way out is quiet. */
export const pageWork = ({ title, sub, primary = '', extra = '', up, upLabel, body }) =>
  page({
    title, sub,
    actions: `${up ? backTo(up, upLabel) : ''}${extra}${primary}`,
    body,
  });

/** ← Fabrics, rather than the word "back". Says where it goes. */
export const backTo = (hash, label) =>
  `<button class="btn quiet upto" data-goto="${esc(hash)}">${icon('a-back')}${esc(label)}</button>`;

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

// An empty panel used to render as an empty box: the trial form carried one for
// months between the enhancements and the fabrics, because a template branch
// that produced nothing still got its wrapper. A container with no content is
// not a container.
export const panel = (inner, cls = '') =>
  String(inner ?? '').trim() ? `<div class="panel ${cls}">${inner}</div>` : '';

export const empty = (msg, hint = '') =>
  `<div class="emptystate"><p>${esc(msg)}</p>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;

export const field = (labelText, control, hint = '') => `
  <label class="field">
    <span class="fieldlabel">${esc(labelText)}</span>
    ${control}
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
  </label>`;

/**
 * The same, for a control group that is not one control (§13as).
 *
 * A `<label>` forwards a press anywhere inside it to the control it labels. That
 * is exactly right for a caption above a text box and wrong for anything holding
 * buttons of its own: the plan photographs sat in a `field()`, so the × on each
 * one was swallowed by the label and the photograph could not be removed. The
 * button was there, it highlighted, and nothing happened.
 *
 * Rule: `field` for one control, `fieldset` for a group that contains its own
 * buttons.
 */
export const fieldGroup = (labelText, control, hint = '') => `
  <div class="field">
    <span class="fieldlabel">${esc(labelText)}</span>
    ${control}
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
  </div>`;

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
export async function confField(labelText, control, path, current, hint = '', approx = null) {
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
        ${approx === null ? '' : `
          <label class="check approxcheck" title="${esc(t('common.approxHint'))}">
            <input type="checkbox" data-approx="${path}"${approx ? ' checked' : ''}>
            ${t('common.approx')}
          </label>`}
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

// Read beside the confidence and stored the same way: a map keyed by the same
// field path, so a field that is not marked simply is not in it (§13ai).
export function readApprox(root) {
  const out = {};
  for (const el of root.querySelectorAll('[data-approx]')) {
    if (el.checked) out[el.dataset.approx] = true;
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

// A real symbol rather than the ★ / ☆ glyphs (§13bo). Two glyphs from the same
// font differ in weight as well as in fill, so a starred row read as heavier
// than an unstarred one for reasons nothing to do with being starred. One
// outline, filled or not.
export const favStar = (record, big = false) => `
  <button class="fav${record?.favorite ? ' on' : ''}${big ? ' big' : ''}"
          data-fav="${record?.id || ''}"
          aria-pressed="${record?.favorite ? 'true' : 'false'}"
          title="${t(record?.favorite ? 'common.unfavorite' : 'common.favorite')}"
          >${icon('a-star')}</button>`;

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


// A saved record used to look exactly like an unsaved one, so the owner reported
// "Save does not return to the list, even though it saves" — the destination was
// defensible, the silence was not. Modules with a read view show the record after
// saving; that only reads as a transition if something says so.
export function flash(message) {
  const el = document.getElementById('flash') || (() => {
    const d = document.createElement('div');
    d.id = 'flash';
    document.body.appendChild(d);
    return d;
  })();
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 2200);
}


// Moved out of app.js so modules can use it too: the sprite is one set of marks
// for the whole application, and a second copy of this helper would be the
// beginning of two.
export const icon = (id) => `<svg width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${id}"></use></svg>`;


/**
 * How much of something there is, as a row of segments (§13bh).
 *
 * `trace`, `moderate`, `high`, `dominant` are four words that all take the same
 * space and read at the same weight, so a list of them has to be read one at a
 * time. Four filled segments out of four is read at a glance, and the eye can
 * compare two rows without reading either.
 *
 * A mark accompanies a label and never replaces it, so the word stays beside the
 * bar — the rule that also keeps this legible to anyone who cannot see the bar,
 * and searchable, which a picture is not.
 *
 * `aria-hidden` on the bar for the same reason: the word is already there, and a
 * screen reader announcing "four of four" after it would say everything twice.
 */
export const levelBar = (filled, of, label) => `
  <span class="level">
    <span class="levelbar" aria-hidden="true">${
      Array.from({ length: of }, (_, i) =>
        `<span class="seg${i < filled ? ' on' : ''}"></span>`).join('')
    }</span>
    <span class="levelword">${esc(label)}</span>
  </span>`;


// A search box, and the matcher behind it.
//
// Typing beats a row of chips once a list is long enough that scanning it costs
// more than typing three letters. The chips stay where they answer a question
// typing cannot — "show me only the mordant accumulators" is not a word anyone
// would search for.
export const searchBox = (value, placeholder) => `
  <label class="searchbox">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" aria-hidden="true"><use href="#i-reference"></use></svg>
    <input type="search" data-search value="${esc(value || '')}"
           placeholder="${esc(placeholder)}" autocomplete="off">
    ${value ? `<button type="button" class="searchclear" data-searchclear aria-label="×">×</button>` : ''}
  </label>`;

// Accent- and case-insensitive contains, over whatever fields the caller names.
// Deliberately not fuzzy: a dyer looking for "дъб" wants дъб, and a match on
// "дърво" three rows down is noise, not help.
export const norm = (s) => String(s ?? '').toLowerCase().trim();

export function matches(query, ...values) {
  const q = norm(query);
  if (!q) return true;
  return values.some(v => norm(v).includes(q));
}

// A searchable picker over a long list, built from a native datalist so it works
// on a phone keyboard without a custom dropdown to get wrong.
//
// The visible input holds the NAME and the hidden one holds the id, because the
// form reader reads `value` off whatever carries the data attribute. Typing a
// name that matches nothing leaves the previous id in place rather than
// silently clearing it — losing a plant because of a typo would be the worst
// possible outcome of a convenience.
export function pickerInput({ listId, attr, index, field, selectedId, items, placeholder }) {
  const chosen = items.find(x => x.id === selectedId);
  return `
    <span class="picker">
      <input type="text" list="${esc(listId)}" data-picker="${esc(attr)}:${index}:${esc(field)}"
             value="${esc(chosen ? chosen.name : '')}" placeholder="${esc(placeholder)}"
             autocomplete="off">
      <input type="hidden" data-${esc(attr)}="${index}.${esc(field)}" value="${esc(selectedId || '')}">
      <datalist id="${esc(listId)}">
        ${items.map(x => `<option value="${esc(x.name)}"></option>`).join('')}
      </datalist>
    </span>`;
}

/**
 * Carry the column headings into the cells, so a table can be read as stacked
 * rows on a narrow screen (§13ae).
 *
 * Done once here, at render, rather than by writing `data-label` into the
 * markup of eight modules: eight copies of the same fact drift, and a ninth
 * list built later would inherit nothing. A cell whose column has no heading —
 * the favourite star, the selection box — gets no label, which is correct: it
 * has nothing to say in words.
 *
 * The transformation itself is CSS. This only supplies what CSS cannot read,
 * since `attr()` cannot reach across the table to the header row.
 */
export function labelCells(root) {
  for (const table of root.querySelectorAll('table.grid')) {
    const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!heads.length) continue;
    for (const row of table.querySelectorAll('tbody tr')) {
      let lead = false;
      [...row.children].forEach((cell, i) => {
        const label = heads[i] || '';
        if (label) cell.setAttribute('data-label', label);
        else cell.removeAttribute('data-label');
        // The first cell whose column is named heads the card. Decided by
        // position rather than by a class written into eight modules, and it
        // falls out right everywhere: the star and the selection box have no
        // heading, so they are skipped, and what remains first is the name.
        cell.classList.toggle('leadcell', label && !lead);
        if (label) lead = true;
        // A cell with nothing in it costs a whole line of the card to say
        // "МОСТРА  —". In a table the empty cell is the shape of the column and
        // has to stay; in a stack it is a line that carries no fact. Marked
        // rather than emptied, so the desk view is untouched.
        const written = cell.textContent.replace(/[—–-]/g, '').trim();
        cell.classList.toggle('emptycell', !written && !cell.querySelector('img,span[style],input,button'));
        // Prose, marked by its length rather than by a class. `.clip` exists on
        // some tables and not on others — the sources note has none, and came
        // out 405px tall on a phone, one row filling half the screen. Length is
        // the thing that actually matters and it is the same fact in every
        // list.
        cell.classList.toggle('longcell', !cell.classList.contains('leadcell') && written.length > 90);
      });
    }
  }
}


/**
 * A number that may be somebody's estimate rather than a measurement (§13ai).
 *
 * The smallest useful form of a larger idea recorded in §16: a number field has
 * two states, empty and a number, while the truth has four — measured, about,
 * unknown, and not applicable. Two of those four collapse into "empty" and two
 * into the number itself, so the application cannot tell a thermometer reading
 * from a good guess, or "nobody knows" from "I have not got to it yet".
 *
 * Only "about" is built for now, because it is the one that changes what the
 * application *says*: a warning that reads "78 against a ceiling of 80" is a
 * confident statement about a guess.
 */
export const approxNumber = (value, isApprox, unit = '') => {
  if (value == null || value === '') return '';
  const shown = `${value}${unit ? ' ' + unit : ''}`;
  return isApprox ? `${t('common.approxMark')}\u00A0${shown}` : shown;
};

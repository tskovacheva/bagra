// studio-ui.js — the Studio System drawn (§13gc): the badge, the working label
// and its print. Every screen that shows a piece's studio status draws it here,
// from studio.js, so the filter chip, the row, the record, the label and the
// Library legend cannot disagree.

import { esc, icon, fmtDate } from './ui.js';
import { t, getLang } from './i18n.js';
import { deriveStudioStatus, deriveStudioTreatmentSummary, studioLabel } from './studio.js';

// The status colour as two custom properties: the colour itself, for the mark,
// the edge and the label; and a light tint of it, for a background that keeps
// dark text readable. Inline, because the colour is the data.
export function studioStyle(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `--st:${hex};--st-tint:rgba(${r},${g},${b},.22)`;
}

/** The badge: icon, code, name — the colour never alone. `finished` beside it.
 *  `ctx.trials` lets a work prove a colouring the actions do not hold (§13gf). */
export function studioBadge(fabric, { code = true, ctx = {} } = {}) {
  const s = deriveStudioStatus(fabric, ctx);
  const lang = getLang();
  return `<span class="studiobadge" data-studio="${s.code}" style="${studioStyle(s.status.hex)}">${
    icon(s.status.icon)}${code ? `<b>${esc(s.code)}</b><span class="sep">·</span>` : ''}<span>${esc(studioLabel(s.status, lang))}</span></span>${
    s.finished ? ` <span class="chip">${esc(t('fabrics.studio.finished'))}</span>` : ''}`;
}

/**
 * The working label (§13gc, redrawn at §13gf): 70 × 40 mm, the piece's own tag
 * number, its stage as code and name, what did it, and when.
 *
 * The label itself is neutral — linen on screen, white on paper — with dark
 * text: Bagra does not print coloured labels; a person who wants the colour
 * prints on paper of that colour. The stage's colour appears only as a mark:
 * a thin edge and a dot before the code, in the same token as the chips and
 * badges. The code, the name and the stage's icon carry everything, so the
 * label says it all in black and white.
 */
export function workingLabel(fabric, ctx) {
  const s = deriveStudioStatus(fabric, ctx);
  const lang = getLang();
  const sum = deriveStudioTreatmentSummary(fabric, ctx, lang);
  return `<div class="worklabel" data-studio="${s.code}" style="${studioStyle(s.status.hex)}">
    <div class="wl-id">${esc(fabric.label || '—')}</div>
    <div class="wl-stage"><span class="wl-dot" aria-hidden="true"></span>${icon(s.status.icon)}<span>${esc(s.code)} · ${esc(studioLabel(s.status, lang).toLocaleUpperCase(lang))}</span></div>
    ${sum.text ? `<div class="wl-what">${esc(sum.text)}</div>` : ''}
    ${sum.date ? `<div class="wl-date">${esc(fmtDate(sum.date))}</div>` : ''}
  </div>`;
}

/**
 * Print one label and nothing else. The label is placed in a container of its
 * own at the end of the document; the print stylesheet hides every other child
 * of <body> while `printing-label` is set, and the container goes after.
 */
export function printWorkingLabel(fabric, ctx) {
  document.getElementById('printlabel')?.remove();
  const box = document.createElement('div');
  box.id = 'printlabel';
  box.innerHTML = workingLabel(fabric, ctx);
  document.body.appendChild(box);
  document.body.classList.add('printing-label');
  const done = () => {
    document.body.classList.remove('printing-label');
    box.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

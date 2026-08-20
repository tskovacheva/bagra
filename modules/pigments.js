// modules/pigments.js — making a pigment, which is work on a SUBSTANCE (§13bx).
//
// A trial is work on CLOTH: it has pieces, each with its own placement and its
// own outcome. A batch has one output — one quantity, one quality, one colour.
// Same skeleton, different subject, and deliberately not forced into one
// another; the owner asked for them kept visually apart, and the making is long
// and infrequent enough that interleaving it with dye trials would bury it.
//
// THE LIST ANSWERS "WHAT HAVE I MADE", NOT "WHAT DO I HAVE". No remainder is
// tracked, by the owner's own call: a hand-kept remainder goes wrong within
// weeks and then lies confidently. The screen says so in words rather than
// leaving it to be discovered — an unlabelled column of grams read a year later
// looks exactly like stock on hand.
//
// Layout follows the v0 prototype; the code does not. That prototype is React
// and Tailwind, this is vanilla ES modules with no build step, so the
// arrangement was read and rebuilt rather than pasted.

import { all, get, put, remove, newRecord, uid } from '../db.js';
import { t, text, getLang } from '../i18n.js';
import { markClean } from '../dirty.js';
import { page, panel, field, esc, empty, pairField, readPairs, navigate,
         backTo, actionBtn, label, today } from '../ui.js';

// The order the work goes in. Six words, and the words stay — the same reason
// the trial stages are not renumbered (§13.8).
const STAGES = ['extraction', 'laking', 'washing', 'filtering', 'drying', 'grinding'];
const STATUSES = ['planned', 'done', 'failed'];
const QUALITIES = ['good', 'acceptable', 'poor'];

let openId = null;
let draft = null;

function blank() {
  return newRecord({
    status: 'planned',
    date: today(),
    // Null until it has finished. A batch runs over days — three hours of
    // simmering, a night settling, days drying — so one date cannot hold it.
    // The same pair a trial carries (§13au).
    finishedOn: null,
    plantId: '',
    partCode: '',
    rawWeightG: null,
    // A recipe OR a chain, never both. `viaKind` says which, so an empty id
    // never has to be interpreted.
    viaKind: 'recipe',
    viaId: '',
    stages: STAGES.map(code => ({ id: uid(), code, note: { bg: '', en: '' }, date: '', photos: [] })),
    yieldG: null,
    quality: '',
    swatchHex: '',
    swatchName: { bg: '', en: '' },
    photos: [],
    notes: { bg: '', en: '' },
  });
}

// ---- list -----------------------------------------------------------------

async function renderList(root) {
  const batches = await all('pigmentBatches');
  const plants = new Map((await all('plants')).map(p => [p.id, p]));

  // Grouped by source — plant × part — with the batches nested, because two
  // makings of madder are two batches of one thing, not two unrelated rows.
  // Derived here, never stored (§13.6).
  const groups = new Map();
  for (const b of batches) {
    const key = `${b.plantId}|${b.partCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }

  const cards = [];
  for (const [key, list] of groups) {
    const [plantId, partCode] = key.split('|');
    const plant = plants.get(plantId);
    const name = plant ? text(plant.nameCommon) : t('pigments.unknownPlant');
    const part = partCode ? await label('plant_part', partCode) : '';

    // Newest first inside a group.
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // The group's swatch is its most recent successful batch. A failed batch
    // has no colour to show and must not lend the group a blank one.
    const shown = list.find(b => b.status !== 'failed' && b.swatchHex);

    const rows = list.map(b => {
      const failed = b.status === 'failed';
      return `
        <tr data-open="${b.id}">
          <td>${failed ? `<span class="tag">${t('pigments.status.failed')}</span> ` : ''}${
            b.swatchHex && !failed
              ? `<span class="swatch sm" style="background:${esc(b.swatchHex)}"></span> `
              : ''}${esc(text(b.swatchName) || '—')}</td>
          <td>${b.yieldG != null && !failed ? `${b.yieldG} g` : '—'}</td>
          <td>${b.quality && !failed ? esc(t('pigments.quality.' + b.quality)) : '—'}</td>
          <td>${esc(b.date || '')}</td>
        </tr>`;
    }).join('');

    cards.push(panel(`
      <h2>${esc(name)}${part ? ` <span class="hint">${esc(part)}</span>` : ''}</h2>
      ${shown ? `<div class="swatchline">
        <span class="swatch" style="background:${esc(shown.swatchHex)}"></span>
        <span>${esc(text(shown.swatchName))}</span></div>` : ''}
      <table class="grid">
        <thead><tr>
          <th>${t('pigments.batch')}</th>
          <th>${t('pigments.yield')}</th>
          <th>${t('pigments.qualityLabel')}</th>
          <th>${t('common.date')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`));
  }

  root.innerHTML = page({
    title: t('pigments.title'),
    sub: t('pigments.sub'),
    actions: actionBtn('add', t('pigments.new'), 'data-new', 'primary'),
    body: batches.length
      ? `${panel(`<p class="note">${t('pigments.noStockNote')}</p>`)}
         <div style="height:16px"></div>
         ${cards.join('<div style="height:16px"></div>')}`
      : empty(t('pigments.empty'), t('pigments.emptyHint')),
  });
}

// ---- one batch ------------------------------------------------------------

async function renderBatch(root, b, plants, recipes, chains) {
  const plant = plants.find(p => p.id === b.plantId);
  const parts = (plant?.parts || []).map(x => x.partCode);
  const via = b.viaKind === 'chain'
    ? chains.find(c => c.id === b.viaId)
    : recipes.find(r => r.id === b.viaId);

  const stages = (await Promise.all(b.stages.map(async (s, i) => panel(`
    <div class="stagehead"><span class="stepno">${i + 1}</span>
      <h3>${esc(t('pigments.stage.' + s.code))}</h3></div>
    ${field(t('common.notes'), `<textarea data-s="${i}.note" rows="2">${esc(text(s.note))}</textarea>`)}
    ${field(t('common.date'), `<input type="date" data-s="${i}.date" value="${esc(s.date || '')}">`)}
  `)))).join('<div style="height:12px"></div>');

  // A failed batch keeps its stages and its note and shows no result. That is
  // the point of recording it: where it got to is the most useful thing there
  // is for the next attempt. Showing an empty result panel instead would read
  // as unfinished rather than as instructive.
  const failed = b.status === 'failed';

  const partName = b.partCode ? await label('plant_part', b.partCode) : '';
  const heading = plant
    ? `${text(plant.nameCommon)}${partName ? ' — ' + partName : ''}`
    : t('pigments.new');

  root.innerHTML = page({
    title: heading,
    sub: '',
    actions: `${backTo('#/pigments', t('pigments.title'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('pigments.batch')}</h2>
            ${field(t('pigments.statusLabel'), `<select data-f="status">${
              STATUSES.map(s => `<option value="${s}"${b.status === s ? ' selected' : ''}>${
                t('pigments.status.' + s)}</option>`).join('')}</select>`)}
            ${field(t('plants.one'), `<select data-f="plantId"><option value=""></option>${
              plants.map(p => `<option value="${p.id}"${b.plantId === p.id ? ' selected' : ''}>${
                esc(text(p.nameCommon))}</option>`).join('')}</select>`)}
            ${field(t('pigments.part'), `<select data-f="partCode"><option value=""></option>${
              (await Promise.all(parts.map(async pc =>
                `<option value="${pc}"${b.partCode === pc ? ' selected' : ''}>${
                  esc(await label('plant_part', pc))}</option>`))).join('')}</select>`)}
            ${field(t('pigments.raw'), `<input type="number" data-f="rawWeightG" value="${
              b.rawWeightG ?? ''}" min="0" step="1"> g`)}
            <p class="note">${t('pigments.rawWhy')}</p>
          `)}
          <div style="height:16px"></div>
          ${panel(`
            <h2>${t('pigments.dates')}</h2>
            ${field(t('pigments.started'), `<input type="date" data-f="date" value="${esc(b.date || '')}">`)}
            ${field(t('pigments.finished'), `<input type="date" data-f="finishedOn" value="${esc(b.finishedOn || '')}">`)}
          `)}
          <div style="height:16px"></div>
          ${panel(`
            <h2>${t('pigments.via')}</h2>
            <p class="note">${t('pigments.viaHint')}</p>
            ${field(t('pigments.viaKind'), `<select data-f="viaKind">
              <option value="recipe"${b.viaKind === 'recipe' ? ' selected' : ''}>${t('pigments.viaRecipe')}</option>
              <option value="chain"${b.viaKind === 'chain' ? ' selected' : ''}>${t('pigments.viaChain')}</option>
            </select>`)}
            ${field('', `<select data-f="viaId"><option value=""></option>${
              (b.viaKind === 'chain' ? chains : recipes).map(r =>
                `<option value="${r.id}"${b.viaId === r.id ? ' selected' : ''}>${
                  esc(text(r.name))}</option>`).join('')}</select>`)}
          `)}
        </div>
        <div class="col">
          ${panel(`<h2>${t('pigments.process')}</h2>
                   <p class="note">${t('pigments.processHint')}</p>`)}
          <div style="height:12px"></div>
          ${stages}
          <div style="height:16px"></div>
          ${failed ? panel(`
            <h2>${t('pigments.noResult')}</h2>
            <p class="note">${t('pigments.noResultHint')}</p>
          `) : panel(`
            <h2>${t('pigments.result')}</h2>
            ${field(t('pigments.yield'), `<input type="number" data-f="yieldG" value="${
              b.yieldG ?? ''}" min="0" step="1"> g`)}
            ${field(t('pigments.qualityLabel'), `<select data-f="quality"><option value=""></option>${
              QUALITIES.map(q => `<option value="${q}"${b.quality === q ? ' selected' : ''}>${
                t('pigments.quality.' + q)}</option>`).join('')}</select>`)}
            ${field(t('pigments.colour'), `<input type="color" data-f="swatchHex" value="${
              esc(b.swatchHex || '#CCCCCC')}">`)}
            ${pairField(t('pigments.colourName'), 'swatchName', b.swatchName)}
          `)}
          <div style="height:16px"></div>
          ${panel(`
            <h2>${t('pigments.nextTime')}</h2>
            ${pairField('', 'notes', b.notes, { multiline: true })}
            ${openId !== 'new' ? actionBtn('delete', t('pigments.delete'), 'data-delete', 'destructive') : ''}
          `)}
        </div>
      </div>`,
  });
}

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    const k = el.dataset.f;
    draft[k] = el.type === 'number'
      ? (el.value === '' ? null : Number(el.value))
      : el.value;
  }
  for (const el of root.querySelectorAll('[data-s]')) {
    const [i, key] = el.dataset.s.split('.');
    if (key === 'note') draft.stages[Number(i)].note.bg = el.value;
    else draft.stages[Number(i)][key] = el.value;
  }
  readPairs(root, draft);
}

export default {
  id: 'pigments',
  title: () => t('pigments.title'),
  sub: () => t('pigments.sub'),

  open(first) { draft = null; openId = first || null; },
  reset() { openId = null; draft = null; },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('pigmentBatches', openId));
      }
      // An address naming a batch that is gone — a bookmark to something
      // deleted, or Back after deleting it. Rendering throws, and a thrown
      // render leaves the previous screen up, which reads as the address being
      // ignored (§11b).
      if (!draft) return navigate('#/pigments');
      const [plants, recipes, chains] = await Promise.all([
        all('plants'), all('recipes'), all('chains'),
      ]);
      // Only recipes that say they produce a pigment. A recipe with
      // `output: 'none'` is read and followed, never logged (§13by), and
      // offering it here would invite a batch that records the making of a
      // watercolour the owner does not count.
      await renderBatch(root, draft, plants,
        recipes.filter(r => r.output === 'pigment' || r.output === 'extract'), chains);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('a')) return;
      if (e.target.closest('[data-new]')) return navigate('#/pigments/new');
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/pigments/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) return navigate('#/pigments');
      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('pigmentBatches', draft);
        // The put succeeded, so the address change that follows is not a
        // departure from unsaved work (§13ad).
        markClean();
        return navigate('#/pigments');
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('pigments.confirmDelete'))) return;
        await remove('pigmentBatches', draft.id);
        return navigate('#/pigments');
      }
    };

    // Switching between recipe and chain changes which list the second dropdown
    // holds, so the screen is drawn again rather than left showing options from
    // the other kind.
    const kind = root.querySelector('[data-f="viaKind"]');
    if (kind) kind.onchange = async () => {
      readForm(root);
      draft.viaId = '';
      await this.render(root);
    };
  },
};

// modules/plants.js — the reference library's backbone (§4, §13.2).
//
// Structured where the reference engine needs to query — chemistry levels,
// dosing, temperature ceilings, compositional role — and free-form where the
// knowledge is prose. Ten fixed textareas per plant would make entry a chore;
// a book-like list of sections lets each plant say what it has to say.

import { all, get, put, remove, newRecord, uid } from '../db.js';
import { loadPack } from '../seed.js';
import { t, text, getLang } from '../i18n.js';
import { page, panel, field, options, label, esc, empty, pairField, readPairs, segmented } from '../ui.js';

const MONTHS_BG = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Offered when a plant has no sections yet — the shape of a profile, taken
// from how the owner's own guide is organised. Every one is optional.
const SUGGESTED = [
  { bg: 'Идентификация', en: 'Identification' },
  { bg: 'Разпространение и традиция', en: 'Distribution and tradition' },
  { bg: 'Отглеждане', en: 'Cultivation' },
  { bg: 'Размножаване', en: 'Propagation' },
  { bg: 'Грижи и поддръжка', en: 'Care' },
  { bg: 'Вредители и болести', en: 'Pests and diseases' },
  { bg: 'Беритба и обработка', en: 'Harvest and processing' },
  { bg: 'Багрилни качества', en: 'Dye qualities' },
];

let openId = null;
let draft = null;
let filterRole = null;

function shrink(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

function blank() {
  return newRecord({
    nameCommon: { bg: '', en: '' },
    nameBotanical: '',
    family: '',
    role: [],
    compositionalRole: [],
    dyeClass: '',
    availability: '',
    parts: [],
    tempExtractC: { min: null, max: null },
    tempDyeC: { min: null, max: null },
    dryingRatio: null,
    liquorRatio: null,
    steamNote: '',
    harvestMonths: [],
    yearsToMaturity: null,
    lightfastness: '',
    washfastness: '',
    invasive: false,
    toxicity: { bg: '', en: '' },
    colours: [],
    sections: [],
    photoData: null,
  });
}

// ---------------------------------------------------------------- list view

async function renderList(root) {
  const plants = await all('plants');

  const roles = ['dye', 'ecoprint', 'mordant_accumulator'];
  const counts = {};
  for (const p of plants) for (const r of p.role || []) counts[r] = (counts[r] || 0) + 1;

  const tabs = await Promise.all(roles.map(async r => `
    <button class="box${filterRole === r ? ' active' : ''}" data-role="${r}">
      <span class="boxname">${esc(await label('plant_role', r))}</span>
      <span class="boxcount">${counts[r] || 0}</span>
    </button>`));

  const shown = (filterRole ? plants.filter(p => (p.role || []).includes(filterRole)) : plants)
    .sort((a, b) => text(a.nameCommon).localeCompare(text(b.nameCommon)));

  const rows = await Promise.all(shown.map(async p => {
    // Levels are mostly unknown, so filtering by them showed nothing. What is
    // worth seeing at a glance is which classes are present at all.
    const seen = new Set();
    const chem = (p.parts || []).flatMap(pt => pt.chemistry || [])
      .filter(c => c.classCode && !seen.has(c.classCode) && seen.add(c.classCode));
    const top = (await Promise.all(chem.slice(0, 3)
      .map(async c => {
        const name = await label('chemistry_class', c.classCode);
        return c.level ? `${name} (${await label('chemistry_level', c.level)})` : name;
      }))).join(', ');
    const parts = (await Promise.all((p.parts || []).map(pt => label('plant_part', pt.partCode)))).join(', ');
    const roleNames = (await Promise.all((p.role || []).map(r => label('plant_role', r)))).join(', ');
    return `<tr data-open="${p.id}">
      <td class="withthumb">${p.photoData ? `<img class="thumb" src="${p.photoData}" alt="">` : `<span class="thumb empty"></span>`}
        ${esc(text(p.nameCommon) || '—')}</td>
      <td><i>${esc(p.nameBotanical || '')}</i></td>
      <td>${esc(roleNames)}</td>
      <td>${esc(parts)}</td>
      <td>${esc(top)}</td>
      <td>${esc(await label('availability', p.availability))}</td>
    </tr>`;
  }));

  const table = shown.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('plants.col.name')}</th>
        <th>${t('plants.col.botanical')}</th>
        <th>${t('plants.col.role')}</th>
        <th>${t('plants.col.parts')}</th>
        <th>${t('plants.col.chemistry')}</th>
        <th>${t('plants.col.availability')}</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
    : empty(t('plants.empty'), t('plants.emptyHint'));

  root.innerHTML = page({
    title: t('plants.title'),
    sub: t('plants.sub'),
    actions: `<button class="btn quiet" data-reseed>${t('substances.reseed')}</button>
              <button class="btn primary" data-new>${t('plants.new')}</button>`,
    body: `
      <div class="boxes">
        <button class="box${filterRole === null ? ' active' : ''}" data-role="">
          <span class="boxname">${t('common.all')}</span>
          <span class="boxcount">${plants.length}</span>
        </button>
        ${tabs.join('')}
      </div>
      ${panel(table, 'flush')}`,
  });
}

// ---------------------------------------------------------------- form view

async function partRows(p) {
  return (await Promise.all((p.parts || []).map(async (pt, i) => {
    const chem = (await Promise.all((pt.chemistry || []).map(async (c, j) => `
      <div class="chemrow">
        <select data-chem="${i}.${j}.classCode">${await options('chemistry_class', c.classCode, '—')}</select>
        <select data-chem="${i}.${j}.level">${await options('chemistry_level', c.level, t('plants.level'))}</select>
        <button class="btn quiet" data-chem-del="${i}.${j}" aria-label="×">×</button>
      </div>`))).join('');

    const dosing = (pt.dosing || []).map((d, j) => `
      <div class="dosingrow">
        <select data-dose="${i}.${j}.condition">
          <option value=""${!d.condition ? ' selected' : ''}>${t('plants.anyCondition')}</option>
          <option value="dried"${d.condition === 'dried' ? ' selected' : ''}>${t('materials.form.dried')}</option>
          <option value="fresh"${d.condition === 'fresh' ? ' selected' : ''}>${t('materials.form.fresh')}</option>
        </select>
        <input type="number" step="5" min="0" data-dose="${i}.${j}.min" value="${d.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
        <input type="number" step="5" min="0" data-dose="${i}.${j}.max" value="${d.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
        <span class="pct">%</span>
        <button class="btn quiet" data-dose-del="${i}.${j}" aria-label="×">×</button>
      </div>`).join('');

    return `
      <div class="ingrow">
        <div class="ingmain">
          <select data-part="${i}.partCode">${await options('plant_part', pt.partCode, t('plants.part'))}</select>
          <select data-part="${i}.facing">${await options('facing', pt.facing, t('plants.facing'))}</select>
          <button class="btn quiet" data-part-del="${i}" aria-label="×">×</button>
        </div>

        <div class="optblock">
          <span class="optlabel">${t('plants.chemistry')}</span>
          ${chem || `<p class="hint">—</p>`}
          <button class="btn quiet" data-chem-add="${i}">${t('plants.addChem')}</button>
        </div>

        <div class="optblock">
          <span class="optlabel">${t('plants.dosing')}</span>
          ${dosing || `<p class="hint">—</p>`}
          <button class="btn quiet" data-dose-add="${i}">+</button>
          <p class="hint">${t('plants.dosingHint')}</p>
        </div>
      </div>`;
  }))).join('') || `<p class="hint">—</p>`;
}

function colourRows(p) {
  return (p.colours || []).map((c, i) => `
    <div class="colourrow">
      <input type="color" data-colour="${i}.hex" value="${esc(c.hex || '#A03D3B')}" aria-label="${t('plants.colourName')}">
      <input type="text" data-colour="${i}.name" value="${esc(c.name?.bg || '')}" placeholder="${t('plants.colourName')}">
      <input type="text" data-colour="${i}.conditions" value="${esc(c.conditions?.bg || '')}" placeholder="${t('plants.colourCondPlaceholder')}">
      <button class="btn quiet" data-colour-del="${i}" aria-label="×">×</button>
    </div>`).join('') || `<p class="hint">—</p>`;
}

function sectionRows(p) {
  const primary = getLang();
  const other = primary === 'bg' ? 'en' : 'bg';

  return (p.sections || []).map((sec, i) => {
    const missing = !!(sec.body?.[primary] && !sec.body?.[other]);
    return `
    <div class="sectionrow">
      <div class="chainhead">
        <input type="text" class="sectitle" data-section="${i}.title.${primary}"
               value="${esc(sec.title?.[primary] || '')}" placeholder="${t('plants.sectionTitle')}">
        <button class="btn quiet" data-section-up="${i}" ${i === 0 ? 'disabled' : ''}>${t('plants.sectionUp')}</button>
        <button class="btn quiet" data-section-down="${i}">${t('plants.sectionDown')}</button>
        <button class="btn quiet" data-section-del="${i}" aria-label="×">×</button>
      </div>
      <textarea data-section="${i}.body.${primary}" rows="4" placeholder="${t('plants.sectionText')}">${esc(sec.body?.[primary] || '')}</textarea>
      <details class="pairalt"${missing ? '' : ' open'}>
        <summary>${esc(t('i18n.otherLang', { lang: other.toUpperCase() }))}${
          missing ? ` <span class="untranslated">${esc(t('i18n.missingShort'))}</span>` : ''}</summary>
        <input type="text" data-section="${i}.title.${other}" value="${esc(sec.title?.[other] || '')}" placeholder="${t('plants.sectionTitle')}">
        <textarea data-section="${i}.body.${other}" rows="4">${esc(sec.body?.[other] || '')}</textarea>
      </details>
    </div>`;
  }).join('') || `<p class="hint">—</p>`;
}

async function renderForm(root, p) {
  const isNew = openId === 'new';

  const compChecks = (await Promise.all(['shape_printer', 'filler', 'resist'].map(async c => `
    <label class="check"><input type="checkbox" data-multi="compositionalRole" value="${c}"
      ${(p.compositionalRole || []).includes(c) ? 'checked' : ''}>
      ${esc(await label('compositional_role', c))}</label>`))).join('');

  const roleChecks = (await Promise.all(['dye', 'ecoprint', 'mordant_accumulator'].map(async r => `
    <label class="check"><input type="checkbox" data-multi="role" value="${r}"
      ${(p.role || []).includes(r) ? 'checked' : ''}>
      ${esc(await label('plant_role', r))}</label>`))).join('');

  const monthChecks = MONTHS_BG.map((m, i) => `
    <label class="month"><input type="checkbox" data-month value="${i + 1}"
      ${(p.harvestMonths || []).includes(i + 1) ? 'checked' : ''}><span>${m}</span></label>`).join('');

  root.innerHTML = page({
    title: isNew ? t('plants.new') : (text(p.nameCommon) || t('plants.one')),
    sub: isNew ? t('plants.emptyHint') : (p.nameBotanical || ''),
    actions: `<button class="btn quiet" data-back>${t('common.back')}</button>
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('plants.identity')}</h2>
            <div class="photobox">
              ${p.photoData
                ? `<img class="plantphoto" src="${p.photoData}" alt="">
                   <button class="btn quiet" data-photo-del>${t('plants.removePhoto')}</button>`
                : `<label class="btn quiet" for="plantphoto">${t('plants.addPhoto')}</label>`}
              <input type="file" id="plantphoto" accept="image/*" hidden>
              <p class="hint">${t('plants.photoHint')}</p>
            </div>
            ${pairField(t('plants.nameCommon'), 'nameCommon', p.nameCommon)}
            ${field(t('plants.nameBotanical'), `<input type="text" data-f="nameBotanical" value="${esc(p.nameBotanical || '')}" placeholder="Rubia tinctorum">`)}
            ${field(t('plants.family'), `<input type="text" data-f="family" value="${esc(p.family || '')}">`)}
            ${field(t('plants.role'), `<div class="checks">${roleChecks}</div>`)}
            ${field(t('plants.compositional'), `<div class="checks">${compChecks}</div>`, t('plants.compositionalHint'))}
            ${field(t('plants.dyeClass'), `<select data-f="dyeClass">${await options('dye_class', p.dyeClass)}</select>`, t('plants.dyeClassHint'))}
            ${field(t('plants.availability'), `<select data-f="availability">${await options('availability', p.availability)}</select>`)}
          `)}

          ${panel(`
            <h2>${t('plants.parts')}</h2>
            <p class="note">${t('plants.partsHint')}</p>
            <div class="partlist">${await partRows(p)}</div>
            <button class="btn quiet" data-part-add>${t('plants.addPart')}</button>
          `)}

          ${panel(`
            <h2>${t('plants.colours')}</h2>
            <p class="note">${t('plants.coloursHint')}</p>
            <div class="colourlist">${colourRows(p)}</div>
            <button class="btn quiet" data-colour-add>${t('plants.addColour')}</button>
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('plants.working')}</h2>
            <div class="rangerow">
              ${field(t('plants.tempExtract'), `<div class="two">
                <input type="number" step="5" data-f="tempExtractC.min" value="${p.tempExtractC?.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
                <input type="number" step="5" data-f="tempExtractC.max" value="${p.tempExtractC?.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
              </div>`)}
              ${field(t('plants.tempDye'), `<div class="two">
                <input type="number" step="5" data-f="tempDyeC.min" value="${p.tempDyeC?.min ?? ''}" placeholder="${t('recipes.qtyMin')}">
                <input type="number" step="5" data-f="tempDyeC.max" value="${p.tempDyeC?.max ?? ''}" placeholder="${t('recipes.qtyMax')}">
              </div>`)}
            </div>
            ${field(t('plants.dryingRatio'), `<input type="number" step="0.5" min="0" data-f="dryingRatio" value="${p.dryingRatio ?? ''}">`, t('plants.dryingRatioHint'))}
            ${field(t('plants.liquorRatio'), `<input type="number" step="1" min="0" data-f="liquorRatio" value="${p.liquorRatio ?? ''}">`, t('plants.liquorRatioHint'))}
            ${field(t('plants.steamNote'), `<input type="text" data-f="steamNote" value="${esc(p.steamNote || '')}">`)}
            ${field(t('plants.harvestMonths'), `<div class="months">${monthChecks}</div>`)}
            ${field(t('plants.yearsToMaturity'), `<input type="number" step="1" min="0" data-f="yearsToMaturity" value="${p.yearsToMaturity ?? ''}">`, t('plants.yearsHint'))}
            ${field(t('plants.lightfastness'), await segmented('fastness', 'lightfastness', p.lightfastness, { allowEmpty: false }))}
            ${field(t('plants.washfastness'), await segmented('fastness', 'washfastness', p.washfastness, { allowEmpty: false }))}
            <label class="check"><input type="checkbox" data-f-bool="invasive" ${p.invasive ? 'checked' : ''}>
              ${t('plants.invasive')}</label>
            ${pairField(t('plants.toxicity'), 'toxicity', p.toxicity, { multiline: true })}
          `)}

          ${panel(`
            <h2>${t('plants.sections')}</h2>
            <p class="note">${t('plants.sectionsHint')}</p>
            <div class="sectionlist">${sectionRows(p)}</div>
            <div class="btnrow">
              <button class="btn quiet" data-section-add>${t('plants.addSection')}</button>
              ${!(p.sections || []).length ? `<select data-section-suggest>
                <option value="">${t('plants.sectionTitle')}…</option>
                ${SUGGESTED.map((sug, i) => `<option value="${i}">${esc(sug[getLang()])}</option>`).join('')}
              </select>` : ''}
            </div>
          `)}

          ${!isNew ? panel(`<button class="btn danger quiet" data-delete>${t('plants.delete')}</button>`) : ''}
        </div>
      </div>`,
  });
}

// ------------------------------------------------------------------ wiring

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    const path = el.dataset.f.split('.');
    let target = draft;
    for (let i = 0; i < path.length - 1; i++) {
      target[path[i]] = target[path[i]] || {};
      target = target[path[i]];
    }
    let value = el.value;
    if (el.type === 'number') value = value === '' ? null : Number(value);
    target[path[path.length - 1]] = value;
  }
  for (const el of root.querySelectorAll('[data-f-bool]')) draft[el.dataset.fBool] = el.checked;

  draft.role = [];
  for (const el of root.querySelectorAll('[data-multi="role"]')) if (el.checked) draft.role.push(el.value);
  draft.compositionalRole = [];
  for (const el of root.querySelectorAll('[data-multi="compositionalRole"]')) {
    if (el.checked) draft.compositionalRole.push(el.value);
  }

  draft.harvestMonths = [];
  for (const el of root.querySelectorAll('[data-month]')) if (el.checked) draft.harvestMonths.push(Number(el.value));

  // parts, with their chemistry and dosing nested inside
  const parts = draft.parts || [];
  for (const el of root.querySelectorAll('[data-part]')) {
    const [i, key] = el.dataset.part.split('.');
    parts[Number(i)] = parts[Number(i)] || { id: uid(), chemistry: [], dosing: [] };
    parts[Number(i)][key] = el.value;
  }
  for (const el of root.querySelectorAll('[data-chem]')) {
    const [i, j, key] = el.dataset.chem.split('.');
    const part = parts[Number(i)];
    if (!part) continue;
    part.chemistry[Number(j)] = part.chemistry[Number(j)] || { id: uid() };
    part.chemistry[Number(j)][key] = el.value;
  }
  for (const el of root.querySelectorAll('[data-dose]')) {
    const [i, j, key] = el.dataset.dose.split('.');
    const part = parts[Number(i)];
    if (!part) continue;
    part.dosing[Number(j)] = part.dosing[Number(j)] || { id: uid() };
    part.dosing[Number(j)][key] = el.type === 'number'
      ? (el.value === '' ? null : Number(el.value)) : el.value;
  }
  draft.parts = parts.filter(Boolean);

  const colours = [];
  for (const el of root.querySelectorAll('[data-colour]')) {
    const [i, key] = el.dataset.colour.split('.');
    const idx = Number(i);
    colours[idx] = colours[idx] || { id: draft.colours?.[idx]?.id || uid() };
    if (key === 'hex') colours[idx].hex = el.value;
    else colours[idx][key] = { bg: el.value, en: draft.colours?.[idx]?.[key]?.en || '' };
  }
  draft.colours = colours.filter(Boolean);

  const sections = [];
  for (const el of root.querySelectorAll('[data-section]')) {
    const [i, group, langCode] = el.dataset.section.split('.');
    const idx = Number(i);
    sections[idx] = sections[idx] || {
      id: draft.sections?.[idx]?.id || uid(), order: idx, title: {}, body: {},
    };
    sections[idx][group][langCode] = el.value;
  }
  draft.sections = sections.filter(Boolean);

  readPairs(root, draft);
}

export default {
  id: 'plants',
  title: () => t('plants.title'),
  sub: () => t('plants.sub'),

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('plants', openId));
      }
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    const redraw = () => renderForm(root, draft);

    // Stored inline on the record, resized first: a reference photo needs to be
    // recognisable, not archival, and full-size images would bloat the backup.
    const fileInput = root.querySelector('#plantphoto');
    if (fileInput) fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      readForm(root);
      draft.photoData = await shrink(file, 480);
      redraw();
    };

    root.onclick = async (e) => {
      const role = e.target.closest('[data-role]');
      if (role) { filterRole = role.dataset.role || null; return this.render(root); }
      if (e.target.closest('[data-reseed]')) {
        try {
          const added = await loadPack('plants');
          alert(added === 0 ? t('substances.reseedNone') : t('substances.reseedDone', { n: added }));
        } catch (err) {
          alert('seed/plants.json: ' + err.message);
        }
        return this.render(root);
      }
      if (e.target.closest('[data-new]')) { draft = null; openId = 'new'; return this.render(root); }
      const row = e.target.closest('[data-open]');
      if (row) { draft = null; openId = row.dataset.open; return this.render(root); }
      if (e.target.closest('[data-back]')) { openId = null; draft = null; return this.render(root); }

      if (e.target.closest('[data-part-add]')) {
        readForm(root);
        draft.parts.push({ id: uid(), partCode: '', facing: '', chemistry: [], dosing: [] });
        return redraw();
      }
      const pdel = e.target.closest('[data-part-del]');
      if (pdel) { readForm(root); draft.parts.splice(Number(pdel.dataset.partDel), 1); return redraw(); }

      const cadd = e.target.closest('[data-chem-add]');
      if (cadd) {
        readForm(root);
        draft.parts[Number(cadd.dataset.chemAdd)].chemistry.push({ id: uid(), classCode: '', level: '' });
        return redraw();
      }
      const cdel = e.target.closest('[data-chem-del]');
      if (cdel) {
        readForm(root);
        const [i, j] = cdel.dataset.chemDel.split('.').map(Number);
        draft.parts[i].chemistry.splice(j, 1);
        return redraw();
      }

      const dadd = e.target.closest('[data-dose-add]');
      if (dadd) {
        readForm(root);
        draft.parts[Number(dadd.dataset.doseAdd)].dosing.push({ id: uid(), condition: 'dried', min: null, max: null });
        return redraw();
      }
      const ddel = e.target.closest('[data-dose-del]');
      if (ddel) {
        readForm(root);
        const [i, j] = ddel.dataset.doseDel.split('.').map(Number);
        draft.parts[i].dosing.splice(j, 1);
        return redraw();
      }

      if (e.target.closest('[data-colour-add]')) {
        readForm(root);
        draft.colours.push({ id: uid(), hex: '#A03D3B', name: { bg: '', en: '' }, conditions: { bg: '', en: '' } });
        return redraw();
      }
      const coldel = e.target.closest('[data-colour-del]');
      if (coldel) { readForm(root); draft.colours.splice(Number(coldel.dataset.colourDel), 1); return redraw(); }

      if (e.target.closest('[data-section-add]')) {
        readForm(root);
        draft.sections.push({ id: uid(), order: draft.sections.length, title: { bg: '', en: '' }, body: { bg: '', en: '' } });
        return redraw();
      }
      const sdel = e.target.closest('[data-section-del]');
      if (sdel) { readForm(root); draft.sections.splice(Number(sdel.dataset.sectionDel), 1); return redraw(); }
      const sup = e.target.closest('[data-section-up]');
      if (sup) {
        readForm(root);
        const i = Number(sup.dataset.sectionUp);
        if (i > 0) [draft.sections[i - 1], draft.sections[i]] = [draft.sections[i], draft.sections[i - 1]];
        return redraw();
      }
      const sdown = e.target.closest('[data-section-down]');
      if (sdown) {
        readForm(root);
        const i = Number(sdown.dataset.sectionDown);
        if (i < draft.sections.length - 1) [draft.sections[i + 1], draft.sections[i]] = [draft.sections[i], draft.sections[i + 1]];
        return redraw();
      }

      if (e.target.closest('[data-photo-del]')) {
        readForm(root);
        draft.photoData = null;
        return redraw();
      }

      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('plants', draft);
        openId = null; draft = null;
        return this.render(root);
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('plants.confirmDelete'))) return;
        await remove('plants', draft.id);
        openId = null; draft = null;
        return this.render(root);
      }
    };

    root.onchange = async (e) => {
      // Offering the shape of a profile is a nudge, not a schema: every
      // heading is editable and none is required.
      if (e.target.matches('[data-section-suggest]') && e.target.value !== '') {
        readForm(root);
        const sug = SUGGESTED[Number(e.target.value)];
        draft.sections.push({ id: uid(), order: draft.sections.length, title: { ...sug }, body: { bg: '', en: '' } });
        return redraw();
      }
    };
  },
};

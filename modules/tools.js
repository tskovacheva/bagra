// modules/tools.js — calculators (§9).
//
// Everything here is arithmetic that would otherwise be done on paper before
// each session, which is exactly where the mistakes come from. The logic lives
// in calc/ as pure functions; this file only collects input and shows results.

import { t } from '../i18n.js';
import { page, panel, field, esc } from '../ui.js';
import { wofGrams, solutionGrams, bathLitres, freshFromDried } from '../calc/basic.js';
import { aluminiumAcetate, fromAvailable, isAluminiumSource, isSodiumSource } from '../calc/alum-acetate.js';
import { all } from '../db.js';
import { text } from '../i18n.js';

// Inputs persist while the module is open, so changing one field does not
// clear the rest.
// Everyday conversions first; the purchase-planning one last, since it is
// consulted rarely and belongs to stock rather than to a dye session.
const CALCS = ['alum', 'wof', 'solution', 'bath', 'drying', 'reverse'];

// Substances come from the Substances module — the calculator keeps no table
// of its own, or the two would drift apart.
let substances = [];
let active = 'alum';

const state = {
  wof: { weight: 250, percent: 15, receptive: 100 },
  sol: { litres: 5, percent: 1 },
  bath: { weight: 250, ratio: 30 },
  dry: { dried: 50, ratio: 6 },
  alum: {
    weight: 500, percent: 6,
    alSource: '', naSource: '', vinegar: 9,
  },
  rev: { available: 200, limiting: 'aluminium' },
};

const num = (path, value, step = '1') =>
  `<input type="number" step="${step}" min="0" data-calc="${path}" value="${value ?? ''}">`;

const out = (labelText, value, unit = '') => value == null ? '' : `
  <div class="calcout">
    <span class="calclabel">${esc(labelText)}</span>
    <span class="calcvalue">${esc(value)} <small>${esc(unit)}</small></span>
  </div>`;

function substanceSelect(path, list, selected) {
  if (!list.length) return `<select data-calc="${path}" disabled><option>${esc(t('tools.noSubstances'))}</option></select>`;
  return `<select data-calc="${path}">${
    list.map(sx => `<option value="${sx.id}"${sx.id === selected ? ' selected' : ''}>${
      esc(text(sx.name))}${sx.formula ? ' · ' + esc(sx.formula) : ''}</option>`).join('')
  }</select>`;
}

function render(root) {
  const w = state.wof, s = state.sol, b = state.bath, d = state.dry, a = state.alum, r = state.rev;

  const alSources = substances.filter(isAluminiumSource);
  const naSources = substances.filter(isSodiumSource);
  const alSub = alSources.find(x => x.id === a.alSource) || alSources[0];
  const naSub = naSources.find(x => x.id === a.naSource) || naSources[0];

  const alum = aluminiumAcetate({
    fabricWeightG: a.weight, percentWof: a.percent,
    aluminiumSubstance: alSub, sodiumSubstance: naSub, vinegarPercent: a.vinegar,
  });

  const reverse = fromAvailable({
    limitingRole: r.limiting, availableG: r.available, percentWof: a.percent,
    aluminiumSubstance: alSub, sodiumSubstance: naSub, vinegarPercent: a.vinegar,
  });

  const nameOf = (sub) => sub ? text(sub.name) + (sub.formula ? ' · ' + sub.formula : '') : '—';

  const bodies = {
    alum: `
      ${field(t('tools.fabricWeight'), num('alum.weight', a.weight))}
      ${field(t('tools.targetWof'), num('alum.percent', a.percent, '0.5'), t('tools.targetWofHint'))}
      ${field(t('tools.alSource'), substanceSelect('alum.alSource', alSources, alSub?.id))}
      ${field(t('tools.naSource'), substanceSelect('alum.naSource', naSources, naSub?.id))}
      ${alum?.acid ? field(t('tools.vinegarPercent'), num('alum.vinegar', a.vinegar, '0.5')) : ''}
      ${alum ? `
        <div class="calcresults">
          ${out(nameOf(alSub), alum.aluminiumSource.grams, t('tools.grams'))}
          ${out(nameOf(naSub), alum.sodiumSource.grams, t('tools.grams'))}
          ${alum.acid ? out(t('tools.vinegar') + ' ' + alum.acid.vinegarPercent + '%', alum.acid.vinegarMl, t('tools.ml')) : ''}
          ${alum.acid ? out(t('tools.aceticAcid'), alum.acid.aceticAcidG, t('tools.grams')) : ''}
          ${out('Al(CH₃COO)₃', alum.targetAluminiumAcetateG, t('tools.grams'))}
        </div>
        ${!alum.acid ? `<p class="note">${t('tools.noAcid')}</p>` : ''}
        <p class="note warn">${t('tools.finishing')}</p>
        <p class="hint">${t('tools.verify')}</p>` : ''}`,

    reverse: `
      ${field(t('tools.available'), num('rev.available', r.available))}
      ${field(t('tools.limiting'), `<select data-calc="rev.limiting">
        <option value="aluminium"${r.limiting === 'aluminium' ? ' selected' : ''}>${t('tools.limiting.aluminium')}</option>
        <option value="sodium"${r.limiting === 'sodium' ? ' selected' : ''}>${t('tools.limiting.sodium')}</option>
      </select>`)}
      ${field(t('tools.targetWof'), num('alum.percent', a.percent, '0.5'))}
      ${reverse ? `<div class="calcresults">
        ${out(t('tools.maxFabric'), reverse.maxFabricG, t('tools.grams'))}
        ${out(nameOf(alSub), reverse.recipe.aluminiumSource.grams, t('tools.grams'))}
        ${out(nameOf(naSub), reverse.recipe.sodiumSource.grams, t('tools.grams'))}
      </div>` : ''}`,

    wof: `
      ${field(t('tools.fabricWeight'), num('wof.weight', w.weight))}
      ${field(t('tools.percent'), num('wof.percent', w.percent, '0.5'))}
      ${field(t('tools.receptive'), num('wof.receptive', w.receptive), t('tools.receptiveHint'))}
      <div class="calcresults">
        ${out(t('tools.result'), wofGrams(w.weight, w.percent, w.receptive), t('tools.grams'))}
      </div>`,

    solution: `
      <p class="note">${t('tools.solutionHint')}</p>
      ${field(t('tools.water'), num('sol.litres', s.litres, '0.5'))}
      ${field(t('tools.strength'), num('sol.percent', s.percent, '0.1'))}
      <div class="calcresults">
        ${out(t('tools.result'), solutionGrams(s.litres, s.percent), t('tools.grams'))}
      </div>`,

    bath: `
      ${field(t('tools.fabricWeight'), num('bath.weight', b.weight))}
      ${field(t('tools.liquorRatio'), num('bath.ratio', b.ratio))}
      <div class="calcresults">
        ${out(t('tools.result'), bathLitres(b.weight, b.ratio), t('tools.litres'))}
      </div>`,

    drying: `
      ${field(t('tools.driedAmount'), num('dry.dried', d.dried))}
      ${field(t('tools.dryingRatio'), num('dry.ratio', d.ratio, '0.5'))}
      <div class="calcresults">
        ${out(t('tools.freshNeeded'), freshFromDried(d.dried, d.ratio), t('tools.grams'))}
      </div>`,
  };

  const titles = { alum: 'tools.alum', reverse: 'tools.reverse', wof: 'tools.wof',
                   solution: 'tools.solution', bath: 'tools.bath', drying: 'tools.drying' };

  root.innerHTML = page({
    title: t('tools.title'),
    sub: t('tools.sub'),
    body: `
      <div class="boxes">
        ${CALCS.map(c => `<button class="box${c === active ? ' active' : ''}" data-calc-pick="${c}">
          <span class="boxname">${esc(t('tools.short.' + c))}</span>
        </button>`).join('')}
      </div>
      <div class="calcpane">
        ${panel(`
          <h2>${t(titles[active])}</h2>
          <p class="calcwhen">${t('tools.when.' + active)}</p>
          ${bodies[active]}
        `)}
      </div>`,
  });
}

function apply(el) {
  const [group, key] = el.dataset.calc.split('.');
  state[group][key] = el.type === 'number'
    ? (el.value === '' ? null : Number(el.value))
    : el.value;
}

export default {
  id: 'tools',
  title: () => t('tools.title'),
  sub: () => t('tools.sub'),

  async render(root) {
    substances = await all('substances');
    render(root);

    // Recompute on every keystroke: a calculator that needs a button pressed
    // is a calculator that gets used once and then done on paper again.
    root.onclick = (e) => {
      const pick = e.target.closest('[data-calc-pick]');
      if (!pick) return;
      active = pick.dataset.calcPick;
      render(root);
    };

    root.oninput = (e) => {
      if (!e.target.dataset.calc) return;
      const active = e.target.dataset.calc;
      const pos = e.target.selectionStart;
      apply(e.target);
      render(root);
      const again = root.querySelector(`[data-calc="${active}"]`);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch {} }
    };

    root.onchange = (e) => {
      if (!e.target.dataset.calc || e.target.tagName !== 'SELECT') return;
      apply(e.target);
      render(root);
    };
  },
};

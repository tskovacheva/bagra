// modules/tools.js — calculators (§9).
//
// Everything here is arithmetic that would otherwise be done on paper before
// each session, which is exactly where the mistakes come from. The logic lives
// in calc/ as pure functions; this file only collects input and shows results.

import { t } from '../i18n.js';
import { page, panel, field, esc } from '../ui.js';
import { wofGrams, solutionGrams, bathLitres, freshFromDried } from '../calc/basic.js';
import { aluminiumAcetate, fromAvailable, ALUMINIUM_SOURCES, SODIUM_SOURCES } from '../calc/alum-acetate.js';

// Inputs persist while the module is open, so changing one field does not
// clear the rest.
const state = {
  wof: { weight: 250, percent: 15, receptive: 100 },
  sol: { litres: 5, percent: 1 },
  bath: { weight: 250, ratio: 30 },
  dry: { dried: 50, ratio: 6 },
  alum: {
    weight: 500, percent: 6,
    alSource: 'al_sulfate_18', naSource: 'soda_ash', vinegar: 9,
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

function selectOf(path, map, selected) {
  return `<select data-calc="${path}">${
    Object.entries(map).map(([k, v]) =>
      `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(v.label)}</option>`).join('')
  }</select>`;
}

function render(root) {
  const w = state.wof, s = state.sol, b = state.bath, d = state.dry, a = state.alum, r = state.rev;

  const alum = aluminiumAcetate({
    fabricWeightG: a.weight, percentWof: a.percent,
    aluminiumSource: a.alSource, sodiumSource: a.naSource, vinegarPercent: a.vinegar,
  });

  const reverse = fromAvailable({
    limitingRole: r.limiting, availableG: r.available, percentWof: a.percent,
    aluminiumSource: a.alSource, sodiumSource: a.naSource, vinegarPercent: a.vinegar,
  });

  root.innerHTML = page({
    title: t('tools.title'),
    sub: t('tools.sub'),
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('tools.alum')}</h2>
            <p class="note">${t('tools.alumHint')}</p>
            ${field(t('tools.fabricWeight'), num('alum.weight', a.weight))}
            ${field(t('tools.targetWof'), num('alum.percent', a.percent, '0.5'), t('tools.targetWofHint'))}
            ${field(t('tools.alSource'), selectOf('alum.alSource', ALUMINIUM_SOURCES, a.alSource))}
            ${field(t('tools.naSource'), selectOf('alum.naSource', SODIUM_SOURCES, a.naSource))}
            ${alum?.acid ? field(t('tools.vinegarPercent'), num('alum.vinegar', a.vinegar, '0.5')) : ''}

            ${alum ? `
              <div class="calcresults">
                ${out(t('tools.needed') + ' — ' + alum.aluminiumSource.label, alum.aluminiumSource.grams, t('tools.grams'))}
                ${out(t('tools.needed') + ' — ' + alum.sodiumSource.label, alum.sodiumSource.grams, t('tools.grams'))}
                ${alum.acid ? out(t('tools.vinegar') + ' ' + alum.acid.vinegarPercent + '%', alum.acid.vinegarMl, t('tools.ml')) : ''}
                ${alum.acid ? out(t('tools.aceticAcid'), alum.acid.aceticAcidG, t('tools.grams')) : ''}
                ${out('Al(CH₃COO)₃', alum.targetAluminiumAcetateG, t('tools.grams'))}
              </div>
              ${!alum.acid ? `<p class="note">${t('tools.noAcid')}</p>` : ''}
              <p class="note warn">${t('tools.finishing')}</p>
              <p class="hint">${t('tools.verify')}</p>` : ''}
          `)}

          ${panel(`
            <h2>${t('tools.reverse')}</h2>
            <p class="note">${t('tools.reverseHint')}</p>
            ${field(t('tools.available'), num('rev.available', r.available))}
            ${field(t('tools.limiting'), `<select data-calc="rev.limiting">
              <option value="aluminium"${r.limiting === 'aluminium' ? ' selected' : ''}>${t('tools.limiting.aluminium')}</option>
              <option value="sodium"${r.limiting === 'sodium' ? ' selected' : ''}>${t('tools.limiting.sodium')}</option>
            </select>`)}
            ${reverse ? `<div class="calcresults">
              ${out(t('tools.maxFabric'), reverse.maxFabricG, t('tools.grams'))}
            </div>` : ''}
          `)}
        </div>

        <div class="col">
          ${panel(`
            <h2>${t('tools.wof')}</h2>
            <p class="note">${t('tools.wofHint')}</p>
            ${field(t('tools.fabricWeight'), num('wof.weight', w.weight))}
            ${field(t('tools.percent'), num('wof.percent', w.percent, '0.5'))}
            ${field(t('tools.receptive'), num('wof.receptive', w.receptive), t('tools.receptiveHint'))}
            <div class="calcresults">
              ${out(t('tools.result'), wofGrams(w.weight, w.percent, w.receptive), t('tools.grams'))}
            </div>
          `)}

          ${panel(`
            <h2>${t('tools.solution')}</h2>
            <p class="note">${t('tools.solutionHint')}</p>
            ${field(t('tools.water'), num('sol.litres', s.litres, '0.5'))}
            ${field(t('tools.strength'), num('sol.percent', s.percent, '0.1'))}
            <div class="calcresults">
              ${out(t('tools.result'), solutionGrams(s.litres, s.percent), t('tools.grams'))}
            </div>
          `)}

          ${panel(`
            <h2>${t('tools.bath')}</h2>
            <p class="note">${t('tools.bathHint')}</p>
            ${field(t('tools.fabricWeight'), num('bath.weight', b.weight))}
            ${field(t('tools.liquorRatio'), num('bath.ratio', b.ratio))}
            <div class="calcresults">
              ${out(t('tools.result'), bathLitres(b.weight, b.ratio), t('tools.litres'))}
            </div>
          `)}

          ${panel(`
            <h2>${t('tools.drying')}</h2>
            <p class="note">${t('tools.dryingHint')}</p>
            ${field(t('tools.driedAmount'), num('dry.dried', d.dried))}
            ${field(t('tools.dryingRatio'), num('dry.ratio', d.ratio, '0.5'))}
            <div class="calcresults">
              ${out(t('tools.freshNeeded'), freshFromDried(d.dried, d.ratio), t('tools.grams'))}
            </div>
          `)}
        </div>
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
    render(root);

    // Recompute on every keystroke: a calculator that needs a button pressed
    // is a calculator that gets used once and then done on paper again.
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

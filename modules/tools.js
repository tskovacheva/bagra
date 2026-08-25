// modules/tools.js — calculators (§9).
//
// Everything here is arithmetic that would otherwise be done on paper before
// each session, which is exactly where the mistakes come from. The logic lives
// in calc/ as pure functions; this file only collects input and shows results.

import { t, plural } from '../i18n.js';
import { countUserPhotos } from '../photo.js';
import { page, panel, field, fact, note, esc, icon, navigate, backTo } from '../ui.js';
import { wofGrams, solutionGrams, bathLitres, freshFromDried, exhaustBath } from '../calc/basic.js';
import { aluminiumAcetate, fromAvailable, isAluminiumSource, isSodiumSource } from '../calc/alum-acetate.js';
import { all, count } from '../db.js';
import { downloadBackup, importBackup, readFile, backupState, ensurePersistence } from '../backup.js';
import { VERSION } from '../version.js';
import { text } from '../i18n.js';

// Inputs persist while the module is open, so changing one field does not
// clear the rest.
// Everyday conversions first; the purchase-planning one last, since it is
// consulted rarely and belongs to stock rather than to a dye session.
// Ordered by how often the owner reaches for them, not by when they were built:
// %WOF first because almost every recipe starts there, the timer last because it
// is the one thing a phone already does.
const CALCS = ['wof', 'solution', 'bath', 'drying', 'alum', 'exhaust', 'reverse', 'timer'];

const ICONS = {
  wof: 'i-wof', solution: 'i-solution', bath: 'i-bath', drying: 'i-drying',
  alum: 'i-alum', exhaust: 'i-exhaust', reverse: 'i-reverse', timer: 'i-timer',
};

// Substances come from the Substances module — the calculator keeps no table
// of its own, or the two would drift apart.
let substances = [];
let jars = [];
let storage = { persisted: false, usage: null, supported: false };
let bstate = { never: true, changes: 0, days: null };
let counts = {};
let importMode = 'merge';

// Kept outside the render so switching tabs does not silently cancel a steam
// that is already running.
const timer = { minutes: 60, endsAt: null, tick: null };

function timerLeft() {
  if (!timer.endsAt) return null;
  return Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
}

const mmss = (secs) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
let active = null;

const state = {
  wof: { weight: 250, percent: 15, receptive: 100 },
  sol: { litres: 5, percent: 1 },
  bath: { weight: 250, ratio: 30 },
  dry: { dried: 50, ratio: 6 },
  alum: {
    weight: 500, percent: 6,
    alSource: '', naSource: '', vinegar: 9, vinegarJar: '',
  },
  exhaust: { firstWeight: 250, strength: 50 },
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

// The bottle on the shelf, offered to the calculator (§11b).
//
// The jars carried a concentration from the day Stock existed and nothing ever
// read it: the calculator asked for a percentage and suggested nine, while the
// bottle in the cupboard was five. Whichever is chosen writes the number into
// the field beside it, which stays editable — a jar not yet recorded must not
// become a jar that cannot be used.
function acidJarsOf(list, subs) {
  const byId = new Map(subs.map(sx => [sx.id, sx]));
  return list
    .filter(j => j.status !== 'wanted' && j.concentrationPercent != null)
    .filter(j => {
      const sub = byId.get(j.substanceId);
      // An acid, by what it does rather than by its name: a modifier that
      // moves pH down, or anything already declared as needing acid.
      return sub && (sub.phDirection === 'acid' || sub.category === 'auxiliary' || sub.category === 'modifier');
    })
    .map(j => ({ ...j, subName: text(byId.get(j.substanceId)?.name) || '—' }))
    .sort((x, y) => x.subName.localeCompare(y.subName));
}

function jarSelect(selected, list) {
  return `<select data-calc="alum.vinegarJar">
    <option value="">${esc(t('tools.vinegarTyped'))}</option>
    ${list.map(j => `<option value="${esc(j.id)}"${j.id === selected ? ' selected' : ''}>${
      esc(`${j.subName}${j.supplier ? ' · ' + j.supplier : ''} · ${j.concentrationPercent}%`)}</option>`).join('')}
  </select>`;
}

function render(root) {
  const w = state.wof, s = state.sol, b = state.bath, d = state.dry, a = state.alum, r = state.rev;
  const acidJars = acidJarsOf(jars, substances);
  const x = state.exhaust;
  const exhaust = exhaustBath(x.firstWeight, x.strength);

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

  // The same sentence the home screen uses, and for the same reason: a warning
  // that says what will actually be lost, with a number, is a prompt; "no
  // backup for a while" is a notice. §13s.
  const mark = `<span class="notemark" aria-hidden="true">!</span>`;
  const say = (n, key) => plural(n, t(`${key}.one`), t(`${key}.many`));
  const atRisk = [];
  if (counts.trials) atRisk.push(say(counts.trials, 'dash.lostTrials'));
  if (counts.photos) atRisk.push(say(counts.photos, 'dash.lostPhotos'));
  if (counts.fabrics) atRisk.push(say(counts.fabrics, 'dash.lostFabrics'));

  const dangerBanner = bstate.never
    ? note(`${mark}<b>${t('backup.never')}</b> ${atRisk.length
        ? t('dash.wouldLose', { what: atRisk.join(' · ') }) : ''}`, 'danger')
    : (bstate.days > 14 || bstate.changes > 40)
      ? note(`${mark}${t('dash.backupOld', { n: bstate.days, c: bstate.changes })}`, 'danger')
      : '';

  const bodies = {
    alum: `
      ${field(t('tools.fabricWeight'), num('alum.weight', a.weight))}
      ${field(t('tools.targetWof'), num('alum.percent', a.percent, '0.5'), t('tools.targetWofHint'))}
      ${field(t('tools.alSource'), substanceSelect('alum.alSource', alSources, alSub?.id))}
      ${field(t('tools.naSource'), substanceSelect('alum.naSource', naSources, naSub?.id))}
      ${alum?.acid ? field(t('tools.vinegarPercent'),
        acidJars.length ? `${jarSelect(a.vinegarJar, acidJars)}${num('alum.vinegar', a.vinegar, '0.5')}`
                        : num('alum.vinegar', a.vinegar, '0.5'),
        acidJars.length ? t('tools.vinegarJarHint') : '') : ''}
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

    exhaust: `
      ${field(t('tools.firstWeight'), num('exhaust.firstWeight', x.firstWeight))}
      ${field(t('tools.remainingStrength'), num('exhaust.strength', x.strength, '5'), t('tools.remainingStrengthHint'))}
      ${exhaust ? `<div class="calcresults">
        ${out(t('tools.sameShade'), exhaust.sameShadeWeightG, t('tools.grams'))}
        ${out(t('tools.sameWeight'), exhaust.sameWeightStrength, '%')}
      </div>
      <p class="hint">${t('tools.exhaustCaveat')}</p>` : ''}`,

    timer: `
      <div class="timerface${timer.endsAt ? ' running' : ''}">
        ${timer.endsAt ? mmss(timerLeft()) : mmss((timer.minutes || 0) * 60)}
      </div>
      ${field(t('tools.timerMinutes'), num('timer.minutes', timer.minutes))}
      <div class="btnrow">
        ${timer.endsAt
          ? `<button class="btn quiet" data-timer-stop>${t('tools.timerStop')}</button>`
          : `<button class="btn primary" data-timer-start>${t('tools.timerStart')}</button>`}
        <button class="btn quiet" data-timer-reset>${t('tools.timerReset')}</button>
      </div>
      <p class="hint">${t('tools.timerPresets')}</p>
      <div class="boxes">
        ${[15, 30, 45, 60, 90, 120].map(m =>
          `<button class="box" data-timer-preset="${m}"><span class="boxname">${m} ${t('common.min')}</span></button>`).join('')}
      </div>`,

    backup: `
      ${dangerBanner}

      <div class="channel">
        <div class="channelhead">
          <b>${t('backup.personal')}</b>
          <span class="chip">${t('backup.circular')}</span>
        </div>
        ${fact(t('backup.contains'), esc(t('backup.containsWhat')))}
        ${fact(t('backup.purpose'), esc(t('backup.purposeWhat')))}
        ${fact(t('backup.onImport'), esc(t('backup.onImportWhat')))}
        ${fact(t('backup.lastOne'), esc(bstate.never
            ? t('backup.neverShort')
            : (bstate.days === 0 ? t('backup.lastToday') : t('backup.last', { n: bstate.days }))))}
        <p class="hint">${t('backup.counts', { list: Object.entries(counts).filter(([, n]) => n)
          .map(([k, n]) => `${t('nav.' + (k === 'stock' ? 'materials' : k)) || k}: ${n}`).join(' · ') || '—' })}</p>
        <div class="btnrow">
          <button class="btn primary" data-backup-export>${t('backup.export')}</button>
          <label class="btn" for="backupfile" tabindex="0">${t('backup.import')}</label>
          <input type="file" id="backupfile" accept="application/json" hidden>
        </div>
        ${field(t('backup.mode'), `<select data-backup-mode>
          <option value="merge"${importMode === 'merge' ? ' selected' : ''}>${t('backup.mode.merge')}</option>
          <option value="replace"${importMode === 'replace' ? ' selected' : ''}>${t('backup.mode.replace')}</option>
        </select>`)}
        <p class="hint">${t('backup.importHint')}</p>
      </div>

      <hr class="rule">
      <h3 class="subhead">${t('app.version')}</h3>
      <div class="calcout">
        <span class="calclabel">${t('app.version')}</span>
        <span class="calcvalue">v${VERSION}</span>
      </div>
      <div class="btnrow">
        <button class="btn quiet" data-checkupdate>${t('update.check')}</button>
      </div>
      <hr class="rule">
      <h3 class="subhead">${t('backup.storage')}</h3>
      <p class="note ${storage.persisted ? '' : 'danger'}">
        ${storage.persisted ? t('backup.persisted')
          : `<span class="notemark" aria-hidden="true">!</span>${t('backup.notPersisted')}`}
      </p>
      <p class="hint">${t('backup.incognito')}</p>
      ${storage.usage != null ? `<p class="hint">${t('backup.usage', { used: (storage.usage / 1048576).toFixed(1) + ' MB' })}</p>` : ''}`,

    drying: `
      ${field(t('tools.driedAmount'), num('dry.dried', d.dried))}
      ${field(t('tools.dryingRatio'), num('dry.ratio', d.ratio, '0.5'))}
      <div class="calcresults">
        ${out(t('tools.freshNeeded'), freshFromDried(d.dried, d.ratio), t('tools.grams'))}
      </div>`,
  };

  const titles = { alum: 'tools.alum', reverse: 'tools.reverse', wof: 'tools.wof',
                   solution: 'tools.solution', bath: 'tools.bath', drying: 'tools.drying',
                   exhaust: 'tools.exhaust', backup: 'backup.title', timer: 'tools.timer' };

  const isBackup = active === 'backup';

  // `#/tools` is the menu; `#/tools/<calc>` is the calculator. One behaviour on
  // both forms, and every calculator gets an address that can be bookmarked —
  // the same shape the backup already had.
  if (!active) {
    const row = (c) => `
      <button class="pickrow" data-calc-pick="${c}">
        ${icon(ICONS[c])}
        <span class="pickname">
          <b>${esc(t('tools.short.' + c))}</b>
          <span>${esc(t('tools.when.' + c))}</span>
        </span>
        <span class="pickgo">›</span>
      </button>`;

    // The timer is not a calculation, so it sits under its own heading rather
    // than pretending to be one — it was the first of nine buttons once.
    const calcs = CALCS.filter(c => c !== 'timer');
    root.innerHTML = page({
      title: t('tools.title'),
      sub: t('tools.sub'),
      body: `
        <div class="pickgroup">
          <div class="navhead">${t('tools.group.calculators')}</div>
          <div class="picklist">${calcs.map(row).join('')}</div>
        </div>
        <div class="pickgroup">
          <div class="navhead">${t('tools.group.other')}</div>
          <div class="picklist">${row('timer')}</div>
        </div>`,
    });
    return;
  }

  root.innerHTML = page({
    title: isBackup ? t('backup.title') : t('tools.short.' + active),
    sub: isBackup ? t('backup.when') : t('tools.when.' + active),
    actions: `${backTo('#/tools', t('nav.calculators'))}`,
    body: `
      <div class="calcpane">
        ${panel(`
          <h2>${t(titles[active])}</h2>
          ${bodies[active]}
        `)}
      </div>`,
  });
}

// The timer keeps its own object rather than living in `state`, because its
// value is a running clock and not a calculator input. Its minutes field was
// nonetheless written as `data-calc="timer.minutes"`, so `state['timer']` was
// undefined and typing a number threw — silently, since nothing called this for
// a text field at all (§13af). Resolved by name rather than by assuming the
// group is in `state`.
const groupOf = (name) => (name === 'timer' ? timer : state[name]);

function apply(el) {
  const [group, key] = el.dataset.calc.split('.');
  const target = groupOf(group);
  if (!target) return false;
  // Choosing a bottle sets the strength; clearing the choice leaves whatever
  // was last there rather than jumping back to a default nobody asked for.
  if (el.dataset.calc === 'alum.vinegarJar') {
    state.alum.vinegarJar = el.value;
    const jar = jars.find(j => j.id === el.value);
    if (jar?.concentrationPercent != null) state.alum.vinegar = jar.concentrationPercent;
    return true;
  }
  // Typing a strength by hand means the bottle chosen is no longer the one in
  // the pot — the label would otherwise keep naming a jar it no longer matches.
  if (el.dataset.calc === 'alum.vinegar') state.alum.vinegarJar = '';
  target[key] = el.type === 'number'
    ? (el.value === '' ? null : Number(el.value))
    : el.value;
  return true;
}

function startTicking(root) {
  clearInterval(timer.tick);
  timer.tick = setInterval(() => {
    const face = root.querySelector('.timerface');
    const left = timerLeft();
    if (left == null) return;
    if (face) face.textContent = mmss(left);
    if (left === 0) {
      clearInterval(timer.tick); timer.tick = null;
      timer.endsAt = null;
      alert(t('tools.timerDone'));
      render(root);
    }
  }, 1000);
}

export default {
  id: 'tools',
  title: () => t('tools.title'),
  sub: () => t('tools.sub'),

  // Entering from the navigation lands on a calculator; `#/tools/backup` is the
  // backup's own address, so it can be bookmarked and linked to — which for a
  // backup is worth more than for anything else in the app.
  reset() { active = null; },
  // Called with nothing when the address names no tool, and that must return to
  // the menu rather than leave the last one open.
  open(which) { active = (which === 'backup' || CALCS.includes(which)) ? which : null; },

  async render(root) {
    substances = await all('substances');
    jars = await all('stock');
    storage = await ensurePersistence();
    bstate = await backupState();
    counts = {
      fabrics: await count('fabrics'), substances: await count('substances'),
      stock: await count('stock'), recipes: await count('recipes'),
      plants: await count('plants'), trials: await count('trials'),
      // Counted so the warning can name them. Photographs are the part nobody
      // can reconstruct, and they were absent from the tally.
      // Every image that exists nowhere else (§13cx). This read `count('photos')`,
      // and nothing has ever written to that store — so the line meant to make a
      // person take a backup seriously told her she had none to lose.
      photos: await countUserPhotos(),
    };
    render(root);

    // Recompute on every keystroke: a calculator that needs a button pressed
    // is a calculator that gets used once and then done on paper again.
    root.onclick = async (e) => {
      const pick = e.target.closest('[data-calc-pick]');
      if (pick) return navigate('#/tools/' + pick.dataset.calcPick);

      const preset = e.target.closest('[data-timer-preset]');
      if (preset) {
        timer.minutes = Number(preset.dataset.timerPreset);
        timer.endsAt = Date.now() + timer.minutes * 60000;
        startTicking(root);
        return render(root);
      }
      if (e.target.closest('[data-timer-start]')) {
        timer.endsAt = Date.now() + (timer.minutes || 0) * 60000;
        startTicking(root);
        return render(root);
      }
      if (e.target.closest('[data-timer-stop]') || e.target.closest('[data-timer-reset]')) {
        timer.endsAt = null;
        clearInterval(timer.tick); timer.tick = null;
        return render(root);
      }

      if (e.target.closest('[data-checkupdate]')) {
        const btn = e.target.closest('[data-checkupdate]');
        btn.disabled = true;
        btn.textContent = t('update.checking');
        try { await window.bagraCheckUpdate?.(); } catch {}
        // The worker needs a moment to fetch and compare before its state settles.
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = t('update.check');
          alert(document.getElementById('updatebar')
            ? t('update.found') : t('update.upToDate', { v: VERSION }));
        }, 1800);
        return;
      }

      if (e.target.closest('[data-backup-export]')) {
        await downloadBackup();
        bstate = await backupState();
        render(root);
        alert(t('backup.done'));
      }
    };

    root.onchange = async (e) => {
      // Delegated rather than bound to the element: choosing a calculator
      // redraws the panel, and a handler attached to the old input goes with it.
      if (e.target.matches('#backupfile')) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const payload = await readFile(file);
          if (importMode === 'replace' && !confirm(t('backup.confirmReplace'))) {
            e.target.value = '';
            return;
          }
          const report = await importBackup(payload, importMode);
          // A snapshot restore and an add-only merge did different things and
          // were reported in one sentence, which had to describe both and so
          // described neither. „Presented as replaced" was the count of records
          // written; what a person actually wants to know after a restore is
          // how many of her newer records went.
          alert(importMode === 'replace'
            ? t('backup.restored', report)
            : t('backup.imported', report));
          location.reload();
        } catch (err) {
          alert(t('backup.badFile') + ' ' + (err?.message || ''));
          e.target.value = '';
        }
        return;
      }

      if (e.target.matches('[data-backup-mode]')) { importMode = e.target.value; return; }
      if (!e.target.dataset.calc) return;
      apply(e.target);
      render(root);
    };

    // Rule 6 (§13s): the answer appears while the question is being asked. The
    // comment above the click handler has promised this since the calculators
    // were written and nothing delivered it — there was no `input` handler at
    // all, and the `change` handler returned early for anything that was not a
    // `<select>`. Every number on every calculator could be retyped and the
    // result would not move. Reported by the owner as "the calculators do not
    // work", which is exactly what it was.
    root.oninput = (e) => {
      if (!e.target.dataset.calc) return;
      if (!apply(e.target)) return;
      // Redrawing replaces the very input being typed into, so the caret is put
      // back where it was. Without this the field loses focus on the first
      // keystroke, which is worse than not recomputing at all.
      const path = e.target.dataset.calc;
      const at = e.target.selectionStart;
      render(root);
      const again = root.querySelector(`[data-calc="${path}"]`);
      if (!again) return;
      again.focus({ preventScroll: true });
      try { again.setSelectionRange(at, at); } catch { /* number inputs refuse */ }
    };
  },
};

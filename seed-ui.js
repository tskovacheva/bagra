// seed-ui.js — the merge preview (§10).
//
// A pack update is never applied silently. What is new, what would change,
// and what is protected because the user edited it are all shown first, each
// selectable, and nothing is written until she says so.

import { t } from './i18n.js';
import { page, panel, esc, label } from './ui.js';
import { diffPack, applyDiff } from './seed.js';

let state = null;   // { name, diff, chosen:Set }

export function isOpen() { return !!state; }
export function close() { state = null; }

export async function open(name) {
  const diff = await diffPack(name);
  const chosen = new Set([
    ...diff.added.map(e => e.id),
    ...diff.changed.map(e => e.id),
    // A withdrawal the user has not edited is ticked: the pack dropped the
    // record on purpose and leaving it behind is what makes an updated copy
    // differ from a fresh one. One she HAS edited stays unticked, like any
    // other edited record — her work is not the pack's to discard.
    ...diff.withdrawn.filter(e => !e.edited).map(e => e.id),
  ]);
  state = { name, diff, chosen };
}

async function fieldNames(fields) {
  const dict = {
    nameCommon: 'plants.nameCommon', nameBotanical: 'plants.nameBotanical',
    parts: 'plants.parts', colours: 'plants.colours', sections: 'plants.sections',
    tempExtractC: 'plants.tempExtract', tempDyeC: 'plants.tempDye',
    liquorRatio: 'plants.liquorRatio', dryingRatio: 'plants.dryingRatio',
    lightfastness: 'plants.lightfastness', washfastness: 'plants.washfastness',
    role: 'plants.role', plantType: 'plants.plantType', habitat: 'plants.habitat',
    family: 'plants.family', compositionalRole: 'plants.compositional',
    name: 'materials.name', formula: 'materials.formula',
    molarMass: 'materials.molarMass', maxTempC: 'materials.maxTemp',
    standardPercentWof: 'materials.standardWof', typicalUse: 'substances.purpose',
    safetyNote: 'materials.safety', notes: 'common.notes',
  };
  return fields.map(f => dict[f] ? t(dict[f]) : f).join(', ');
}

async function group(titleKey, entries, { ticked, hint = '' } = {}) {
  if (!entries.length) return '';
  const rows = await Promise.all(entries.map(async e => `
    <label class="difrow">
      <input type="checkbox" data-pick="${e.id}" ${state.chosen.has(e.id) ? 'checked' : ''}>
      <span class="difname">${esc(e.name)}</span>
      ${e.fields ? `<span class="diffields">${esc(await fieldNames(e.fields))}</span>` : ''}
    </label>`));
  return `
    <div class="difgroup">
      <div class="difhead">
        <h3>${t(titleKey)} <span class="difcount">${entries.length}</span></h3>
        <button class="btn quiet" data-toggle-group="${ticked}">${t('seed.toggleAll')}</button>
      </div>
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      ${rows.join('')}
    </div>`;
}

export async function render(root, onDone) {
  const { diff } = state;
  const total = state.chosen.size;

  const nothing = !diff.added.length && !diff.changed.length
               && !diff.edited.length && !diff.withdrawn.length;

  root.innerHTML = page({
    title: t('seed.previewTitle'),
    sub: t('seed.previewSub'),
    actions: `<button class="btn quiet" data-cancel>${t('common.back')}</button>
              <button class="btn primary" data-apply ${total ? '' : 'disabled'}>
                ${t('seed.apply', { n: total })}</button>`,
    body: nothing
      ? panel(`<p class="note">${t('seed.upToDate', { n: diff.unchanged.length })}</p>`)
      : panel(`
          ${await group('seed.groupAdded', diff.added, { ticked: 'added' })}
          ${await group('seed.groupChanged', diff.changed, { ticked: 'changed' })}
          ${await group('seed.groupEdited', diff.edited, {
            ticked: 'edited', hint: t('seed.editedHint') })}
          ${await group('seed.groupWithdrawn', diff.withdrawn, {
            ticked: 'withdrawn', hint: t('seed.withdrawnHint') })}
          <p class="hint">${t('seed.unchanged', { n: diff.unchanged.length })}</p>
        `),
  });

  root.onclick = async (e) => {
    if (e.target.closest('[data-cancel]')) { close(); return onDone(); }

    const tog = e.target.closest('[data-toggle-group]');
    if (tog) {
      const list = diff[tog.dataset.toggleGroup];
      const allOn = list.every(x => state.chosen.has(x.id));
      for (const x of list) allOn ? state.chosen.delete(x.id) : state.chosen.add(x.id);
      return render(root, onDone);
    }

    if (e.target.closest('[data-apply]')) {
      const all = [...diff.added, ...diff.changed, ...diff.edited, ...diff.withdrawn]
        .filter(x => state.chosen.has(x.id));
      const n = await applyDiff(diff.store, all, diff.pack);
      close();
      alert(t('seed.applied', { n }));
      return onDone();
    }
  };

  root.onchange = (e) => {
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    pick.checked ? state.chosen.add(pick.dataset.pick) : state.chosen.delete(pick.dataset.pick);
    const btn = root.querySelector('[data-apply]');
    if (btn) {
      btn.textContent = t('seed.apply', { n: state.chosen.size });
      btn.disabled = !state.chosen.size;
    }
  };
}

// modules/sources.js — attribution at the scale it actually belongs (§13.1).
//
// Not a field on every record. Proportions and sequences pass from person to
// person and their origin is usually unknown; pretending each entry has an
// owner misrepresents how the craft transmits knowledge. What is honest is a
// list of those the library rests on.

import { all, get, put, remove, newRecord } from '../db.js';
import { t, text } from '../i18n.js';
import { markClean } from '../dirty.js';
import { page, panel, field, esc, empty, pairField, readPairs, navigate, backTo, actionBtn, icon } from '../ui.js';

const KINDS = ['book', 'course', 'person', 'site', 'other'];

let openId = null;
let draft = null;

function blank() {
  return newRecord({
    kind: 'book',
    name: '',
    author: '',
    url: '',
    note: { bg: '', en: '' },
  });
}

async function renderList(root) {
  const sources = (await all('sources'))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const rows = sources.map(sx => `
    <tr data-open="${sx.id}">
      <td>${esc(sx.name || '—')}</td>
      <td>${esc(sx.author || '—')}</td>
      <td>${esc(t('sources.kind.' + sx.kind))}</td>
      <td>${sx.url ? `<a href="${esc(sx.url)}" target="_blank" rel="noopener">${esc(sx.url.replace(/^https?:\/\//, ''))}</a>` : '—'}</td>
      <td>${esc(text(sx.note) || '')}</td>
    </tr>`).join('');

  const table = sources.length ? `
    <table class="grid">
      <thead><tr>
        <th>${t('sources.name')}</th>
        <th>${t('sources.author')}</th>
        <th>${t('sources.kind')}</th>
        <th>${t('sources.url')}</th>
        <th>${t('sources.note')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    : empty(t('sources.empty'), t('sources.emptyHint'));

  root.innerHTML = page({
    title: t('sources.title'),
    sub: t('sources.sub'),
    actions: `${actionBtn('add', t('sources.new'), 'data-new', 'primary')}`,
    body: `${panel(`<p class="note">${t('sources.intro')}</p>`)}
           <div style="height:16px"></div>
           ${panel(table, 'flush')}`,
  });
}

async function renderForm(root, r) {
  const isNew = openId === 'new';

  root.innerHTML = page({
    title: isNew ? t('sources.new') : (r.name || t('sources.one')),
    sub: '',
    actions: `${backTo('#/sources', t('nav.sources'))}
              <button class="btn primary" data-save>${t('common.save')}</button>`,
    body: `
      <div class="cols">
        <div class="col">
          ${panel(`
            <h2>${t('sources.one')}</h2>
            ${field(t('sources.name'), `<input type="text" data-f="name" value="${esc(r.name || '')}">`)}
            ${field(t('sources.author'), `<input type="text" data-f="author" value="${esc(r.author || '')}">`)}
            ${field(t('sources.kind'), `<select data-f="kind">${
              KINDS.map(k => `<option value="${k}"${r.kind === k ? ' selected' : ''}>${t('sources.kind.' + k)}</option>`).join('')
            }</select>`)}
            ${field(t('sources.url'), `<input type="text" data-f="url" value="${esc(r.url || '')}" placeholder="https://">`)}
          `)}
        </div>
        <div class="col">
          ${panel(`
            <h2>${t('sources.note')}</h2>
            ${pairField('', 'note', r.note, { multiline: true, placeholder: t('sources.notePlaceholder') })}
            ${!isNew ? `${actionBtn('delete', t('sources.delete'), 'data-delete', 'destructive')}` : ''}
          `)}
        </div>
      </div>`,
  });
}

function readForm(root) {
  for (const el of root.querySelectorAll('[data-f]')) draft[el.dataset.f] = el.value;
  readPairs(root, draft);
}

export default {
  id: 'sources',
  title: () => t('sources.title'),
  sub: () => t('sources.sub'),

  // The address decides what is on screen (§13q). Called on every route change,
  // with nothing when the address names no record, which is how the list comes
  // back.
  //
  //   #/sources          the list
  //   #/sources/new      a new source
  //   #/sources/<id>     the record
  open(first) {
    draft = null;
    openId = first || null;
  },

  // Choosing a module in the navigation means "take me to this module", not
  // "show me whatever I last had open in it". Called by the router on entry.
  reset() {
    openId = null;
    draft = null;
  },

  async render(root) {
    if (openId) {
      if (!draft || (openId !== 'new' && draft.id !== openId)) {
        draft = openId === 'new' ? blank() : structuredClone(await get('sources', openId));
      }
      // An address naming a record that is gone — a bookmark to something
      // deleted, or the back button after deleting it. Drawing it throws, and a
      // thrown render leaves the previous screen in place, which reads as the
      // address being ignored (§11b). The list is the honest answer.
      if (!draft) return navigate('#/sources');
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderList(root);
    }

    root.onclick = async (e) => {
      if (e.target.closest('a')) return;
      if (e.target.closest('[data-new]')) return navigate('#/sources/new');
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/sources/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) return navigate('#/sources');
      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('sources', draft);
        // The put succeeded, so the work is saved and the address change that
        // follows is not a departure. `dirty.js` cannot tell the two apart from
        // outside — it infers a successful save by watching the form leave the
        // screen — but in here the answer is known (§13ad).
        markClean();
        return navigate('#/sources');
      }
      if (e.target.closest('[data-delete]')) {
        if (!confirm(t('sources.confirmDelete'))) return;
        await remove('sources', draft.id);
        return navigate('#/sources');
      }
    };
  },
};

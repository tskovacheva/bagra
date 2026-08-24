// modules/library.js — the reference shelf: glossary, pH, sources (§13bt).
//
// Was `modules/sources.js`, which held attribution alone. Attribution is worth
// a screen but not a place in the navigation of its own: it is opened rarely,
// to check where something came from. What is opened often — and had nowhere to
// live — is the meaning of a word met on another screen. So the shelf holds
// three things and the glossary is first.
//
// Three tabs and not two. A pH scale is not a term with a definition; it is a
// table, and forcing it into a glossary entry would make it a paragraph about
// a picture. It gets its own tab.
//
// THE GLOSSARY DOES NOT RESTATE THE VOCABULARY. Five codes in vocab.js already
// carry an explanation and show it where the code is shown (§13aw). Repeating
// one here would be one thing defined in two files, and the two would drift at
// the first edit. This module READS those five and merges them in at render
// time — no copy, no back-link stored anywhere (§13.6). A deep-check guard
// (24d) fails the build if a glossary term ever names a code vocab.js explains.

import { all, get, put, newRecord } from '../db.js';
import { t, text, getLang } from '../i18n.js';
import { markClean } from '../dirty.js';
import { VOCABULARY } from '../vocab.js';
import { page, panel, field, esc, empty, pairField, readPairs, navigate, backTo, actionBtn, icon, deleteGuarded } from '../ui.js';

// A seeded source shipped with `kind: 'reference'` and another with
// `kind: 'website'`, neither of which was here — so the screen printed the
// literal key `sources.kind.reference` where a word belonged, for as long as
// both records have existed. Layer 3b of check.sh cannot see it: the key is
// built as `t('sources.kind.' + sx.kind)` at run time, and that layer reads
// literal keys only. 'website' was the same thing as 'site' and the data was
// corrected; 'reference' is a real distinct kind — an online encyclopaedia is
// not a personal site — so it is listed here. Deep-check guard 24c now holds
// every seeded kind against this list, from the data end.
const KINDS = ['book', 'course', 'person', 'site', 'reference', 'other'];

const TABS = ['glossary', 'ph', 'sources'];

// The order a reader is walked through the craft: what a dye is, how the cloth
// is prepared, how it is dyed, the two processes that have rules of their own,
// and only then the chemistry and the fastness (§13cb).
//
// The six groups before these — chemistry, process, fabric, ph, ecoprint,
// fastness — were named after the model, which says where a term came FROM
// rather than where a person would look for it. They were also never drawn:
// `GROUPS` was declared here and read nowhere, and the screen was one flat
// alphabetical run of thirty cards. A field nothing renders is a field nobody
// maintains.
const GROUPS = [
  'basics', 'textile_prep', 'dyeing', 'ecoprint',
  'indigo', 'pigment', 'colour_chemistry', 'fastness',
];

// What moves pH in each direction. Ours, not a photograph of a test strip:
// a strip's colours belong to the maker who printed it, and another maker's
// strip reads differently. What a dyer needs is not what the paper looks like
// but which jar moves the bath which way.
const PH_SHIFTS = {
  up: ['soda_ash', 'washing_soda', 'wood_ash', 'chalk', 'ammonia'],
  down: ['vinegar', 'citric', 'lemon', 'cream_tartar', 'oxalic'],
};

// The scale, in our own palette. Deliberately not the colours a dye turns —
// those belong to the plant, vary by fibre, and are what the reference engine
// is for. These say only where a reading falls.
const PH_BANDS = [
  { from: 1,  to: 3,  key: 'strongAcid',    hex: '#A03D3B' },
  { from: 4,  to: 6,  key: 'weakAcid',      hex: '#C9A227' },
  { from: 7,  to: 7,  key: 'neutral',       hex: '#5C574E' },
  { from: 8,  to: 10, key: 'weakAlkaline',  hex: '#2C3B57' },
  { from: 11, to: 14, key: 'strongAlkaline', hex: '#3A3733' },
];

let tab = 'glossary';
let openId = null;
let draft = null;
let query = '';

function blank() {
  return newRecord({ kind: 'book', name: '', author: '', url: '', note: { bg: '', en: '' } });
}

// ---- glossary -------------------------------------------------------------

// The vocab.js explanations that are ALSO words of the craft, shaped like
// glossary terms so one list can render both. Derived on every call rather than
// stored: a copy would be a second definition, which is the thing this module
// exists not to have.
//
// The test is `glossaryGroup`, not `description`. Until rc13 it was
// `description`, which inferred a decision from a side effect: any code
// explained anywhere in vocab.js appeared here, so the glossary grew silently as
// vocab.js grew, and by rc12 „нищо за записване", „пигмент" and „извлек" — three
// notes about what a recipe records — were sitting among the terms as though
// somebody had put them there. Nobody had. Membership is now stated at the entry
// (§13cb).
//
// It also ended a duplication. `chemistry_class:tannin` carries a description
// and the glossary carries a `tannin` term, so the screen drew TWO cards titled
// „Танини". Guard 24d exists to refuse exactly that and missed it — see the
// guard for why.
function vocabTerms() {
  const out = [];
  for (const v of VOCABULARY) {
    if (!v.glossaryGroup) continue;
    out.push({
      code: v.code,
      group: v.glossaryGroup,
      term: v.label,
      definition: v.description,
      aliases: [],
      seeAlso: [],
      sourceCode: '',
      fromVocabulary: true,
    });
  }
  return out;
}

function matches(term, q) {
  if (!q) return true;
  const hay = [
    text(term.term), term.code,
    text(term.definition),
    ...(term.aliases || []),
  ].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

async function renderGlossary(root, sources) {
  const seeded = await all('glossary');
  const terms = [...seeded, ...vocabTerms()]
    .filter(x => matches(x, query))
    .sort((a, b) => text(a.term).localeCompare(text(b.term), getLang()));

  const byCode = new Map([...seeded, ...vocabTerms()].map(x => [x.code, x]));
  const sourceName = new Map(sources.map(s => [s.code, s.name]));

  const card = (x) => {
    const rel = (x.seeAlso || [])
      .map(c => byCode.get(c))
      .filter(Boolean)
      .map(r => `<span class="chip">${esc(text(r.term))}</span>`)
      .join('');
    const from = x.fromVocabulary
      ? `<span class="hint">${t('library.fromVocabulary')}</span>`
      : (x.sourceCode && sourceName.has(x.sourceCode)
          ? `<span class="hint">${esc(sourceName.get(x.sourceCode))}</span>`
          : '');
    // Name, then definition, then everything secondary on one line beneath.
    // It used to be a two-column row, because `.refcard` is a flex row
    // everywhere else — where the left column is a colour swatch of a fixed
    // 52px. A term name is not a swatch: it wrapped to three lines on the long
    // ones, the column width was set by whichever name in the list happened to
    // be longest, and the chip and the source floated off to the right edge with
    // whitespace between them and the text they belonged to (§13cb).
    return `
      <div class="refcard glossterm">
        <h3 class="termname">${esc(text(x.term))}</h3>
        <p class="termdef">${esc(text(x.definition))}</p>
        ${rel || from ? `<div class="termfoot">${rel}${from}</div>` : ''}
      </div>`;
  };

  // A heading appears only above cards that are there. While a search is
  // running most groups are empty, and a column of headings over nothing reads
  // as an application that has lost its content rather than as a narrow result.
  //
  // A group that holds no term at all is not an error: `indigo` and `pigment`
  // hold two each and either could be emptied by an edit. Guard 24d holds the
  // other direction — that every group a term names is one of these — because
  // that failure is silent, the term simply never being drawn.
  const sections = GROUPS.map(g => {
    const inGroup = terms.filter(x => x.group === g);
    if (!inGroup.length) return '';
    return `
      <h2 class="grouphead">${t('library.group.' + g)}</h2>
      <div class="cards">${inGroup.map(card).join('')}</div>`;
  }).join('');

  return terms.length
    ? sections
    : empty(t('library.noTerms'), t('library.noTermsHint'));
}

// ---- pH -------------------------------------------------------------------

function renderPh() {
  const scale = PH_BANDS.map(b => `
    <div class="phband">
      <span class="swatch" style="background:${b.hex}"></span>
      <strong>${b.from === b.to ? b.from : `${b.from}–${b.to}`}</strong>
      <span>${t('library.ph.' + b.key)}</span>
    </div>`).join('');

  const col = (dir) => PH_SHIFTS[dir]
    .map(c => `<li>${t('library.phAgent.' + c)}</li>`).join('');

  return `
    ${panel(`<p class="note">${t('library.phIntro')}</p>`)}
    <div style="height:16px"></div>
    ${panel(`<h2>${t('library.phScale')}</h2><div class="phscale">${scale}</div>`)}
    <div style="height:16px"></div>
    <div class="cols">
      <div class="col">${panel(`
        <h2>${t('library.phUp')}</h2>
        <p class="note">${t('library.phUpNote')}</p>
        <ul>${col('up')}</ul>`)}</div>
      <div class="col">${panel(`
        <h2>${t('library.phDown')}</h2>
        <p class="note">${t('library.phDownNote')}</p>
        <ul>${col('down')}</ul>`)}</div>
    </div>
    <div style="height:16px"></div>
    ${panel(`<p class="note">${t('library.phWarn')}</p>`)}`;
}

// ---- sources --------------------------------------------------------------

function renderSources(sources) {
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

  return `${panel(`<p class="note">${t('sources.intro')}</p>`)}
          <div style="height:16px"></div>
          ${panel(table, 'flush')}`;
}

// ---- shell ----------------------------------------------------------------

async function renderShell(root) {
  const sources = (await all('sources'))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const tabBar = TABS.map(x => `
    <a class="tab${x === tab ? ' on' : ''}" href="#/library/${x}">${t('library.tab.' + x)}</a>`).join('');

  let body;
  if (tab === 'glossary') body = await renderGlossary(root, sources);
  else if (tab === 'ph') body = renderPh();
  else body = renderSources(sources);

  const search = tab === 'glossary'
    ? `<input type="search" data-q value="${esc(query)}" placeholder="${t('library.search')}">`
    : '';

  root.innerHTML = page({
    title: t('library.title'),
    sub: t('library.sub'),
    actions: tab === 'sources'
      ? actionBtn('add', t('sources.new'), 'data-new', 'primary')
      : search,
    body: `<div class="tabs">${tabBar}</div>
           <div style="height:16px"></div>
           ${body}`,
  });
}

async function renderForm(root, r) {
  const isNew = openId === 'new';

  root.innerHTML = page({
    title: isNew ? t('sources.new') : (r.name || t('sources.one')),
    sub: '',
    actions: `${backTo('#/library/sources', t('library.tab.sources'))}
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
  id: 'library',
  title: () => t('library.title'),
  sub: () => t('library.sub'),

  // The address decides what is on screen (§13q).
  //
  //   #/library                    the glossary
  //   #/library/glossary|ph        that tab
  //   #/library/sources            the source list
  //   #/library/sources/new        a new source
  //   #/library/sources/<id>       the record
  //
  // The tab is IN the address, not in a variable the address does not mention.
  // A tab kept only in memory looks like it works and breaks the back button,
  // reload and bookmarks all at once (§13q) — the same fault a sessionStorage
  // handoff has, wearing different clothes.
  open(first, second) {
    draft = null;
    tab = TABS.includes(first) ? first : 'glossary';
    openId = (tab === 'sources' && second) ? second : null;
  },

  reset() {
    tab = 'glossary';
    openId = null;
    draft = null;
    query = '';
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
      if (!draft) return navigate('#/library/sources');
      await renderForm(root, draft);
    } else {
      draft = null;
      await renderShell(root);
    }

    const q = root.querySelector('[data-q]');
    if (q) {
      q.oninput = async () => {
        query = q.value;
        const at = q.selectionStart;
        await renderShell(root);
        const again = root.querySelector('[data-q]');
        if (again) { again.focus(); again.setSelectionRange(at, at); }
      };
    }

    root.onclick = async (e) => {
      if (e.target.closest('a')) return;
      if (e.target.closest('[data-new]')) return navigate('#/library/sources/new');
      const row = e.target.closest('[data-open]');
      if (row) return navigate(`#/library/sources/${row.dataset.open}`);
      if (e.target.closest('[data-back]')) return navigate('#/library/sources');
      if (e.target.closest('[data-save]')) {
        readForm(root);
        await put('sources', draft);
        // The put succeeded, so the work is saved and the address change that
        // follows is not a departure. `dirty.js` cannot tell the two apart from
        // outside — it infers a successful save by watching the form leave the
        // screen — but in here the answer is known (§13ad).
        markClean();
        return navigate('#/library/sources');
      }
      if (e.target.closest('[data-delete]')) {
        // Guarded (§13ct). Attribution is part of the history: a source that
        // glossary terms, recipes or colour swatches credit cannot be deleted,
        // or the claim stays and the credit it rests on is gone.
        if (!await deleteGuarded('sources', draft.id, t('sources.confirmDelete'))) return;
        return navigate('#/library/sources');
      }
    };
  },
};

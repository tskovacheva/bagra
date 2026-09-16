// modules/about.js — what the application is, how to start, what it will not do
// for you, and the legal texts (§13eg, ROADMAP A6).
//
// WHY ONE MODULE AND NOT SEVEN SCREENS.
//
// A6 lists seven documents: About and version, Help, Terms, Privacy, Licence, a
// chemical-handling disclaimer, and a way to report a fault. Seven sidebar
// entries for seven pages that are each read once would be a navigation built
// for the developer's list rather than for the person. They are four tabs:
//
//   about   what this is, which version, and how to report a fault
//   help    how to start, and where the parts of it are
//   safety  the chemical-handling disclaimer — the one that is not paperwork
//   legal   terms, privacy and the licence, in that order
//
// THE TEXTS LIVE IN i18n.js, like every other word in this application. They
// are long, and the temptation was to keep them here as template literals
// because that reads more naturally while writing them. That would put half the
// application's Bulgarian in one file and its English in another, and the
// English of these is exactly what the owner still has to read (A7, item 3).
//
// WHAT IS DELIBERATELY NOT HERE: a licence the owner has not agreed to. The
// text below is a DRAFT for her to accept, change or replace, and it says so on
// the screen rather than in a comment she will not see.

import { t, getLang } from '../i18n.js';
import { page, panel, esc, note, icon } from '../ui.js';
import { VERSION } from '../version.js';

const TABS = ['about', 'help', 'safety', 'legal'];
let tab = 'about';

// The address a fault is reported to. One constant, because it belongs in the
// text of the screen AND in what a person copies, and two copies of an address
// is how one of them goes stale. EMPTY until the owner gives it: an invented
// address is worse than a missing one, and the screen says plainly that it is
// not set rather than showing a dead link.
export const CONTACT = '';

// The paragraphs of a tab, by key. Written out rather than looped over a range,
// so that adding one is a deliberate act and a missing translation is visible
// here rather than as a gap on the screen.
const PARAS = {
  about: ['about.what', 'about.reference', 'about.diary', 'about.offline'],
  help: ['help.start', 'help.plants', 'help.recipes', 'help.trials', 'help.backup'],
  safety: ['safety.lead', 'safety.powders', 'safety.vessels', 'safety.iron',
           'safety.plants', 'safety.disposal', 'safety.children', 'safety.calc'],
  legal: [],
};

const paras = (key) => PARAS[key].map(k => `<p>${esc(t(k))}</p>`).join('');

function renderAbout() {
  const report = CONTACT
    ? `<p>${esc(t('about.reportTo'))} <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a></p>`
    : note(t('about.reportNoAddress'), 'warn');

  return `
    ${panel(`<h2>${esc(t('about.title'))}</h2>${paras('about')}`)}
    <div style="height:16px"></div>
    ${panel(`
      <h2>${esc(t('about.versionTitle'))}</h2>
      <p class="figure">${esc(VERSION)}</p>
      <p class="hint">${esc(t('about.versionHint'))}</p>`)}
    <div style="height:16px"></div>
    ${panel(`
      <h2>${esc(t('about.reportTitle'))}</h2>
      <p>${esc(t('about.reportWhat'))}</p>
      <ul>
        <li>${esc(t('about.reportItem1'))}</li>
        <li>${esc(t('about.reportItem2'))}</li>
        <li>${esc(t('about.reportItem3'))}</li>
      </ul>
      ${report}
      <p class="hint">${esc(t('about.reportVersion', { version: VERSION, lang: getLang() }))}</p>`)}`;
}

const renderHelp = () => panel(`<h2>${esc(t('help.title'))}</h2>${paras('help')}`);

// The safety text is the one document here that is not paperwork. It is read by
// somebody about to weigh a metal salt, so it opens with what to do and not with
// what the developer is not liable for.
const renderSafety = () => `
  ${note(t('safety.banner'), 'warn')}
  ${panel(`<h2>${esc(t('safety.title'))}</h2>${paras('safety')}`)}`;

const renderLegal = () => `
  ${panel(`<h2>${esc(t('terms.title'))}</h2>
    <p>${esc(t('terms.what'))}</p>
    <p>${esc(t('terms.support'))}</p>
    <p>${esc(t('terms.notSupport'))}</p>
    <p>${esc(t('terms.suggestions'))}</p>`)}
  <div style="height:16px"></div>
  ${panel(`<h2>${esc(t('privacy.title'))}</h2>
    <p>${esc(t('privacy.noAccount'))}</p>
    <p>${esc(t('privacy.whereData'))}</p>
    <p>${esc(t('privacy.noAnalytics'))}</p>
    <p>${esc(t('privacy.hosting'))}</p>
    <p>${esc(t('privacy.yourJob'))}</p>`)}
  <div style="height:16px"></div>
  ${panel(`<h2>${esc(t('licence.title'))}</h2>
    ${note(t('licence.draft'), 'warn')}
    <p>${esc(t('licence.granted'))}</p>
    <p>${esc(t('licence.library'))}</p>
    <p>${esc(t('licence.yourWork'))}</p>
    <p>${esc(t('licence.noWarranty'))}</p>`)}`;

export default {
  id: 'about',
  title: () => t('about.navTitle'),
  sub: () => t('about.sub'),

  //   #/about                 what this is
  //   #/about/help|safety|legal   that tab
  open(first) {
    tab = TABS.includes(first) ? first : 'about';
  },

  reset() { tab = 'about'; },

  async render(root) {
    const tabBar = TABS.map(x => `
      <a class="tab${x === tab ? ' on' : ''}" href="#/about/${x}">${esc(t('about.tab.' + x))}</a>`).join('');

    const body = tab === 'help' ? renderHelp()
      : tab === 'safety' ? renderSafety()
      : tab === 'legal' ? renderLegal()
      : renderAbout();

    root.innerHTML = page({
      title: t('about.navTitle'),
      sub: t('about.sub'),
      actions: `<div class="tabs">${tabBar}</div>`,
      body,
    });
  },
};

// i18n.js — interface labels only (§13.1, kind 1).
//
// Three kinds of text exist in this app. This file handles the first:
// captions and vocabulary labels, which ship with the application and are
// never written by the user. The second kind — personal free text — is stored
// as written and never translated. The third — authored reference prose — is
// stored as { bg, en } with the second half optional.

import { getSetting, setSetting } from './db.js';

let lang = 'bg';
export const getLang = () => lang;

export async function initLang() {
  lang = await getSetting('language', 'bg');
  document.documentElement.lang = lang;
  return lang;
}

export async function setLang(next) {
  lang = next;
  document.documentElement.lang = next;
  await setSetting('language', next);
}

// Resolve a { bg, en } pair. The second language may be missing and that is a
// normal, complete state — fall back rather than showing an empty field.
export function text(pair) {
  if (!pair) return '';
  if (typeof pair === 'string') return pair;
  return pair[lang] || pair.bg || pair.en || '';
}

// True when a record's prose is still single-language. Drives the quiet
// "translation missing" indicator, never a block on saving.
export function needsTranslation(pair, target = 'en') {
  return !!pair && typeof pair === 'object' && !pair[target];
}

const DICT = {
  bg: {
    'app.name': 'Багра',
    'app.tagline': 'by Crafty Place',

    'nav.dashboard': 'Начало',
    'nav.reference': 'Справочник',
    'nav.plants': 'Растения',
    'nav.fabrics': 'Тъкани',
    'nav.materials': 'Материали',
    'nav.recipes': 'Рецепти',
    'nav.techniques': 'Техники',
    'nav.trials': 'Тестове',
    'nav.tools': 'Инструменти',
    'nav.packs': 'Пакети',

    'dash.title': 'Начало',
    'dash.sub': 'Какво има в кутиите, какво предстои, какво липсва в справочника.',

    'reference.title': 'Справочник',
    'reference.sub': 'Попълни само това, което знаеш — частичните съвпадения също се показват.',
    'plants.title': 'Растения',
    'plants.sub': 'Багрилни растения и растения за еко принт.',
    'fabrics.title': 'Тъкани',
    'fabrics.sub': 'Всеки запис е едно физическо парче, със състояние и история.',
    'materials.title': 'Материали',
    'materials.sub': 'Багрила, танини, морданти, pH модификатори.',
    'recipes.title': 'Рецепти',
    'recipes.sub': 'Изпиране, танин, мордант, багрене, еко принт, одеяла, пигменти, пасти.',
    'techniques.title': 'Техники',
    'techniques.sub': 'Резист, шибори, печат, последващи обработки.',
    'trials.title': 'Тестове',
    'trials.sub': 'Какво е направено, кога, с какво — и какво е дало.',
    'tools.title': 'Инструменти',
    'tools.sub': 'Калкулатори, архив, справки.',
    'packs.title': 'Пакети',
    'packs.sub': 'Внасяне и изнасяне на справочна информация.',

    'stub.empty': 'Модулът още не е разработен.',
    'stub.next': 'Следва по план.',
    'lang.bg': 'БГ',
    'lang.en': 'EN',
  },

  en: {
    'app.name': 'Rubia',
    'app.tagline': 'by Crafty Place',

    'nav.dashboard': 'Home',
    'nav.reference': 'Reference',
    'nav.plants': 'Plants',
    'nav.fabrics': 'Fabrics',
    'nav.materials': 'Materials',
    'nav.recipes': 'Recipes',
    'nav.techniques': 'Techniques',
    'nav.trials': 'Trials',
    'nav.tools': 'Tools',
    'nav.packs': 'Packs',

    'dash.title': 'Home',
    'dash.sub': "What is in the boxes, what is next, what the reference is missing.",

    'reference.title': 'Reference',
    'reference.sub': 'Fill in only what you know — partial matches are shown too.',
    'plants.title': 'Plants',
    'plants.sub': 'Dye plants and eco print plants.',
    'fabrics.title': 'Fabrics',
    'fabrics.sub': 'Each record is one physical piece, with a state and a history.',
    'materials.title': 'Materials',
    'materials.sub': 'Dyestuffs, tannins, mordants, pH modifiers.',
    'recipes.title': 'Recipes',
    'recipes.sub': 'Scour, tannin, mordant, dye, eco print, blankets, pigments, pastes.',
    'techniques.title': 'Techniques',
    'techniques.sub': 'Resist, shibori, printing, post-treatments.',
    'trials.title': 'Trials',
    'trials.sub': 'What was done, when, with what — and what it gave.',
    'tools.title': 'Tools',
    'tools.sub': 'Calculators, backup, reference guides.',
    'packs.title': 'Packs',
    'packs.sub': 'Importing and exporting reference knowledge.',

    'stub.empty': 'This module is not built yet.',
    'stub.next': 'Coming up.',
    'lang.bg': 'BG',
    'lang.en': 'EN',
  },
};

export function t(key) {
  return (DICT[lang] && DICT[lang][key]) || DICT.bg[key] || key;
}

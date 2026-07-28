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

    'dashboard.title': 'Начало',
    'dashboard.sub': 'Какво има в кутиите, какво предстои, какво липсва в справочника.',

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

    'common.back': 'Назад',
    'common.save': 'Запази',
    'common.choose': 'избери…',
    'common.all': 'Всички',
    'common.date': 'Дата',
    'common.notes': 'Бележки',
    'common.days': '{n} дни',

    'fabrics.new': 'Нова тъкан',
    'fabrics.newSub': 'Едно парче — една дреха, един шал, едно руло.',
    'fabrics.one': 'Тъкан',
    'fabrics.empty': 'Още няма записани тъкани.',
    'fabrics.emptyHint': 'Всеки запис е едно физическо парче — една дреха, един шал, едно руло.',
    'fabrics.emptyBox': 'В тази кутия няма нищо.',

    'fabrics.col.label': 'Етикет',
    'fabrics.col.name': 'Име',
    'fabrics.col.composition': 'Състав',
    'fabrics.col.class': 'Клас',
    'fabrics.col.structure': 'Структура',
    'fabrics.col.weight': 'Тегло',
    'fabrics.col.box': 'Кутия',

    'fabrics.identity': 'Идентичност',
    'fabrics.label': 'Етикет',
    'fabrics.labelHint': 'Кодът, който пишеш на етикета с безопасната игла.',
    'fabrics.name': 'Име',
    'fabrics.namePlaceholder': 'стар чаршаф, копринен шал…',
    'fabrics.origin': 'Произход',
    'fabrics.origin.new': 'нов плат',
    'fabrics.origin.reclaimed': 'стара дреха / втора употреба',
    'fabrics.wasA': 'Какво е било',
    'fabrics.wasAPlaceholder': 'стар чаршаф, тениска…',
    'fabrics.condition': 'Състояние',
    'fabrics.supplier': 'Доставчик',
    'fabrics.purchaseDate': 'Дата на покупка',
    'fabrics.form': 'Форма',
    'fabrics.structure': 'Структура',
    'fabrics.baseColour': 'Основен цвят',
    'fabrics.colour.natural': 'суров',
    'fabrics.colour.bleached': 'избелен',
    'fabrics.colour.predyed': 'вече боядисан',
    'fabrics.colour.dyed_by_me': 'боядисан от мен',

    'fabrics.composition': 'Състав',
    'fabrics.addFibre': '+ влакно',
    'fabrics.removeFibre': 'премахни',
    'fabrics.percent': 'процент',
    'fabrics.derived': 'Клас влакно: <b>{cls}</b> · багрилоприемаща част: <b>{pct}%</b>',
    'fabrics.warn.total': 'Съставът дава <b>{total}%</b> вместо 100%.',
    'fabrics.warn.mixed': 'Смесена целулоза и протеин — двете части приемат мордант и цвят различно. Един мордантен маршрут няма да свърши работа за целия плат.',
    'fabrics.warn.synthetic': '{pct}% синтетика — по-голямата част от плата няма да приеме багрило.',
    'fabrics.confirmTotal': 'Съставът дава {total}% вместо 100%. Да запазя ли така?',

    'fabrics.measure': 'Мярка',
    'fabrics.weightG': 'Тегло (г)',
    'fabrics.weightHint': 'Нужно е за всяко изчисление в % WOF.',
    'fabrics.dimensions': 'Размери',
    'fabrics.dimensionsPlaceholder': '40×180 см, размер M',
    'fabrics.gsm': 'Плътност (г/м²)',
    'fabrics.quantity': 'Количество',
    'fabrics.grams': 'г',

    'fabrics.boxHistory': 'Кутия и история',
    'fabrics.initialState': 'Начално състояние',
    'fabrics.initialStateHint': 'В коя кутия влиза сега.',
    'fabrics.nowIn': 'Сега е в кутия <b>{state}</b>.',
    'fabrics.noTransitions': 'Още няма записани преходи.',
    'fabrics.newTransition': 'Нов преход',
    'fabrics.addTransition': 'Запиши прехода',
    'fabrics.notesPlaceholder': 'как се свива, как приема цвят…',
    'fabrics.delete': 'Изтрий тъканта',
    'fabrics.confirmDelete': 'Да изтрия ли тази тъкан?',

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

    'dashboard.title': 'Home',
    'dashboard.sub': "What is in the boxes, what is next, what the reference is missing.",

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

    'common.back': 'Back',
    'common.save': 'Save',
    'common.choose': 'choose…',
    'common.all': 'All',
    'common.date': 'Date',
    'common.notes': 'Notes',
    'common.days': '{n} days',

    'fabrics.new': 'New fabric',
    'fabrics.newSub': 'One piece — one garment, one scarf, one roll.',
    'fabrics.one': 'Fabric',
    'fabrics.empty': 'No fabrics recorded yet.',
    'fabrics.emptyHint': 'Each record is one physical piece — a garment, a scarf, a roll.',
    'fabrics.emptyBox': 'This box is empty.',

    'fabrics.col.label': 'Tag',
    'fabrics.col.name': 'Name',
    'fabrics.col.composition': 'Composition',
    'fabrics.col.class': 'Class',
    'fabrics.col.structure': 'Structure',
    'fabrics.col.weight': 'Weight',
    'fabrics.col.box': 'Box',

    'fabrics.identity': 'Identity',
    'fabrics.label': 'Tag code',
    'fabrics.labelHint': 'The code written on the tag pinned to the cloth.',
    'fabrics.name': 'Name',
    'fabrics.namePlaceholder': 'old bedsheet, silk scarf…',
    'fabrics.origin': 'Origin',
    'fabrics.origin.new': 'new fabric',
    'fabrics.origin.reclaimed': 'reclaimed garment',
    'fabrics.wasA': 'What it was',
    'fabrics.wasAPlaceholder': 'bedsheet, t-shirt…',
    'fabrics.condition': 'Condition',
    'fabrics.supplier': 'Supplier',
    'fabrics.purchaseDate': 'Purchase date',
    'fabrics.form': 'Form',
    'fabrics.structure': 'Structure',
    'fabrics.baseColour': 'Base colour',
    'fabrics.colour.natural': 'natural',
    'fabrics.colour.bleached': 'bleached',
    'fabrics.colour.predyed': 'already dyed',
    'fabrics.colour.dyed_by_me': 'dyed by me',

    'fabrics.composition': 'Composition',
    'fabrics.addFibre': '+ fibre',
    'fabrics.removeFibre': 'remove',
    'fabrics.percent': 'percent',
    'fabrics.derived': 'Fibre class: <b>{cls}</b> · dye-receptive fraction: <b>{pct}%</b>',
    'fabrics.warn.total': 'The composition totals <b>{total}%</b>, not 100%.',
    'fabrics.warn.mixed': 'Mixed cellulose and protein — the two fractions take mordant and colour differently. One mordanting route will not serve the whole cloth.',
    'fabrics.warn.synthetic': '{pct}% synthetic — most of this cloth will not take dye.',
    'fabrics.confirmTotal': 'The composition totals {total}%, not 100%. Save anyway?',

    'fabrics.measure': 'Measure',
    'fabrics.weightG': 'Weight (g)',
    'fabrics.weightHint': 'Required for every % WOF calculation.',
    'fabrics.dimensions': 'Dimensions',
    'fabrics.dimensionsPlaceholder': '40×180 cm, size M',
    'fabrics.gsm': 'Weight (g/m²)',
    'fabrics.quantity': 'Quantity',
    'fabrics.grams': 'g',

    'fabrics.boxHistory': 'Box and history',
    'fabrics.initialState': 'Initial state',
    'fabrics.initialStateHint': 'Which box it goes into now.',
    'fabrics.nowIn': 'Currently in the <b>{state}</b> box.',
    'fabrics.noTransitions': 'No transitions recorded yet.',
    'fabrics.newTransition': 'New transition',
    'fabrics.addTransition': 'Record transition',
    'fabrics.notesPlaceholder': 'how it shrinks, how it takes colour…',
    'fabrics.delete': 'Delete fabric',
    'fabrics.confirmDelete': 'Delete this fabric?',

    'lang.bg': 'BG',
    'lang.en': 'EN',
  },
};

export function t(key, params = null) {
  let out = (DICT[lang] && DICT[lang][key]) || DICT.bg[key] || key;
  if (params) for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll('{' + k + '}', v);
  }
  return out;
}

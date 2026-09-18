#!/usr/bin/env python3
"""Audit stage 3, package 1 (1.0.0-rc80): provenance and wording of eight recipes.

Scope, fixed by the owner: the three Cliffe print pastes and the five Kelly
recipes, plus the register entries they cite. No quantity, range, unit, role,
substance, id or follow-on is touched — the script asserts that at the end.

Every replacement names the text it expects to find. If the text is not there
the script stops rather than writing over something it has not seen, so a
second run, or a run against a different tree, fails loudly (§13ec: a merge
that ran twice left two baths).
"""
import json, copy, sys

RECIPES = 'seed/recipes.json'
SOURCES = 'seed/sources.json'

def load(p):
    return json.load(open(p, encoding='utf-8'))

def save(p, d):
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')

def swap(obj, key, lang, old, new, where):
    have = obj[key][lang]
    if old not in have:
        sys.exit(f'{where}.{key}.{lang}: expected text not found — "{old[:60]}"')
    if have.count(old) != 1:
        sys.exit(f'{where}.{key}.{lang}: expected text found more than once')
    obj[key][lang] = have.replace(old, new)

r = load(RECIPES)
s = load(SOURCES)
before = copy.deepcopy(r)
by = {x['code']: x for x in r['recipes']}
src = {x['code']: x for x in s['sources']}

def step(code, sid):
    return next(x for x in by[code]['steps'] if x['id'] == sid)

def ing(code, iid):
    return next(x for x in by[code]['ingredients'] if x['id'] == iid)

# ---------------------------------------------------------------- Kelly / Garcia
#
# Kelly is the source of the version used. Garcia reaches Bagra only through
# Kelly's own statement, so he leaves `sourceCodes` (the list of sources that
# stand behind the record, §13ea) and the statement is written in the recipe's
# words, marked as hers. His register entry stays.

PROV_BG = (' Използвана версия: Алисън Кели. Авторката посочва, че е адаптирала формула на Мишел Гарсия, '
           'като е заменила калциевия хидроксид със сода. Първоизточникът не е проверен.')
PROV_EN = (' Version used: Alison Kelly. She states that she adapted a formula by Michel Garcia, replacing '
           'calcium hydroxide with soda ash. The original has not been checked.')

for code in ('compound-mordant-bright', 'compound-mordant-dark'):
    rec = by[code]
    swap(rec, 'notes', 'bg', 'Количествата са от партидата в книгата, преизчислени на 100 г плат.',
         'Количествата са от партидата на Кели, преизчислени на 100 г плат.' + PROV_BG, code)
    swap(rec, 'notes', 'en', "The quantities are the book's batch, recalculated to 100 g of cloth.",
         "The quantities are Kelly's batch, recalculated to 100 g of cloth." + PROV_EN, code)

for code in ('compound-mordant-bright', 'compound-mordant-dark', 'oatmeal-fixing-bath'):
    if by[code]['sourceCodes'] != ['alison-kelly-printing', 'michel-garcia']:
        sys.exit(f'{code}: sourceCodes not as expected: {by[code]["sourceCodes"]}')
    by[code]['sourceCodes'] = ['alison-kelly-printing']

# The bath: Kelly's, as part of the same procedure. Whether her attribution to
# Garcia covers the bath as well is not known here, so nothing is said about it.
oat = by['oatmeal-fixing-bath']
swap(oat, 'notes', 'bg', 'защото преди овеса се е използвала кравешка тор.',
     'защото преди овеса се е използвала кравешка тор. Използвана версия: Алисън Кели, като част от '
     'процедурата със сложния закрепител.', 'oatmeal-fixing-bath')
swap(oat, 'notes', 'en', 'because cow manure was used before oats.',
     'because cow manure was used before oats. Version used: Alison Kelly, as part of the compound '
     'mordant procedure.', 'oatmeal-fixing-bath')

# Iron bath: the one idiom that reads as the book's voice, in English.
iron = by['iron-bath-dark']
swap(iron, 'notes', 'bg', 'Малко желязо върши много.', 'Желязото действа още в малко количество.', 'iron-bath-dark')
swap(iron, 'notes', 'en', 'A little iron goes a long way.', 'Iron works even in small amounts.', 'iron-bath-dark')
swap(iron, 'notes', 'en', 'because iron oxidises quickly in water and yellows the textile.',
     'because in water the iron oxidises quickly and leaves a yellow cast on the cloth.', 'iron-bath-dark')

# Soy milk: one step whose English doubled its verb.
swap(step('soy-milk-bath', 'smb-s3'), 'text', 'en', 'Agitate and stir gently from time to time.',
     'Stir gently now and then.', 'soy-milk-bath.smb-s3')

# ---------------------------------------------------------------- Cliffe
#
# 6.2 — the dye paste with no mordant: the clean ground is a result, not a
# promise; the two weeks are Cliffe's figure and are said to be hers.
dpp = by['dye-print-paste']
swap(dpp, 'notes', 'bg', 'Фонът остава без цвят. Пази се около две седмици в затворен съд.',
     'Дали фонът ще остане чист, зависи от багрилото, от плата и от предварителната му обработка. '
     'Клиф посочва срок на съхранение около две седмици в затворен съд; това не е проверена гаранция — '
     'изхвърли пастата, ако мирише, мухляса или промени консистенцията си.', 'dye-print-paste')
swap(dpp, 'notes', 'en', 'Printed onto pre-mordanted cloth', 'It is printed onto cloth that has already been mordanted',
     'dye-print-paste')
swap(dpp, 'notes', 'en', 'The ground stays clear. Keeps about two weeks in a closed jar.',
     'Whether the ground stays clear depends on the dye, the cloth and how it was prepared. Cliffe gives a '
     'keeping time of about two weeks in a closed jar; that is not a verified guarantee — discard the paste '
     'if it smells, grows mould or changes consistency.', 'dye-print-paste')
swap(ing('dye-print-paste', 'dpp-2'), 'note', 'bg', 'гумата дава по-остър ръб без разтичане.',
     'с гума ръбът остава по-остър и не се разлива.', 'dye-print-paste.dpp-2')
swap(ing('dye-print-paste', 'dpp-2'), 'note', 'en', 'the gum gives a crisper edge with no seeping.',
     'with gum the edge stays sharper and does not spread.', 'dye-print-paste.dpp-2')
swap(step('dye-print-paste', 'dpp-s1'), 'text', 'en', 'Pour the solution into a wide-mouthed jar or beaker.',
     'Pour the solution into a wide-necked container.', 'dye-print-paste.dpp-s1')
swap(step('dye-print-paste', 'dpp-s2'), 'text', 'bg', 'докато пастата се сгъсти и стане полупрозрачна — като сос.',
     'докато пастата се сгъсти и стане полупрозрачна.', 'dye-print-paste.dpp-s2')
swap(step('dye-print-paste', 'dpp-s2'), 'text', 'en', 'until the paste thickens and turns translucent — like a sauce.',
     'until the paste has thickened and become translucent.', 'dye-print-paste.dpp-s2')

# 6.4 — the ready-to-use paste: the one explanatory passage that followed the
# book's exposition, rewritten; the 1–10% stays.
dmp = by['dye-mordant-print-paste']
swap(dmp, 'notes', 'bg',
     'Колко екстракт зависи от багрилото — 1–10% обикновено стига; тегли го точно и добавяй на малки стъпки, '
     'докато цветът стане какъвто го искаш.',
     'Количеството екстракт е различно за всяко багрило; обичайният обхват е 1–10%. Претегли го и го '
     'увеличавай постепенно до желания тон.', 'dye-mordant-print-paste')
swap(dmp, 'notes', 'en',
     'How much extract depends on the dye — 1–10% is usually enough; weigh it accurately and add in small '
     'increments until the depth of colour is right.',
     'The amount of extract differs from dye to dye; the usual range is 1–10%. Weigh it, and increase it '
     'gradually until you reach the shade you want.', 'dye-mordant-print-paste')

# 6.5 — the mordant paste: Cliffe and Maiwa both stay. Two English steps that
# followed a source's phrasing, and one term brought into line with the rest.
swap(step('mordant-print-paste', 'mpp-s1'), 'text', 'en',
     'Take a vessel at least four to five times the volume of the liquid — the mixture will rise.',
     'Use a container at least four to five times larger than the amount of liquid — the mixture foams up.',
     'mordant-print-paste.mpp-s1')
swap(step('mordant-print-paste', 'mpp-s7'), 'text', 'en',
     'Let it dry completely. Use a hairdryer or an iron to be sure it is thoroughly dry.',
     'Let it dry completely; a hairdryer or an iron will finish the drying.', 'mordant-print-paste.mpp-s7')
swap(step('mordant-print-paste', 'mpp-s8'), 'text', 'en', 'in the calcium carbonate bath', 'in the chalk bath',
     'mordant-print-paste.mpp-s8')

# ---------------------------------------------------------------- the register

k = src['alison-kelly-printing']
k['note'] = {
    'bg': 'Ръководство за еко принт върху плат и хартия (Storey Publishing, 2026). Дава сложния закрепител, '
          'банята с овесени ядки, соевото мляко и желязната баня, с количества и снимки на стъпките. За сложния '
          'закрепител авторката посочва, че е нейна адаптация на формула на Мишел Гарсия.',
    'en': 'A guide to botanical printing on fabric and paper (Storey Publishing, 2026). It gives the compound '
          'mordant, the oatmeal bath, the soy milk bath and the iron bath, with quantities and photographed '
          'steps. For the compound mordant, the author states that it is her adaptation of a formula by '
          'Michel Garcia.',
}

g = src['michel-garcia']
swap(g, 'note', 'bg', 'Сложният закрепител тук е негова рецепта, адаптирана от Алисън Кели.',
     'В Багра името му идва само чрез Алисън Кели, която посочва, че сложният закрепител е нейна адаптация '
     'на негова формула. Първоизточникът не е проверен и Багра не му приписва авторството самостоятелно.',
     'michel-garcia')
swap(g, 'note', 'en', 'The compound mordant here is his recipe, as adapted by Alison Kelly.',
     'He reaches Bagra only through Alison Kelly, who states that the compound mordant is her adaptation of '
     'a formula of his. The original has not been checked, and Bagra does not attribute the formula to him '
     'on its own authority.', 'michel-garcia')

c = src['nicola-cliffe-printing']
c['note'] = {
    'bg': 'Ръководство за печат с натурални багрила. Глава 6 дава пастите с количества и с това какво става с '
          'плата след нанасянето: 6.2 — багрилна паста без закрепител, 6.4 — готова паста с багрило и '
          'закрепител, 6.5 — паста със закрепител без багрило.',
    'en': 'A guide to printing with natural dyes. Chapter 6 gives the pastes, with quantities and with what '
          'happens to the cloth afterwards: 6.2 — a dye paste with no mordant, 6.4 — a ready-to-use paste with '
          'dye and mordant, 6.5 — a mordant paste with no dye.',
}

p = src['crafty-place-practice']
p['note'] = {
    'bg': 'Практически бележки и адаптации от Crafty Place. Където формулата идва от публикация, източникът '
          'е посочен отделно.',
    'en': 'Practical notes and adaptations from Crafty Place. Where a formula comes from a publication, that '
          'source is listed separately.',
}

r['packVersion'] = '0.18.1'
s['packVersion'] = '14'

# ---------------------------------------------------------------- nothing technical moved

TECH = ('code', 'type', 'output', 'scaleBy', 'appliesTo', 'requiredFollowOn', 'distributable')
ING = ('id', 'roleCode', 'basis', 'unit', 'quantity', 'quantityMin', 'quantityMax', 'options')
for old, new in zip(before['recipes'], r['recipes']):
    for k_ in TECH:
        if old.get(k_, '∅') != new.get(k_, '∅'):
            sys.exit(f'{old["code"]}.{k_} changed')
    if [x.get('id') for x in old['steps']] != [x.get('id') for x in new['steps']]:
        sys.exit(f'{old["code"]}: step ids changed')
    for a, b in zip(old['ingredients'], new['ingredients']):
        for k_ in ING:
            if a.get(k_, '∅') != b.get(k_, '∅'):
                sys.exit(f'{old["code"]}.{a["id"]}.{k_} changed')

save(RECIPES, r)
save(SOURCES, s)
print('stage 3, package 1: eight recipes and four register entries written; no technical field moved')

#!/usr/bin/env python3
"""Audit stage 3, closing package (1.0.0-rc81): the six remaining recipes.

Scope, fixed by the owner: pigment-lake-master, pastels-from-pigment,
pastel-binder-oat, watercolour-from-pigment, watercolour-binder,
pastel-binder-gum; the register entries they cite; two deferred edits
(Garcia's register note, and „варова баня" in two paste steps).

Same discipline as attribution-stage3.py: every replacement names the text it
expects, a second run stops, and no technical field may move. `distributable`
is NOT set on any record — that waits for the owner (DECISIONS §28a).
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
    if have.count(old) != 1:
        sys.exit(f'{where}.{key}.{lang}: expected text found {have.count(old)} times — "{old[:60]}"')
    obj[key][lang] = have.replace(old, new)

r = load(RECIPES)
s = load(SOURCES)
before = copy.deepcopy(r)
by = {x['code']: x for x in r['recipes']}
src = {x['code']: x for x in s['sources']}

def ingredient(code, role, nth=0):
    return [x for x in by[code]['ingredients'] if x['roleCode'] == role][nth]

def step(code, i):
    return by[code]['steps'][i]

# ---------------------------------------------------------------- pigment-lake-master
# Nothing claims Stopka invented lake pigments; the ingredient note already says
# the table is hers. Left as it is.

# ---------------------------------------------------------------- pastels-from-pigment
# The filler note said more filler = SOFTER, the recipe note said = HARDER. Neither
# is sourced, so both lose the hardness claim; paler with more filler stays.
p = by['pastels-from-pigment']
f = ingredient('pastels-from-pigment', 'filler')
swap(f, 'note', 'bg', 'Повече пълнител, по-мек и по-блед пастел. Съотношението нарочно няма число: то е изборът, с който правиш пастела мек или твърд, и се решава при всяка партида.',
     'Повече пълнител дава по-светъл пастел. Съотношението нарочно няма число: решава се при всяка партида, според тона и консистенцията, които търсиш.', 'pastels.filler')
swap(f, 'note', 'en', 'More filler makes a softer, paler pastel. The proportion is deliberately not a figure: it is the choice that makes the pastel soft or hard and is made batch by batch.',
     'More filler gives a paler pastel. The proportion is deliberately not a figure: it is decided batch by batch, for the shade and the consistency you are after.', 'pastels.filler')
swap(p, 'notes', 'bg', 'чист пигмент дава наситен и трошлив пастел, повече пълнител — по-светъл и по-твърд.',
     'чист пигмент дава наситен пастел, повече пълнител — по-светъл.', 'pastels')
swap(p, 'notes', 'en', 'pure pigment gives a saturated, crumbly pastel, more filler a paler and harder one.',
     'pure pigment gives a saturated pastel, more filler a paler one.', 'pastels')

# ---------------------------------------------------------------- pastel-binder-oat
o = by['pastel-binder-oat']
swap(o, 'notes', 'bg', 'Разтворът на Стопка за пастели, вместо гум трагакант.',
     'Овесен свързващ разтвор по рецептура, представена от Натали Стопка, на мястото на гум трагакант.', 'pastel-binder-oat')
swap(o, 'notes', 'en', "Stopka's pastel binder in place of gum tragacanth.",
     'An oat binder after a formula presented by Natalie Stopka, in place of gum tragacanth.', 'pastel-binder-oat')
# „овесени ядки" / „oat groats" is the substance's own name (seed:oats), used by
# three recipes. Not changed on a guess — DECISIONS §29b.

# ---------------------------------------------------------------- watercolour-from-pigment
# BG said several teaspoons, EN a couple; brought into line with the BG.
swap(step('watercolour-from-pigment', 0), 'text', 'en', 'Tip a couple of teaspoons of pigment onto a smooth glass slab.',
     'Put a few teaspoons of pigment on a smooth glass slab.', 'watercolour-from-pigment.s1')

# ---------------------------------------------------------------- watercolour-binder
w = by['watercolour-binder']
g = ingredient('watercolour-binder', 'binder')
swap(g, 'note', 'bg', 'Течната гума не върши работа тук — прахът е това, което се разтваря докрай.',
     'Тази формула е за прах: готовата течна гума е с друга концентрация и не може да го замени в тези количества.', 'binder.gum')
swap(g, 'note', 'en', 'Liquid gum does not do this job — the powder is what dissolves completely.',
     'This formula is for the powder: ready-made liquid gum has a different concentration and cannot replace it in these amounts.', 'binder.gum')

gl = ingredient('watercolour-binder', 'humectant', 0)
swap(gl, 'note', 'bg', 'Задържа влага в изсъхналата боя и ѝ дава гладък, леко лъскав вид.',
     'Задържа влага в изсъхналата боя и обикновено ѝ дава по-гладък, леко лъскав вид.', 'binder.glycerine')
swap(gl, 'note', 'en', 'It holds moisture in the dried paint and gives it a smooth, slightly glossy surface.',
     'It holds moisture in the dried paint and usually gives it a smoother, slightly glossy surface.', 'binder.glycerine')

h = ingredient('watercolour-binder', 'humectant', 1)
swap(h, 'note', 'bg', 'Той е причината засъхналата боя да се събужда веднага под мокра четка, и пази слоя от напукване при съхнене. Може да се пропусне — тогава свързващото е веганско, а боята се разтваря по-бавно.',
     'Обикновено помага засъхналата боя да се разтваря по-лесно под мокра четка и намалява напукването при съхнене; колко, зависи от пигмента и от количеството. Може да се пропусне — тогава свързващото е веганско, а боята може да се разтваря по-бавно.', 'binder.honey')
swap(h, 'note', 'en', 'It is why a dry pan wakes at once under a wet brush, and it keeps the cake from cracking as it dries. It can be left out — the binder is then vegan, and the paint is slower to lift.',
     'It usually helps a dry pan lift more easily under a wet brush and reduces cracking as the paint dries; how much depends on the pigment and the amount. It can be left out — the binder is then vegan, and the paint may be slower to lift.', 'binder.honey')

swap(w, 'notes', 'bg', 'Тази рецепта прави количество, което стига за много бои — малко свързващо върши много работа.\n\nГъстотата се нагласява след това: повече гума на прах я сгъстява, повече свързващо или разреждане със спирт я прави по-течна, към мастило. Затова прахът е задължителен, а не течната гума.',
     'Тази рецепта прави количество, което стига за много бои.\n\nГъстотата на свързващото може да се нагласи след това: още гума на прах го сгъстява. Затова формулата е на прах.', 'watercolour-binder')
swap(w, 'notes', 'en', 'This quantity makes enough for a great many paints — a little goes a long way.\n\nThe thickness is adjusted afterwards: more gum powder thickens it, more binder or thinning with alcohol takes it towards an ink. That is why the powder is required and liquid gum is not.',
     'This quantity makes enough for a great many paints.\n\nThe binder can be thickened afterwards with more gum powder. That is why the formula uses the powder.', 'watercolour-binder')

# ---------------------------------------------------------------- pastel-binder-gum
pg = by['pastel-binder-gum']
swap(pg, 'notes', 'bg', 'Слаб разтвор на гум трагакант или метилцелулоза. Количествата не са записани — рецептата казва „слаб разтвор“ и толкова.',
     'Практическа насока, не прецизна рецепта: слаб разтвор на гум трагакант или метилцелулоза. Концентрация не е посочена — разтворът се прави слаб и се преценява на място.', 'pastel-binder-gum')
swap(pg, 'notes', 'en', 'A weak solution of gum tragacanth or methylcellulose. No quantities are recorded — the recipe says “a weak solution” and no more.',
     'Practical guidance, not a precise recipe: a weak solution of gum tragacanth or methylcellulose. No concentration is given — the solution is made weak and judged at the bench.', 'pastel-binder-gum')

# ---------------------------------------------------------------- deferred: the chalk bath
swap(by['mordant-print-paste']['steps'][7], 'text', 'bg', 'Неутрализирай във варова баня',
     'Неутрализирай в баня с креда (калциев карбонат)', 'mordant-print-paste.mpp-s8')
swap(by['dye-mordant-print-paste']['steps'][5], 'text', 'bg', 'Неутрализирай във варова баня',
     'Неутрализирай в баня с креда (калциев карбонат)', 'dye-mordant-print-paste.dmp-s6')

# ---------------------------------------------------------------- the register
gc = src['michel-garcia']
swap(gc, 'note', 'bg', 'Химик и ботаник, чиито методи за обработка на целулоза със закрепител без нагряване стоят зад голяма част от съвременната практика. ', '', 'michel-garcia')
swap(gc, 'note', 'en', 'A chemist and botanist whose methods for mordanting cellulose without heat lie behind much of current practice. ', '', 'michel-garcia')

st = src['natalie-stopka-pigment']
swap(st, 'note', 'bg', 'По-научно от повечето: носи таблица', 'Носи таблица', 'natalie-stopka-pigment')
swap(st, 'note', 'en', 'More scientific than most: it carries a chart', 'It carries a chart', 'natalie-stopka-pigment')

gr = src['joanne-green-watercolour']
gr['note'] = {
    'bg': 'Книга за правене на акварелни бои от растения и други събрани материали, написана за начинаещи: '
          'малко оборудване, кухненски материали.',
    'en': 'A book on making watercolour paints from plants and other foraged materials, written for beginners: '
          'little equipment, kitchen materials.',
}

r['packVersion'] = '0.18.2'
s['packVersion'] = '15'

# ---------------------------------------------------------------- nothing technical moved
TECH = ('code', 'type', 'output', 'scaleBy', 'appliesTo', 'requiredFollowOn', 'distributable',
        'sourceCodes', 'target')
ING = ('id', 'roleCode', 'basis', 'unit', 'quantity', 'quantityMin', 'quantityMax', 'options')
for old, new in zip(before['recipes'], r['recipes']):
    for k in TECH:
        if old.get(k, '∅') != new.get(k, '∅'):
            sys.exit(f'{old["code"]}.{k} changed')
    if [x.get('id') for x in old['steps']] != [x.get('id') for x in new['steps']]:
        sys.exit(f'{old["code"]}: steps changed')
    for a, b in zip(old['ingredients'], new['ingredients']):
        for k in ING:
            if a.get(k, '∅') != b.get(k, '∅'):
                sys.exit(f'{old["code"]}.{a.get("id", a["roleCode"])}.{k} changed')

save(RECIPES, r)
save(SOURCES, s)
print('stage 3, closing package: six recipes, two deferred edits, three register entries; no technical field moved')

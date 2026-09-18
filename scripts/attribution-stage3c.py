#!/usr/bin/env python3
"""Audit stage 3, the owner's final decisions (1.0.0-rc82).

- watercolour-binder: Green stays; the studio's code comes off until the
  studio's changes are written down (DECISIONS §30a).
- pastel-binder-gum: not tried in the studio (owner, 18 September 2026). The
  studio's code comes off — it was the only thing presenting the method as the
  studio's — „practical guidance" becomes „general guidance", and the note
  says it is untried. No source added, no figure.
- pastel-binder-oat: which form of oat Stopka means is marked unconfirmed, on
  this recipe only. `seed:oats` is not touched.
- aluminium acetate's note: „варова баня" becomes the chalk bath.

`distributable` is NOT set on any record.
"""
import json, copy, sys

def load(p):
    return json.load(open(p, encoding='utf-8'))

def save(p, d):
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')

def swap(obj, key, lang, old, new, where):
    have = obj[key][lang]
    if have.count(old) != 1:
        sys.exit(f'{where}.{key}.{lang}: expected text found {have.count(old)} times — "{old[:60]}"')
    obj[key][lang] = have.replace(old, new)

r = load('seed/recipes.json')
sub = load('seed/substances.json')
before_r = copy.deepcopy(r)
before_s = copy.deepcopy(sub)
by = {x['code']: x for x in r['recipes']}

def expect_codes(code, want):
    if by[code]['sourceCodes'] != want:
        sys.exit(f'{code}: sourceCodes {by[code]["sourceCodes"]}, expected {want}')

# ---------------------------------------------------------------- watercolour binder
expect_codes('watercolour-binder', ['joanne-green-watercolour', 'crafty-place-practice'])
by['watercolour-binder']['sourceCodes'] = ['joanne-green-watercolour']

# ---------------------------------------------------------------- pastel gum binder
expect_codes('pastel-binder-gum', ['crafty-place-practice'])
by['pastel-binder-gum']['sourceCodes'] = []
pg = by['pastel-binder-gum']
swap(pg, 'notes', 'bg', 'Практическа насока, не прецизна рецепта:', 'Обща насока, не прецизна рецепта:', 'pastel-binder-gum')
swap(pg, 'notes', 'en', 'Practical guidance, not a precise recipe:', 'General guidance, not a precise recipe:', 'pastel-binder-gum')
swap(pg, 'notes', 'bg', 'разтворът се прави слаб и се преценява на място.',
     'разтворът се прави слаб и се преценява на място. Насоката не е изпитана в ателието.', 'pastel-binder-gum')
swap(pg, 'notes', 'en', 'the solution is made weak and judged at the bench.',
     'the solution is made weak and judged at the bench. This guidance has not been tried in the studio.',
     'pastel-binder-gum')

# ---------------------------------------------------------------- oat binder
po = by['pastel-binder-oat']
oat = next(i for i in po['ingredients'] if i['id'] == 'pbo-1')
swap(oat, 'note', 'bg', 'Овесени ядки. При Стопка 7.5 г на 240 мл вода.',
     'Овесени ядки. При Стопка 7.5 г на 240 мл вода. Коя форма на овеса има предвид Стопка — люспи, '
     'цели зърна или друга — не е потвърдено.', 'pastel-binder-oat.pbo-1')
swap(oat, 'note', 'en', 'Oat groats. Stopka gives 7.5 g to 240 ml of water.',
     'Oats. Stopka gives 7.5 g to 240 ml of water. Which form of oat she means — rolled, whole groats or '
     'another — has not been confirmed.', 'pastel-binder-oat.pbo-1')
s2 = next(s for s in po['steps'] if s['id'] == 'pbo-s2')
swap(s2, 'text', 'en', 'The groats are discarded', 'The oats are discarded', 'pastel-binder-oat.pbo-s2')

# ---------------------------------------------------------------- aluminium acetate
al = next(x for x in sub['substances'] if x['code'] == 'al_acetate')
swap(al, 'notes', 'bg', 'е нужна варова баня —', 'е нужна баня с креда (калциев карбонат) —', 'al_acetate')

r['packVersion'] = '0.18.3'
sub['packVersion'] = '0.7.6'

# ---------------------------------------------------------------- nothing technical moved
TECH = ('code', 'type', 'output', 'scaleBy', 'appliesTo', 'requiredFollowOn', 'distributable', 'target')
ING = ('id', 'roleCode', 'basis', 'unit', 'quantity', 'quantityMin', 'quantityMax', 'options')
for old, new in zip(before_r['recipes'], r['recipes']):
    for k in TECH:
        if old.get(k, '∅') != new.get(k, '∅'):
            sys.exit(f'{old["code"]}.{k} changed')
    if [x.get('id') for x in old['steps']] != [x.get('id') for x in new['steps']]:
        sys.exit(f'{old["code"]}: steps changed')
    for a, b in zip(old['ingredients'], new['ingredients']):
        for k in ING:
            if a.get(k, '∅') != b.get(k, '∅'):
                sys.exit(f'{old["code"]}.{k} changed')
for old, new in zip(before_s['substances'], sub['substances']):
    for k in set(old) | set(new):
        if k == 'notes' and old['code'] == 'al_acetate':
            continue
        if old.get(k) != new.get(k):
            sys.exit(f'substance {old["code"]}.{k} changed')

save('seed/recipes.json', r)
save('seed/substances.json', sub)
print('stage 3, final decisions: two source lists, two notes, one step, one substance note; no figure moved')

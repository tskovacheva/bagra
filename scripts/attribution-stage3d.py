#!/usr/bin/env python3
"""Audit stage 3, final (1.0.0-rc83).

- mordant-print-paste: the marker is optional and tried first; no promise that
  its colour washes out.
- distributable: true, explicitly, on the four the owner approved.
Nothing else: no figure, no other recipe, pastel-binder-gum untouched.
"""
import json, copy, sys

def swap(obj, key, lang, old, new, where):
    have = obj[key][lang]
    if have.count(old) != 1:
        sys.exit(f'{where}.{key}.{lang}: expected text found {have.count(old)} times')
    obj[key][lang] = have.replace(old, new)

p = 'seed/recipes.json'
r = json.load(open(p, encoding='utf-8'))
before = copy.deepcopy(r)
by = {x['code']: x for x in r['recipes']}
m = by['mordant-print-paste']
mk = next(i for i in m['ingredients'] if i['id'] == 'mpp-5')
swap(mk, 'note', 'bg', 'Капка багрилен екстракт, само за да се вижда къде печаташ — този цвят се отмива и не остава в плата.',
     'По избор: капка багрилен екстракт, за да се вижда къде печаташ. Изпробвай го първо на парче от същия плат — '
     'дали цветът се отмива докрай, зависи от багрилото и от плата.', 'mpp-5')
swap(mk, 'note', 'en', 'A drop of dye extract, only so you can see where you are printing — that colour washes out and is not in the finished cloth.',
     'Optional: a drop of dye extract so you can see where you are printing. Try it first on a scrap of the same '
     'cloth — whether the colour washes out completely depends on the dye and the cloth.', 'mpp-5')
s6 = next(s for s in m['steps'] if s['id'] == 'mpp-s6')
swap(s6, 'text', 'bg', 'Добави капка екстракт, за да виждаш къде печаташ.',
     'По желание добави капка изпробван предварително екстракт, за да виждаш къде печаташ.', 'mpp-s6')
swap(s6, 'text', 'en', 'Add a little extract so you can see where you are printing.',
     'If you wish, add a drop of extract you have tried beforehand, so you can see where you are printing.', 'mpp-s6')

APPROVED = ['mordant-print-paste', 'dye-print-paste', 'dye-mordant-print-paste', 'pastel-binder-oat']
for c in APPROVED:
    if 'distributable' in by[c]:
        sys.exit(f'{c}: distributable already set')
    by[c]['distributable'] = True
if 'distributable' in by['pastel-binder-gum']:
    sys.exit('pastel-binder-gum: must stay untouched')
r['packVersion'] = '0.18.4'

for old, new in zip(before['recipes'], r['recipes']):
    o, n = dict(old), dict(new)
    if old['code'] in APPROVED:
        n.pop('distributable')
    if old['code'] == 'mordant-print-paste':
        o.pop('ingredients'); n.pop('ingredients'); o.pop('steps'); n.pop('steps')
        for a, b in zip(old['ingredients'], new['ingredients']):
            if {k: v for k, v in a.items() if k != 'note'} != {k: v for k, v in b.items() if k != 'note'}:
                sys.exit('mordant-print-paste: an ingredient field other than a note moved')
        if [s['id'] for s in old['steps']] != [s['id'] for s in new['steps']]:
            sys.exit('mordant-print-paste: steps moved')
    if o != n:
        sys.exit(f'{old["code"]}: changed beyond the task')

open(p, 'w', encoding='utf-8').write(json.dumps(r, ensure_ascii=False, indent=1) + '\n')
print('marker made optional; four recipes explicitly distributable; nothing else moved')

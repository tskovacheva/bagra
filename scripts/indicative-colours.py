#!/usr/bin/env python3
"""An indicative colour, taken from the plant's own measurement (§13dl).

Forty-seven eco print combinations were written at rc35 from a review that
describes colour in WORDS and gives no figure, so they carry no `swatchHex`.
Refusing to invent one was right. What followed was not: three releases spent
rearranging how to draw the hole instead of asking whether it had to be there.

It does not, for half of them. Дъб + желязо, вратига + алуминий — the PLANT
record already holds a hex the owner measured under that very mordant. Reusing
it is not invention: same plant, same mordant, her own measurement.

It is also not the same claim as a measured combination, and the difference is
kept in the data rather than in the rendering:

    swatchHex        the colour
    swatchApprox     true when it came from the plant rather than from this
                     combination being measured

The model already has this shape for numbers — `approx` on a temperature, §13ai,
„a number somebody estimated reads as an estimate". A colour is the same kind of
claim and gets the same treatment.

WHAT IS NOT FILLED. A combination whose plant has no measured colour under that
mordant keeps nothing. There is no source for a figure there and a near-enough
one would be exactly the invention this refuses.

Idempotent.
"""
import json, sys, collections

combos_pack = json.load(open('seed/combinations.json'))
plants = {('seed:' + p['code']): p for p in json.load(open('seed/plants.json'))['plants']}

# How the owner writes a mordant in a colour's conditions, against the code the
# combination key uses. Written out rather than matched loosely: „без мордант"
# contains „мордант", so a substring test alone would read no-mordant as alum.
MORDANT_WORDS = {
    'alum_potassium': ['алуминиев мордант', 'стипца', 'алуминий', 'алуминиев ацетат'],
    'alum_acetate':   ['алуминиев ацетат', 'ацетат'],
    'iron':           ['желязо', 'железен'],
    'copper':         ['мед'],
    'none':           ['без мордант', 'немордантиран'],
}


def colour_for(plant, mordant):
    """The plant's own measured colour under this mordant, or nothing."""
    if not plant or not mordant:
        return None
    words = MORDANT_WORDS.get(mordant)
    if not words:
        return None
    for col in plant.get('colours') or []:
        if not col.get('hex'):
            continue
        cond = ((col.get('conditions') or {}).get('bg') or '').lower()
        # „без мордант" first: it contains the word „мордант" and would match the
        # alum list on a plain substring test.
        if mordant != 'none' and any(w in cond for w in MORDANT_WORDS['none']):
            continue
        if any(w in cond for w in words):
            return col
    return None


filled, left, already = 0, [], 0
by_mordant = collections.Counter()

for rec in combos_pack['combinations']:
    exp = rec['expected']
    if exp.get('swatchHex'):
        already += 1
        continue
    key = rec['key']
    col = colour_for(plants.get(key['dyeSource'].get('plantId')), key.get('mordantCode'))
    if not col:
        left.append((rec['code'], key.get('mordantCode')))
        continue
    exp['swatchHex'] = col['hex']
    exp['swatchApprox'] = True
    exp['swatchFrom'] = (col.get('name') or {}).get('bg') or ''
    filled += 1
    by_mordant[key.get('mordantCode')] += 1

if '--apply' in sys.argv:
    combos_pack['packVersion'] = '0.9.0'
    json.dump(combos_pack, open('seed/combinations.json', 'w'), ensure_ascii=False, indent=1)

print(f'ALREADY MEASURED  {already}')
print(f'INDICATIVE        {filled}   taken from the plant under the same mordant')
print(f'STILL NONE        {len(left)}   the plant has no measured colour under that mordant')
print()
for k, n in by_mordant.most_common():
    print(f'  {k:16} {n}')
print()
for code, m in left[:8]:
    print(f'  NONE  {code[:46]:46} {m}')
if len(left) > 8:
    print(f'  … and {len(left) - 8} more')
if '--apply' not in sys.argv:
    print('\n(dry run — pass --apply to write)')

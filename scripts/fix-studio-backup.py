#!/usr/bin/env python3
"""Correct the seven recipes in the studio backup, then write it back out.

Re-runnable: it works towards a described end state, so a second pass over its
own output changes nothing. It touches only what was agreed; anything not named
here is copied through untouched.
"""
import json, sys, pathlib

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1
                   else '/mnt/user-data/uploads/bagra-2026-08-10.json')
OUT = pathlib.Path('/mnt/user-data/outputs/bagra-recepti-popraveni.json')

doc = json.loads(SRC.read_text(encoding='utf-8'))
data = doc['data']
log = []

by_name = {}
for r in data['recipes']:
    by_name[(r.get('name') or {}).get('bg', '')] = r
subs = {(s.get('name') or {}).get('bg', ''): s['id'] for s in data['substances']}
plants = {(p.get('nameCommon') or {}).get('bg', '').lower(): p['id'] for p in data['plants']}


def note(msg):
    log.append(msg)


# 1 ── attribution leaves the record entirely (§13r) -------------------------
stripped = 0
for store, records in data.items():
    if not isinstance(records, list):
        continue
    for rec in records:
        if not isinstance(rec, dict):
            continue
        for field in ('learnedFrom', 'sourceRef'):
            if field in rec:
                del rec[field]
                stripped += 1
if stripped:
    note(f'removed {stripped} per-record attribution fields — they live in Sources now')

# 2 ── redistributable by default -------------------------------------------
# Proportions and sequences are facts. The flag is an opt-out, kept only where a
# record reproduces someone's wording or is a named authored system, and none of
# these seven is either.
flipped = [ (r.get('name') or {}).get('bg') for r in data['recipes']
            if r.get('distributable') is False ]
for r in data['recipes']:
    if r.get('distributable') is False:
        r['distributable'] = True
if flipped:
    note(f'{len(flipped)} recipes were marked not-for-distribution and are now distributable')

# 3 ── the chalk bath needs a default volume ---------------------------------
chalk = by_name.get('Свързваща (карбонатна) баня')
if chalk is not None and not chalk.get('defaultLitres'):
    chalk['defaultLitres'] = 5
    note('chalk bath: default bath volume set to 5 l, so the record shows 50 g '
         'instead of a dash before anything is typed')

# 4 ── a stale note on a chain step ------------------------------------------
for c in data.get('chains', []):
    for st in c.get('steps', []):
        if 'няма пропорции' in (st.get('note') or ''):
            st['note'] = ''
            note('chain: removed the note saying the acetate preparation has no '
                 'proportions — it has them (15–18 %, 90–100 %, 8–10 %)')

# 5 ── the acetate mordant did not say which fibres it is for ----------------
alac = by_name.get('Мордантиране на целулоза с алуминиев ацетат')
if alac is not None and not alac.get('appliesTo'):
    alac['appliesTo'] = ['cellulose']
    note('acetate mordant: applies to cellulose (the ingredient knew; the recipe did not)')

# 6 ── two recipes had no scaling rule ---------------------------------------
for name in ('Фиксиране на целулоза', 'Танинова баня'):
    r = by_name.get(name)
    if r is not None and not r.get('scaleBy'):
        r['scaleBy'] = 'weight'
        note(f'{name}: scaled by the weight of goods')

# 7 ── alum is the raw material, not the finished product --------------------
fix = by_name.get('Фиксиране на целулоза')
if fix is not None:
    for ing in fix.get('ingredients', []):
        if ing.get('basisRefersTo') == 'finished_product':
            ing['basisRefersTo'] = None
            note('cellulose fixing: the alum percentage refers to the alum itself, '
                 'not to a finished product — that basis belongs to the aluminium '
                 'acetate preparation, where the target is the acetate')

# 8 ── the madder bath was a sketch ------------------------------------------
# The role is `dyestuff` and the part is `partCode`: both come from the
# vocabulary, and inventing names for them would have produced a record that
# renders as an untranslated code — exactly the fault of §13e·13.
madder = by_name.get('Багрилна баня с брош')
if madder is not None:
    touched = False
    pid = plants.get('бояджийски брош')
    for ing in madder.get('ingredients', []):
        if not ing.get('roleCode'):
            ing['roleCode'] = 'dyestuff'
            touched = True
        for o in ing.get('options', []):
            if not o.get('substanceId') and not o.get('plantId') and pid:
                o['plantId'] = pid
                touched = True
            if o.get('plantId') and not o.get('partCode'):
                o['partCode'] = 'root'
                touched = True
    if not madder.get('appliesTo'):
        madder['appliesTo'] = ['cellulose']
        touched = True
    if touched:
        note('madder bath: 50–100 % WOF of madder root as the dyestuff — the role '
             'and the material were both empty, so it rendered as a dash')

doc['counts'] = {k: len(v) if isinstance(v, list) else len(v) for k, v in data.items()}
doc['exportedAt'] = doc.get('exportedAt')
OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

print('\n'.join(f'  · {m}' for m in log) if log else '  nothing to change')
print(f'\n  written: {OUT}')

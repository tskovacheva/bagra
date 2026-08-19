#!/usr/bin/env python3
"""Dosing and fastness for the nine plants added in 0.95.0 (§13bb).

They arrived with names, sections, temperatures and a photograph and with these
three fields empty, which was right at the time: a gap recorded is better than a
number invented.

They can be sourced, and here they are — marked `literature`, which is what they
are. **Not** `practice`: nobody in this studio has dyed with elder bark yet, and
the confidence marker is the only thing that will tell the owner, in a year,
which figures came from a book and which from a pot.

The ranges follow the shape the rest of the library already uses: fresh plant
material at roughly twice the dry weight, bark and root at the heavier end
because the colour is in a smaller fraction of the mass, and flowers light.

Colours are deliberately absent. A colour here is a hex beside a condition, and
a hex chosen from a sentence in a book is a guess wearing the costume of a
measurement — it would then sit in the swatch library and answer reverse
searches beside colours that were actually obtained.

Idempotent: a part that already carries dosing is left alone.
"""
import json
import sys

SEED = 'seed/plants.json'

# code -> ( { partCode: [ (condition, min, max) ] }, lightfastness, washfastness )
DATA = {
    'sambucus_nigra': ({
        'leaf':  [('fresh', 200, 400), ('dried', 100, 200)],
        'bark':  [('dried', 100, 200)],
        # The berries stain readily and hold badly — a large dose does not fix
        # that, and pretending otherwise would be the wrong kind of help.
        'fruit': [('fresh', 200, 400)],
    }, 'moderate', 'moderate'),

    'rubus_fruticosus': ({
        'leaf':  [('fresh', 200, 400), ('dried', 100, 200)],
        'bark':  [('dried', 100, 200)],
        'fruit': [('fresh', 200, 400)],
    }, 'poor', 'poor'),

    'dahlia_pinnata': ({
        'flower': [('fresh', 100, 200), ('dried', 50, 100)],
        'leaf':   [('fresh', 200, 300)],
    }, 'moderate', 'moderate'),

    'genista_tinctoria': ({
        # The classic weld-adjacent yellow: flowering tops carry it.
        'flower': [('fresh', 100, 200), ('dried', 50, 100)],
        'leaf':   [('fresh', 150, 300), ('dried', 75, 150)],
    }, 'good', 'good'),

    'alkanna_tinctoria': ({
        # Not water soluble — the part is extracted into alcohol or oil, so the
        # percentage is of the root against the goods, not of a dye bath.
        'root': [('dried', 20, 50)],
    }, 'poor', 'poor'),

    'rheum_rhabarbarum': ({
        'leaf': [('fresh', 100, 200), ('dried', 50, 100)],
        'root': [('dried', 50, 100)],
    }, 'moderate', 'moderate'),

    'fraxinus_excelsior': ({
        'leaf': [('fresh', 200, 400), ('dried', 100, 200)],
        'bark': [('dried', 100, 200)],
    }, 'moderate', 'moderate'),

    'frangula_alnus': ({
        # Bark improves with a year's storage; fresh bark gives harsher yellows.
        'bark':  [('dried', 50, 150)],
        'leaf':  [('fresh', 200, 400)],
        'fruit': [('fresh', 100, 200)],
    }, 'moderate', 'moderate'),

    'pelargonium_zonale': ({
        'flower': [('fresh', 200, 400)],
        'leaf':   [('fresh', 200, 400)],
    }, 'poor', 'poor'),
}


def main():
    apply_changes = '--apply' in sys.argv
    pack = json.load(open(SEED, encoding='utf-8'))
    by_code = {p['code']: p for p in pack['plants']}

    added, missing = 0, []

    for code, (dosing, light, wash) in DATA.items():
        plant = by_code.get(code)
        if not plant:
            missing.append(code)
            continue

        for part in plant.get('parts') or []:
            rows = dosing.get(part['partCode'])
            if not rows or part.get('dosing'):
                continue
            if apply_changes:
                part['dosing'] = [{'condition': c, 'min': lo, 'max': hi} for c, lo, hi in rows]
            added += len(rows)

        conf = plant.setdefault('confidence', {})
        if not plant.get('lightfastness'):
            if apply_changes:
                plant['lightfastness'] = light
                conf['lightfastness'] = 'literature'
            added += 1
        if not plant.get('washfastness'):
            if apply_changes:
                plant['washfastness'] = wash
                conf['washfastness'] = 'literature'
            added += 1
        if apply_changes:
            conf.setdefault('dosing', 'literature')

    print(f'entries written: {added}')
    for m in missing:
        print(f'  no such plant: {m}')

    if apply_changes:
        json.dump(pack, open(SEED, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        open(SEED, 'a', encoding='utf-8').write('\n')
        print(f'\nwritten: {SEED}')
    else:
        print('\ndry run — pass --apply to write')


if __name__ == '__main__':
    main()

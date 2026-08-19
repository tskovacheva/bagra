#!/usr/bin/env python3
"""Move the temperatures from the plant onto the part (§13az).

The audit brought elder back as *листа/кора 70–85; плодове 40–65* and blackberry
the same. That is not bad formatting: **a temperature belongs to the part, not
to the plant**, exactly as WOF dosing does — a correction the owner made herself
long ago. The field was per-plant, so the knowledge escaped into prose.

What this does:

  * every part of a plant inherits the plant's `tempExtractC`, `tempDyeC` and
    `softMaxTempC`, because that is precisely what the old field claimed: one
    temperature for whatever part you happened to use. Nothing is invented; the
    same claim is re-attached where it can now be corrected part by part.
  * `approx` and `confidence` travel with them, so a value that was marked
    approximate does not quietly become exact.
  * the plant keeps nothing. Two homes for one number is how they drift.
  * `extractionMode` is set where the audit said the ordinary schema does not
    apply — woad, Japanese indigo, alkanet, safflower.

Idempotent: a part that already carries a temperature is left alone.
"""
import json
import sys

SEED = 'seed/plants.json'

# What the audit said in prose, as a mode rather than a missing number.
# Safflower's first extraction is cold; the pink that follows is a pH process
# and is not an extraction temperature at all.
MODES = {
    'isatis_tinctoria': 'vat',
    'persicaria_tinctoria': 'vat',
    'alkanna_tinctoria': 'solvent',
    'carthamus_tinctorius': 'cold',
}

FIELDS = ['tempExtractC', 'tempDyeC', 'softMaxTempC']


def main():
    apply_changes = '--apply' in sys.argv
    pack = json.load(open(SEED, encoding='utf-8'))

    moved, modes, empty = 0, 0, []

    for plant in pack['plants']:
        code = plant['code']
        parts = plant.get('parts') or []
        carried = {f: plant.get(f) for f in FIELDS if plant.get(f) not in (None, '', {})}
        # A range with both ends empty is not a value.
        carried = {f: v for f, v in carried.items()
                   if not (isinstance(v, dict) and v.get('min') is None and v.get('max') is None)}

        mode = MODES.get(code)

        if not parts:
            if carried:
                empty.append(f'{code}: has temperatures and no parts to put them on')
            continue

        for part in parts:
            for field, value in carried.items():
                if part.get(field) in (None, '', {}):
                    if apply_changes:
                        part[field] = value
                    moved += 1
            if mode and not part.get('extractionMode'):
                if apply_changes:
                    part['extractionMode'] = mode
                modes += 1
            # The markers follow the numbers they describe.
            for holder in ('approx', 'confidence'):
                src = plant.get(holder) or {}
                keep = {f: src[f] for f in FIELDS if f in src}
                if keep and apply_changes:
                    part[holder] = {**(part.get(holder) or {}), **keep}

        if apply_changes:
            for field in FIELDS:
                plant.pop(field, None)
            for holder in ('approx', 'confidence'):
                if holder in plant:
                    for field in FIELDS:
                        plant[holder].pop(field, None)

    print(f'temperatures moved onto parts: {moved}')
    print(f'parts given an extraction mode: {modes}')
    for e in empty:
        print(f'  {e}')

    if apply_changes:
        json.dump(pack, open(SEED, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        open(SEED, 'a', encoding='utf-8').write('\n')
        print(f'\nwritten: {SEED}')
    else:
        print('\ndry run — pass --apply to write')


if __name__ == '__main__':
    main()

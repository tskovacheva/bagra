#!/usr/bin/env python3
"""`extractionMode` was one name over two different things (§13cc).

Re-runnable: it works towards a described end state, so a second run reports
nothing to change.

WHAT WAS WRONG

The field sat on the part, held ONE value, and was filled for 5 parts of 118.
Look at which five:

    safflower  flower, leaf   cold
    woad       leaf           vat
    Japanese indigo leaf      vat
    alkanet    root           solvent

Not one of them is `decoction`. That is not chance. The field was only ever
filled when the answer was "the ordinary way does not apply here" — nobody
records "I boiled it", because boiling is the default. So in practice the field
already held a CONSTRAINT while being named and shaped as a MODE.

Meanwhile the thing it was named for could not be recorded at all. Stopka gives
madder root 500% by decoction, 300% by fermentation, 50% by alkaline extraction:
one plant, one part, three methods, three doses. A single value on the part can
hold one of the three and makes the other two unsayable.

WHAT THIS SCRIPT DOES

    part.extractionMode  code | null      ->   part.extractionModes  [code] | null

A LIST, because a constraint says which choices exist. Alkanet is `['solvent']` —
only that. Madder is `['decoction', 'fermentation', 'alkaline']` — three, all
real. One value can say neither.

The five existing values become single-item lists. That is the same statement
moved to where it can be added to: `cold` always meant "cold, and not the
ordinary way", which is exactly `['cold']`.

    dosing[]  gains  extractionMode: null

Additive. `null` means "the dose as recorded, without saying by which method",
which is precisely what those 125 rows claim today. Nothing is asserted that was
not asserted before.

WHAT THIS SCRIPT REFUSES TO DO

The 113 parts with no value KEEP no value. The temptation is to write
`['decoction']`, since most parts are simply boiled — but that would turn
"nobody has got to this yet" into "it has been checked, and only boiling works".
A migration that guesses turns an assumption into a fact. Empty stays empty.

`null` and `[]` are also kept apart, and `[]` is never written. They mean
different things — "not stated" against "no method is possible" — and the second
is not true of any part.

Usage:  python3 scripts/migrate-extraction-mode.py
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLANTS = ROOT / 'seed' / 'plants.json'

PACK_VERSION = '0.7.0'

# Read from vocab.js rather than restated: a second copy of a vocabulary is a
# second thing to keep in step, and it drifts.
def known_modes():
    import re
    src = (ROOT / 'vocab.js').read_text(encoding='utf-8')
    return [m.group(1) for m in
            re.finditer(r"V\('extraction_mode',\s*'([a-z_]+)'", src)]


def main():
    modes = known_modes()
    if not modes:
        sys.exit('could not read extraction_mode out of vocab.js')

    data = json.loads(PLANTS.read_text(encoding='utf-8'))
    plants = data['plants']

    moved, already, dosing_touched, parts_seen = 0, 0, 0, 0
    unknown = []

    for p in plants:
        for part in p.get('parts', []):
            parts_seen += 1

            if 'extractionMode' in part:
                old = part.pop('extractionMode')
                if old:
                    if old not in modes:
                        unknown.append(f"{p['code']}.{part.get('partCode')}: {old}")
                    # Only if nothing is there already, so a re-run after a hand
                    # edit does not flatten a list back to one value.
                    if not part.get('extractionModes'):
                        part['extractionModes'] = [old]
                    moved += 1
                elif 'extractionModes' not in part:
                    # An explicit null said nothing; it keeps saying nothing.
                    pass
            elif part.get('extractionModes'):
                already += 1

            if part.get('extractionModes') == []:
                sys.exit(f"{p['code']}.{part.get('partCode')}: empty list — "
                         "„no method is possible\" is not true of any part; use null")

            for d in part.get('dosing') or []:
                if 'extractionMode' not in d:
                    d['extractionMode'] = None
                    dosing_touched += 1

    if unknown:
        sys.exit('mode not in the vocabulary: ' + '; '.join(unknown))

    # Nothing may still carry the old field.
    left = [f"{p['code']}.{part.get('partCode')}"
            for p in plants for part in p.get('parts', [])
            if 'extractionMode' in part]
    if left:
        sys.exit('old field survived on: ' + ', '.join(left))

    with_modes = [(p['code'], part.get('partCode'), part['extractionModes'])
                  for p in plants for part in p.get('parts', [])
                  if part.get('extractionModes')]

    data['packVersion'] = PACK_VERSION
    PLANTS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n',
                      encoding='utf-8')

    print(f'plants pack {PACK_VERSION}: {parts_seen} parts')
    print(f'  moved to a list this run : {moved}')
    print(f'  already a list           : {already}')
    print(f'  dosing rows given the field: {dosing_touched}')
    print(f'  parts carrying a constraint ({len(with_modes)}):')
    for code, part, ms in with_modes:
        print(f'    {code:24} {part:8} {ms}')
    print(f'  parts left unstated      : {parts_seen - len(with_modes)} '
          '(deliberately — empty is not „decoction")')


if __name__ == '__main__':
    main()

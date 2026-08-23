#!/usr/bin/env python3
"""Stopka's dyestuff ratios, onto the dose rows that now have a place for them.

Re-runnable: it works towards a described end state, so a second run reports
nothing to do.

WHY THIS EXISTS

§13cc gave `dosing[]` an `extractionMode`, because one plant and one part do not
have one dose: Stopka gives madder root 500% by decoction and 300% by
fermentation. Until now every one of the 125 rows carried `null` — the dimension
existed and was empty.

SCOPE, AND WHY IT IS NARROW

Only the rows of the chart for plants Багра already holds. That is the natural
intersection and not a way round anything: a published chart is a compilation,
and its selection and arrangement are the author's work even where the individual
figures are facts. Twelve rows, each attributed.

Two of the chart's five columns are left out on the owner's call:

  TINCTURE        alcohol, which is our `solvent` — relevant only for pigment
                  work, and there is no pigment recipe here yet to attach it to.
  ICE MACERATION  not a method Багра records, and adding a vocabulary term to
                  hold two numbers would be the tail wagging the dog.

BUCKTHORN IS DELIBERATELY ABSENT. The chart says „Rhamnus spp." for berry, leaf
and bark. Багра holds three different buckthorns — `rhamnus_cathartica`,
`frangula_alnus` and `rhamnus_tinctoria` — and „spp." does not say which. They
are not the same dye. A guess here would put a dose against the wrong plant, and
a dose is a thing someone weighs out.

HOW IT WRITES

It never overwrites. A row already carrying a figure for the same method is left
alone and reported. Where the part has a dose recorded with NO method — the 125
rows as they stand — the decoction figure is written onto that row rather than
beside it, because an unattributed dose and the decoction dose for the same part
are the same claim, one of them merely vaguer. Fermentation and alkaline always
add a row, since nothing existed to say them.

Usage:  python3 scripts/merge-stopka-ratios.py [--apply]
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLANTS = ROOT / 'seed' / 'plants.json'

PACK_VERSION = '0.10.0'
SOURCE = 'natalie-stopka-pigment'
PAGE = '72–73'

# plant code -> part code -> { method: percent }
# Read from the chart photograph and confirmed by the owner before writing.
RATIOS = {
    'betula_pendula':      {'bark':   {'decoction': 75}},
    'cota_tinctoria':      {'flower': {'decoction': 300}},
    'coreopsis_tinctoria': {'flower': {'decoction': 200}},
    # „Fruit tree bark (apple, pear, cherry, plum)" — one row of the chart
    # covering several trees. Written onto both fruit trees Багра holds, and
    # onto neither anything else: the chart names these species.
    'malus_domestica':     {'bark':   {'decoction': 150, 'alkaline': 80}},
    'prunus_domestica':    {'bark':   {'decoction': 150, 'alkaline': 80}},
    'rubia_tinctorum':     {'root':   {'decoction': 500, 'fermentation': 300}},
    'tagetes_erecta':      {'flower': {'decoction': 200}},
    'allium_cepa':         {'hull':   {'decoction': 120}},
    'rheum_rhabarbarum':   {'root':   {'decoction': 180, 'alkaline': 100}},
    'biancaea_sappan':     {'heartwood': {'decoction': 150, 'alkaline': 75}},
    'cosmos_sulphureus':   {'flower': {'decoction': 200}},
    'tanacetum_vulgare':   {'flower': {'decoction': 200}},
    'reseda_luteola':      {'whole':  {'decoction': 120}},
}

NOTE = {
    'bg': 'Съотношение по таблицата на Натали Стопка, с. ' + PAGE + '. '
          'Дадено е спрямо тежестта на влакното.',
    'en': 'Ratio from Natalie Stopka\'s chart, pp. ' + PAGE + '. '
          'Given against the weight of the fibre.',
}


def main():
    apply = '--apply' in sys.argv
    data = json.loads(PLANTS.read_text(encoding='utf-8'))
    by_code = {p['code']: p for p in data['plants']}

    written, filled_in, kept, problems = [], [], [], []

    for code, parts in RATIOS.items():
        plant = by_code.get(code)
        if not plant:
            problems.append(f'no plant `{code}` — has a code changed?')
            continue

        for part_code, methods in parts.items():
            part = next((x for x in plant.get('parts', [])
                         if x.get('partCode') == part_code), None)
            if part is None:
                problems.append(f'{code}: no part `{part_code}`')
                continue

            allowed = part.get('extractionModes')
            rows = part.setdefault('dosing', [])

            for method, percent in methods.items():
                where = f'{code}.{part_code}.{method}'

                # A dose for a method the part has declared impossible is the
                # fault guard 24 already refuses; catch it here rather than
                # writing it and letting the check find it.
                if allowed and method not in allowed:
                    problems.append(
                        f'{where}: the part permits only {", ".join(allowed)}')
                    continue

                same = next((d for d in rows if d.get('extractionMode') == method), None)
                if same:
                    if same.get('min') != percent:
                        kept.append(f'{where}: has {same.get("min")}%, chart says {percent}%')
                    continue

                # An unattributed dose and the decoction dose for the same part
                # are the same claim, one of them vaguer. Fill it in rather than
                # adding a second row that says the same thing twice.
                vague = next((d for d in rows
                              if not d.get('extractionMode') and method == 'decoction'), None)
                if vague:
                    if vague.get('min') not in (None, percent):
                        kept.append(f'{where}: unattributed row has {vague.get("min")}%, '
                                    f'chart says {percent}%')
                        continue
                    vague['extractionMode'] = method
                    vague['min'] = percent
                    vague['max'] = percent
                    vague.setdefault('sourceCode', SOURCE)
                    vague.setdefault('note', dict(NOTE))
                    filled_in.append(where)
                    continue

                rows.append({
                    'condition': 'dried',
                    'extractionMode': method,
                    'min': percent, 'max': percent,
                    'sourceCode': SOURCE,
                    'note': dict(NOTE),
                })
                written.append(where)

    print(f'Stopka pp. {PAGE} — {len(RATIOS)} plants of the chart that Багра holds')
    print(f'  rows added                : {len(written)}')
    print(f'  unattributed rows named   : {len(filled_in)}')
    if kept:
        print(f'  already recorded and different, left alone ({len(kept)}):')
        for x in kept:
            print(f'    - {x}')

    if problems:
        print(f'\n  {len(problems)} thing(s) this script will not decide:')
        for x in problems:
            print(f'    - {x}')
        sys.exit('stopped: nothing written')

    if not apply:
        print('\n  dry run — pass --apply to write')
        return

    data['packVersion'] = PACK_VERSION
    PLANTS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n',
                      encoding='utf-8')
    print(f'\n  written · pack {PACK_VERSION}')


if __name__ == '__main__':
    main()

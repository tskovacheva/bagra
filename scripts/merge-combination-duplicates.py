#!/usr/bin/env python3
"""Merge three combination duplicates found by deep-check.mjs §24b into their
systematic-code counterparts (1.0.0-rc6, FUNCTIONAL_SPEC.md §13br).

The owner's call: dye strength, not a new key dimension. `dyestuff_ratio`
exists as a band scale (§13bp) but nothing reads a real dye:fibre ratio off a
trial yet, so wiring it into the key would add a dimension no real trial could
reach — a larger piece of work, not needed to close these three.

`variation` already carried real, specific data on two of the three records
being removed — not empty, not a placeholder. The first draft of this script
discarded that data and invented "at a weaker bath" in its place, which was
wrong for madder (the recorded cause was more alkalinity, not less dye) and
unverified for indigo. This version reads the real condition off the record
being removed and writes THAT into `notes`, rather than guessing.

Re-runnable: exits early if the three duplicate codes are already gone.
"""
import json
import collections

PATH = 'seed/combinations.json'

# (canonical code kept, duplicate code removed, which field on the canonical
#  record receives the alternate colour: 'variation' if that field was empty,
#  'notes' if variation already held the condition for the colour in
#  `expected` and must not be overwritten)
MERGES = [
    ('quercus_robur_bark_alum_potassium_plain_immersion',
     'quercus_bark_alum_golden', 'variation'),
    ('rubia_tinctorum_root_alum_potassium_alkaline_immersion',
     'rubia_root_alum_raspberry', 'notes'),
    ('persicaria_tinctoria_leaf_none_plain_immersion',
     'indigo_leaf_soft_blue', 'notes'),
]


def main():
    d = json.load(open(PATH, encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
    combos = d['combinations']
    byc = {c['code']: c for c in combos}

    drop_codes = {dup for _, dup, _ in MERGES}
    if not (drop_codes & byc.keys()):
        print('already merged — nothing to do')
        return

    for keep_code, drop_code, target in MERGES:
        keep = byc[keep_code]
        dup = byc[drop_code]

        colour_bg = dup['expected']['colourText']['bg']
        colour_en = dup['expected']['colourText']['en']
        # The real cause, if the guide recorded one on the record being
        # removed. Falls back to naming the alternate with no invented
        # mechanism — never fabricate a cause the data doesn't carry.
        cause_bg = dup['expected']['variation']['bg']
        cause_en = dup['expected']['variation']['en']

        if cause_bg:
            bg = f"{colour_bg[0].upper()}{colour_bg[1:]} вместо {keep['expected']['colourText']['bg']} — {cause_bg[0].lower()}{cause_bg[1:]}"
            en = f"{colour_en[0].upper()}{colour_en[1:]} rather than {keep['expected']['colourText']['en']} — {cause_en[0].lower()}{cause_en[1:]}"
        else:
            bg = f"При недокументирано условие резултатът клони към {colour_bg} вместо {keep['expected']['colourText']['bg']}."
            en = f"Under an unrecorded condition the result leans toward {colour_en} rather than {keep['expected']['colourText']['en']}."

        dest = keep['expected'] if target == 'variation' else keep
        field = 'variation' if target == 'variation' else 'notes'
        current = dest[field]
        assert current['bg'] == '', (
            f"{keep_code}.{field} is not empty — refusing to overwrite: {current!r}"
        )
        dest[field] = {'bg': bg, 'en': en}

    before = len(combos)
    d['combinations'] = [c for c in combos if c['code'] not in drop_codes]
    after = len(d['combinations'])
    assert before - after == len(MERGES)

    old_version = d['packVersion']
    major, minor, patch = old_version.split('.')
    d['packVersion'] = f"{major}.{int(minor) + 1}.0"

    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')

    print(f"combinations: {before} -> {after}")
    print(f"packVersion: {old_version} -> {d['packVersion']}")


if __name__ == '__main__':
    main()

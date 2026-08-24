#!/usr/bin/env python3
"""Retire `plant.harvestMonths` (§13cn).

Re-runnable: a second run finds nothing to do.

WHY NOW

§13ce superseded the field and said plainly that it would be deleted **one version
later** — as `FabricStateEvent` was (§13bd) — so that the new per-part answers
could be checked against real records first. That was rc16. It is rc25, and the
field is still on 44 plants.

The condition it set has been met and then some:

  * all 118 parts answer, either with months or with `sourcedNotGathered`;
  * the seasonal panel's fallback to the plant-level list is reached **zero
    times in every month of the year**;
  * the owner has had the per-part data in front of her since rc16.

Leaving it any longer is how a field stops being superseded and starts being a
second source of truth that nobody remembers to update.

WHAT THIS REMOVES, AND WHAT IT LEAVES

Removes `harvestMonths` from the plant record. Leaves everything on the part
untouched.

It does NOT remove `windowOf`'s fallback in `modules/season.js`. That is a
separate edit, made by hand, because the fallback becomes live again the moment a
plant is added without per-part months — which the library expansion will do — and
deleting it would turn a graceful degradation into a plant that silently never
appears in the panel.

Usage:  python3 scripts/retire-plant-harvest-months.py [--apply]
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLANTS = ROOT / 'seed' / 'plants.json'
PACK_VERSION = '0.11.0'


def main():
    apply = '--apply' in sys.argv
    data = json.loads(PLANTS.read_text(encoding='utf-8'))
    plants = data['plants']

    carrying = [p['code'] for p in plants if 'harvestMonths' in p]

    # The condition §13ce set, checked rather than assumed. A part that answers
    # neither way would lose its months with nothing to replace them, and the
    # plant would drop out of the seasonal panel in silence.
    silent = [f"{p['code']}.{x.get('partCode')}"
              for p in plants for x in p.get('parts', [])
              if not (x.get('harvestMonths') or x.get('sourcedNotGathered'))]
    if silent:
        sys.exit('these parts answer neither way — retiring now would lose them: '
                 + ', '.join(silent))

    for p in plants:
        p.pop('harvestMonths', None)

    left = [p['code'] for p in plants if 'harvestMonths' in p]
    if left:
        sys.exit('the field survived on: ' + ', '.join(left))

    answered = sum(1 for p in plants for x in p.get('parts', [])
                   if x.get('harvestMonths') or x.get('sourcedNotGathered'))
    total = sum(len(p.get('parts', [])) for p in plants)

    print(f'plant.harvestMonths: removed from {len(carrying)} records')
    print(f'  every part still answers: {answered}/{total}')
    print(f'  harvestRegion on the pack: {data.get("harvestRegion")}')

    if not apply:
        print('\n  dry run — pass --apply to write')
        return

    data['packVersion'] = PACK_VERSION
    PLANTS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n',
                      encoding='utf-8')
    print(f'\n  written · pack {PACK_VERSION}')


if __name__ == '__main__':
    main()

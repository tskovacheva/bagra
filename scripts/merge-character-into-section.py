#!/usr/bin/env python3
"""„Как се държи" existed twice, and one of them goes (§13cg).

Re-runnable: it works towards a described end state, so a second run reports
nothing to do.

WHAT WAS WRONG

`character` was introduced as a FIELD in §13m — dye temperament, the thing a
plant does in the pot — on the grounds that what must be present on every plant
is a field rather than a section. Then §13ay admitted a SECTION with the heading
„Как се държи", on the grounds that observed behaviour reads as prose.

Both were reasonable and nobody noticed they carried the same name. Fourteen
records showed the heading twice, and the field looked almost empty — 14 of 57 —
because the section had quietly taken over its work on all 57. Adding the new
general description (§13ce) put a third prose block on the record, two of them
identically titled, which is what forced the decision.

THE SECTION STAYS. It is filled on all 57 against the field's 14, and the newer
argument is the better one: dye temperament is not a fixed set of facts with a
shape, it is a paragraph.

WHAT THIS DOES

Where a plant has both, the field's text is appended to the section rather than
discarded — it is the owner's own writing and the two say different things on
some records. Appended with a blank line between, never merged into a sentence:
this script does not compose prose.

Where a plant has the field and no section, the field BECOMES the section, so
nothing is lost and the heading appears where it always should have.

`character` is then removed from every record.

WHAT IT DOES NOT DO

It does not touch `description` (§13ce) or any other section. It does not
translate: where the field carried English and the section did not, the English
is appended to the English and the mismatch is reported rather than papered over.

Usage:  python3 scripts/merge-character-into-section.py [--apply]
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLANTS = ROOT / 'seed' / 'plants.json'

PACK_VERSION = '0.9.0'
HEADING = {'bg': 'Как се държи', 'en': 'How it behaves'}


def txt(pair, lang):
    return ((pair or {}).get(lang) or '').strip()


def main():
    apply = '--apply' in sys.argv
    data = json.loads(PLANTS.read_text(encoding='utf-8'))
    plants = data['plants']

    appended, promoted, dropped, empty_field = [], [], [], []
    problems = []

    for p in plants:
        field = p.get('character')
        has_field = bool(txt(field, 'bg') or txt(field, 'en'))

        section = next((s for s in p.get('sections', [])
                        if txt(s.get('title'), 'bg') == HEADING['bg']), None)

        if not has_field:
            if 'character' in p:
                empty_field.append(p['code'])
            p.pop('character', None)
            continue

        if section is None:
            # The field becomes the section. Its position matters: the sections
            # have an order the owner set, and behaviour belongs where the
            # other records keep it rather than at the end.
            order = [txt(s.get('title'), 'bg') for s in p.get('sections', [])]
            at = order.index('Багрилна съставка') + 1 if 'Багрилна съставка' in order \
                else len(order)
            p.setdefault('sections', []).insert(at, {
                'title': dict(HEADING),
                'body': {'bg': txt(field, 'bg'), 'en': txt(field, 'en')},
            })
            promoted.append(p['code'])
        else:
            for lang in ('bg', 'en'):
                add = txt(field, lang)
                if not add:
                    continue
                have = txt(section.get('body'), lang)
                if add in have:
                    # Already said. A re-run, or the owner having copied one into
                    # the other by hand.
                    continue
                if not have:
                    problems.append(
                        f'{p["code"]}: the section has no {lang.upper()} text but the '
                        f'field does — appending would leave the languages saying '
                        f'different things')
                    continue
                # Blank line, never merged into a sentence. This script does not
                # compose prose.
                section['body'][lang] = have + '\n\n' + add
                if p['code'] not in appended:
                    appended.append(p['code'])

        p.pop('character', None)
        dropped.append(p['code'])

    left = [p['code'] for p in plants if 'character' in p]
    if left:
        problems.append('character survived on: ' + ', '.join(left))

    print(f'plants: {len(plants)}')
    print(f'  field appended to an existing section : {len(appended)}')
    print(f'  field promoted to a new section       : {len(promoted)}'
          + (f'  ({", ".join(promoted)})' if promoted else ''))
    print(f'  empty field simply removed            : {len(empty_field)}')
    print(f'  `character` removed from              : {len(dropped)} records with text')

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

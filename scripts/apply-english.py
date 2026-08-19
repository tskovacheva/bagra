#!/usr/bin/env python3
"""Fill the English side of the plant library (§13bc).

Two of the six sections need no translator:

  * **Източници** is a list of citations and URLs. A citation is not translated —
    the author's name and the page title are what they are. Copied verbatim.
  * **Използвани части** is a list of part names, and the vocabulary already
    holds each one in both languages. Rendered from the codes rather than
    translated from the prose, so the section and the `parts` array cannot
    disagree.

The remaining four are prose and are translated by hand, delivered in batches as
JSON: `{ "<code>": { "<bg section title>": "<english>" } }`.

Nothing is overwritten: a section that already has English is left alone, so a
batch can be re-run and batches cannot clobber each other.
"""
import json
import sys
from pathlib import Path

SEED = Path('seed/plants.json')
VOCAB = Path('vocab.js')

MECHANICAL = {'Източници', 'Използвани части'}


def part_names_en():
    """The English part names, read from the vocabulary rather than restated."""
    import re
    text = VOCAB.read_text(encoding='utf-8')
    out = {}
    for m in re.finditer(r"V\('plant_part',\s*'([a-z]+)',\s*'([^']*)',\s*'([^']*)'", text):
        out[m.group(1)] = m.group(3)
    return out


def main():
    apply_changes = '--apply' in sys.argv
    batches = [a for a in sys.argv[1:] if not a.startswith('--')]

    translations = {}
    for path in batches:
        for code, sections in json.loads(Path(path).read_text(encoding='utf-8')).items():
            translations.setdefault(code, {}).update(sections)

    pack = json.loads(SEED.read_text(encoding='utf-8'))
    english = part_names_en()
    filled, skipped, unknown = 0, 0, []

    for plant in pack['plants']:
        code = plant['code']
        mine = translations.get(code, {})

        for section in plant.get('sections') or []:
            title = (section.get('title') or {}).get('bg')
            body = section.setdefault('body', {})
            if body.get('en', '').strip():
                continue

            if title == 'Източници':
                value = body.get('bg', '')
            elif title == 'Използвани части':
                value = ' · '.join(english.get(p['partCode'], p['partCode'])
                                   for p in plant.get('parts') or [])
            else:
                value = mine.get(title)
                if not value:
                    skipped += 1
                    continue

            if apply_changes:
                body['en'] = value
            filled += 1

        for title in mine:
            if not any((s.get('title') or {}).get('bg') == title
                       for s in plant.get('sections') or []):
                unknown.append(f'{code}: no section „{title}"')

    remaining = sum(1 for p in pack['plants'] for s in p.get('sections') or []
                    if (s.get('body') or {}).get('bg')
                    and not (s.get('body') or {}).get('en', '').strip()
                    and (s.get('title') or {}).get('bg') not in MECHANICAL)

    print(f'sections filled: {filled}')
    print(f'still waiting on a translator: {skipped}')
    for u in unknown:
        print(f'  {u}')

    if apply_changes:
        SEED.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        left = remaining - (filled - skipped if False else 0)
        print(f'\nwritten: {SEED}')
        done = sum(1 for p in pack['plants'] for s in p.get('sections') or []
                   if (s.get('body') or {}).get('en', '').strip())
        total = sum(1 for p in pack['plants'] for s in p.get('sections') or [])
        print(f'english: {done} of {total} sections')
    else:
        print('\ndry run — pass --apply to write')


if __name__ == '__main__':
    main()

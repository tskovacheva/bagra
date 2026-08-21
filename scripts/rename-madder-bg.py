#!/usr/bin/env python3
"""„Марена" is not the Bulgarian word for madder — „брош" is (§13cb).

Re-runnable: it replaces a fixed set of phrases and reports how many it found,
so a second run finds none and changes nothing.

„Марена" is a loan from the Russian „марена красильная".  The plant record has
always been right — `rubia_tinctorum` is „Бояджийски брош" — but the prose
written around it drifted into the loan word, in the glossary, in a recipe note,
in a technique description and in the pH tab.  A bilingual reference that calls
one plant two names in Bulgarian teaches the wrong one.

ENGLISH IS UNTOUCHED.  `madder` is correct English and is also the palette colour
in the code.  Only the Bulgarian prose is corrected, which is why the
replacements below are all Cyrillic.

WHY A FIXED LIST RATHER THAN A REGULAR EXPRESSION over „марен-".  Bulgarian
inflects: „марената", „мареновите".  A pattern broad enough to catch those would
also reach `марля` (gauze, a real fabric structure in vocab.js) if it were
loosened by one character, and the substituted grammar would have to be guessed.
Each phrase here was read in place and its replacement written for that sentence.
A phrase that is no longer present is reported, not silently skipped, because a
disappearance means the sentence was rewritten elsewhere and this file has fallen
out of date.
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# file -> [(what is there now, what it should say)]
EDITS = {
    'seed/recipes.json': [
        ('марена 500%', 'брош 500%'),
    ],
    'seed/techniques.json': [
        ('при мареновите и антрахиноновите багрила',
         'при брошовите и антрахиноновите багрила'),
    ],
    'i18n.js': [
        ('марената иска алкално за истинско червено',
         'брошът дава по-чисто червено в неутрална до умерено алкална среда'),
    ],
}

# `seed/glossary.json` is not listed: `edit-glossary.py` rewrites all four of its
# affected definitions in full and they already say „брош".  Naming it here as
# well would give two scripts an opinion about one sentence.
ALSO_CHECK = ['seed/glossary.json']


def main():
    total = 0
    stale = []

    for rel, pairs in EDITS.items():
        path = ROOT / rel
        text = path.read_text(encoding='utf-8')
        before = text
        for old, new in pairs:
            n = text.count(old)
            if n == 0 and new not in text:
                stale.append(f'{rel}: „{old}" not found and not already replaced')
            total += n
            text = text.replace(old, new)
        if text != before:
            path.write_text(text, encoding='utf-8')
            print(f'  {rel}: rewritten')
        else:
            print(f'  {rel}: already correct')

    if stale:
        for s in stale:
            print(f'STALE: {s}', file=sys.stderr)
        sys.exit('a phrase this script edits has changed underneath it')

    # Nothing anywhere may still carry the loan word in Bulgarian prose.
    left = []
    for rel in list(EDITS) + ALSO_CHECK:
        text = (ROOT / rel).read_text(encoding='utf-8')
        for stem in ('Марена', 'марена', 'Марената', 'марената', 'маренов', 'Маренов'):
            if stem in text:
                left.append(f'{rel}: {stem}')
    if left:
        sys.exit('„марена" still present: ' + ', '.join(left))

    print(f'madder: {total} phrase(s) corrected; „марена" gone from all four files')


if __name__ == '__main__':
    main()

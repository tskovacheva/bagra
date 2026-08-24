#!/usr/bin/env python3
"""Put `FUNCTIONAL_SPEC.md` in order, without renumbering anything (§13cm).

Re-runnable: it sorts towards a described arrangement, so a second run is a no-op.

WHY NOTHING IS RENUMBERED

The code cites section numbers 443 times across 93 distinct sections — `§13bd`
alone appears 49 times, `§11b` 32, `§13q` 28. Renumbering would invalidate all of
them at once and in silence: the comments would still read plausibly and point at
the wrong decision. The identifiers are part of the interface between the code and
this document, and they are fixed.

So this moves sections; it never renames one, and it never edits a word inside one.

WHAT WAS ACTUALLY WRONG

Not the numbering. The file grew by appending, and three things drifted:

  * §14 (architecture), §15 (visual identity) and §16 (open questions) had ended
    up in the MIDDLE, at line 6135, with twenty-seven later sections after them.
    Anyone reading to the end passed the closing chapters two-thirds of the way
    through and then carried on through another thousand lines.
  * §13j and §13k sat before §13a; §13u sat after §13z.
  * §13.2a sat between the data model and the decision record, belonging to
    neither.

WHAT IT PRODUCES

Six parts, and a contents list grouped BY SUBJECT rather than by number, because
the question a reader has is „what does this say about Fabrics", and the answer is
spread over nine sections that are nowhere near each other.

    I    The product          §1, §2, §12, §15
    II   The modules          §3 – §11b
    III  The data model       §13, §13.2a
    IV   Architecture         §14
    V    Decisions and faults §13a – §13cl, in order
    VI   Open questions       §16

Part V is the largest and is the most valuable thing in the document: it is the
record of what was got wrong and how it was found. It stays in chronological
order, because that is what it is — a record — and reading it by theme would hide
that several of the same fault recurred months apart.

Usage:  python3 scripts/order-spec.py [--apply]
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / 'FUNCTIONAL_SPEC.md'

HEADING = re.compile(r'^## (\S+?)\.?\s', re.M)
PART_HEAD = re.compile(r'^# Part ', re.M)
CONTENTS_MARK = '### How to read this'

PARTS = [
    ('I. The product', "What this is for, what it is not, and what it looks like.",
     ['1', '2', '12', '15']),
    ('II. The modules', "One section per module, in the order the sidebar shows them.",
     ['3', '4', '5', '6', '7', '8', '9', '10', '11', '11a', '11b']),
    ('III. The data model', "Every store, every field, and what each one may hold.",
     ['13', '13.2a']),
    ('IV. Architecture', "How it is built and how it is released.",
     ['14']),
    ('V. Decisions, and the faults that produced them',
     "In the order they happened. This is the largest part of the document and the "
     "most useful: it records what was got wrong, how it was found, and what stops "
     "it coming back. Read chronologically — several faults recurred months apart, "
     "and grouping them by subject would hide that.",
     None),          # everything else, in sequence order
    ('VI. Open questions', "Decisions not yet taken.", ['16']),
]

# The subject index. A section may appear under more than one heading — that is
# the point of it. Built by hand: a generated index would key on words in the
# title, and half these titles are about the FAULT rather than the subject
# („Работа, която сочи към никакъв плат" is a Trials section).
SUBJECTS = [
    ('Plants and the plant library',
     ['4', '13g', '13h', '13i', '13m', '13at', '13aw', '13ay', '13az', '13ba',
      '13bp', '13cc', '13cd', '13ce', '13cg']),
    ('Combinations and the reference engine',
     ['7', '13l', '13t', '13aj', '13bq', '13br', '13ck', '13cl']),
    ('Fabrics, and preparing the cloth',
     ['13al', '13am', '13an', '13av', '13bd', '13bj', '13bl', '13bm', '13bn']),
    ('Trials and the dyeing workflow',
     ['8', '13ag', '13ao', '13ap', '13ar', '13au', '13y', '13bf', '13bi']),
    ('Group actions', ['13bd', '13bh']),
    ('Recipes and chains', ['5', '13ak', '13aq', '13v', '13ca']),
    ('Techniques', ['6', '13w']),
    ('Materials, substances and stock', ['3', '11b', '13bs']),
    ('Pigments', ['13bv', '13bx', '13by', '13bz']),
    ('The Library — glossary, pH, sources', ['9', '13r', '13bt', '13bu', '13cb']),
    ('Calculators and tools', ['13af', '13ak', '13bs']),
    ('The home screen', ['13u', '13cd', '13cf', '13ch']),
    ('Navigation and addresses', ['11a', '13q', '13ad', '13ab']),
    ('The interface — rules that bind every screen',
     ['13s', '13k', '13ac', '13o', '13n', '13bg', '13bo', '13bb']),
    ('The phone', ['13aa', '13ae', '13cg']),
    ('Language, terminology and translation', ['13bc', '13cb', '13cj']),
    ('Backup, restore and the update path', ['13a', '13x', '13f']),
    ('Reference packs and distribution', ['10', '13ab', '13bw', '13cb']),
    ('Checks, and faults that hid from them', ['13e', '13d', '13p', '13ci']),
    ('Search and filtering', ['13j', '13aj', '13cd']),
]


def split(text):
    """-> (preamble, [(id, whole section text)]) with nothing dropped."""
    marks = [(m.start(), m.group(1)) for m in HEADING.finditer(text)]
    if not marks:
        sys.exit('no sections found — has the heading style changed?')
    preamble = text[:marks[0][0]]
    out = []
    for i, (pos, sid) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        out.append((sid, text[pos:end]))
    return preamble, out


def sort_key(sid):
    """Sequence order for the decision record: 13a, 13b … 13z, 13aa, 13ab …"""
    m = re.fullmatch(r'13([a-z]*)', sid)
    if not m:
        return (0, 0, sid)
    suffix = m.group(1)
    return (1, len(suffix), suffix)


def main():
    apply = '--apply' in sys.argv
    text = SPEC.read_text(encoding='utf-8')
    preamble, sections = split(text)

    # A part heading is `# Part …` — one hash, so `split` does not see it and it
    # stays inside the chunk of the section above. Stripped HERE, on the way in,
    # not only in the verification: the first version cut it for comparison and
    # kept it in the stored text, so every run re-emitted the previous run's
    # headings and „# Part VI" appeared four times before anyone looked.
    # Stripping on input is also what makes the script idempotent.
    sections = [(sid, PART_HEAD.split(chunk)[0].rstrip() + '\n')
                for sid, chunk in sections]
    by_id = dict(sections)

    if len(by_id) != len(sections):
        seen, dupes = set(), []
        for sid, _ in sections:
            if sid in seen:
                dupes.append(sid)
            seen.add(sid)
        sys.exit('duplicate section numbers: ' + ', '.join(dupes))

    named = {sid for _, _, ids in PARTS if ids for sid in ids}
    rest = sorted((sid for sid in by_id if sid not in named), key=sort_key)

    missing = [sid for _, _, ids in PARTS if ids for sid in ids if sid not in by_id]
    if missing:
        sys.exit('a part names a section that is not here: ' + ', '.join(missing))

    bad_index = sorted({sid for _, ids in SUBJECTS for sid in ids if sid not in by_id})
    if bad_index:
        sys.exit('the index names a section that is not here: ' + ', '.join(bad_index))

    # ---- contents
    # `###`, not `##`. The heading pattern — and `check.sh`'s section guard —
    # read `## ` as the start of a numbered section, so a contents heading at
    # that level would enter the document as two new sections called „How" and
    # „By". The first run of this script caught it by refusing to write.
    # A previously generated contents block sits in the preamble — it holds no
    # `## ` heading, so `split` leaves it there — and re-emitting it doubled the
    # whole thing on the second run. Cut at its own marker, which is what makes
    # this the third and last thing standing between the script and a document
    # that grows every time it is tidied.
    head = preamble.split(CONTENTS_MARK)[0].rstrip().removesuffix('---').rstrip()

    lines = [head, '', '---', '', CONTENTS_MARK,
             '',
             'Six parts. **Section numbers are never reused and never renumbered** — the '
             'code cites them 443 times, and a number that moved would leave every one of '
             'those comments pointing at the wrong decision, plausibly and in silence.',
             '',
             'The numbering is therefore historical rather than positional: §13cl follows '
             '§13ck because it was decided later, not because it sits below it. Read by '
             'part, or by the subject index.',
             '']

    for title, blurb, ids in PARTS:
        use = ids if ids else rest
        lines.append(f'#### Part {title}')
        lines.append('')
        lines.append(blurb)
        lines.append('')
        if ids:
            for sid in use:
                head = by_id[sid].splitlines()[0].removeprefix('## ').strip()
                lines.append(f'- {head}')
        else:
            lines.append(f'{len(use)} sections, §{use[0]} to §{use[-1]}. '
                         'Listed by subject below rather than one by one.')
        lines.append('')

    lines += ['---', '', '### By subject', '',
              'A section may appear under more than one heading; that is what the index is '
              'for. Several titles name the FAULT rather than the subject — „Работа, която '
              'сочи към никакъв плат" is a Trials section — so this is written by hand and '
              'is worth keeping so.', '']
    for subject, ids in SUBJECTS:
        lines.append(f'**{subject}** — ' + ' · '.join('§' + s for s in ids))
        lines.append('')

    body = []
    for title, _, ids in PARTS:
        use = ids if ids else rest
        # No `---` before the part heading. It would land INSIDE the previous
        # section's text, and the verification below — which is the only thing
        # standing between this script and a silent edit — would be comparing a
        # section against itself plus a rule. Caught by that verification on the
        # second run.
        body.append(f'\n# Part {title}\n')
        for sid in use:
            body.append(by_id[sid].rstrip() + '\n')

    new = '\n'.join(lines).rstrip() + '\n' + '\n'.join(body).rstrip() + '\n'

    # Nothing may be lost. The set of headings and the length of every section
    # body must be identical — this script moves text and never edits it.
    # A part heading is `# Part …` — one hash, so the section pattern does not
    # see it, and it lands inside the chunk of the section above. That is only a
    # problem for THIS comparison, not for the document, so it is cut here
    # rather than by loosening the pattern: a looser pattern would start finding
    # sections that are not sections, which is how the contents list nearly
    # entered the document as two of them a moment ago.
    cut = lambda c: PART_HEAD.split(c)[0].rstrip()

    _, after = split(new)
    if {s for s, _ in after} != set(by_id):
        lost = set(by_id) - {s for s, _ in after}
        gained = {s for s, _ in after} - set(by_id)
        sys.exit(f'sections did not survive — lost: {sorted(lost)}, '
                 f'appeared: {sorted(gained)}')
    for sid, chunk in after:
        if cut(chunk) != cut(by_id[sid]):
            sys.exit(f'§{sid} changed while being moved')

    print(f'{len(by_id)} sections, none renamed, none edited')
    for title, _, ids in PARTS:
        print(f'  Part {title.split(".")[0]:4} {len(ids if ids else rest):3} sections')
    print(f'  subject index: {len(SUBJECTS)} headings')

    if not apply:
        print('\n  dry run — pass --apply to write')
        return
    SPEC.write_text(new, encoding='utf-8')
    print('\n  written')


if __name__ == '__main__':
    main()

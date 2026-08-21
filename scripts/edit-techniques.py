#!/usr/bin/env python3
"""Two edits to `seed/techniques.json` that belong with the glossary work (§13cb).

Re-runnable: it works towards a described end state, so a second run changes
nothing.

1.  HAPA-ZOME ARRIVES.  It left the glossary because it is a technique and not a
    word — but the Techniques module did not have it, so removing it from the
    glossary alone would have deleted it from the application.  That is why this
    script and `edit-glossary.py` are a pair and run in the same session.

    Category `printing`, not `bundling`: nothing is rolled and nothing is bound.
    The plant is struck through the cloth and its own juice makes the mark, which
    is contact printing by impact.  `appliesTo: ['ecoprint']` because it is the
    same family of work even though no bath and no steam are involved.

    The description says plainly that the result is usually fugitive.  A
    technique that looks spectacular and fades is exactly the kind of thing a
    reference has to state, and the new glossary term `fugitive` gives the word
    for it.

2.  `overdye` IS RENAMED IN BULGARIAN.  It was „Наслагване"; the glossary now
    holds the same idea as „Повторно багрене", and one thing carrying two
    Bulgarian names on two screens is how a reference stops being trusted.

    The code is untouched — codes never change once published, because they
    travel inside reference packs (vocab.js, header).  Only the label moves, so
    nothing that already references this technique is orphaned.

    What the old name carried and the new one does not: „наслагване" said that
    the second colour LAYERS OVER the first, distinguishing it from running the
    same bath again for greater depth.  The description now carries that
    distinction in its first sentences, since the title no longer does.
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TECHNIQUES = ROOT / 'seed' / 'techniques.json'

PACK_VERSION = '0.2.0'

HAPA_ZOME = {
    'code': 'hapa_zome',
    'name': {'bg': 'Хапа-зоме', 'en': 'Hapa-zome'},
    'category': 'printing',
    'appliesTo': ['ecoprint'],
    'description': {
        'bg': 'Листа и цветове се полагат върху плата, покриват се и се чукат с чук '
              'или камък, докато сокът им премине в тъканта. Отпечатъкът излиза '
              'веднага и е много точен — вижда се всяка жилка. Цветът обаче е '
              'самият сок на растението, не извлечено и свързано багрило, затова '
              'обикновено е нетраен: избледнява за седмици и се измива. Мордантът и '
              'последваща желязна баня го задържат отчасти.',
        'en': 'Leaves and flowers are laid on the cloth, covered, and struck with a '
              'hammer or a stone until their juice passes into the textile. The print '
              'appears at once and is very precise — every vein shows. The colour, '
              'though, is the plant sap itself rather than an extracted and bound dye, '
              'so it is usually fugitive: it fades within weeks and washes out. A '
              'mordant and an iron afterbath hold it back in part.',
    },
}

RETITLE_BG = {
    'overdye': 'Повторно багрене',
}

REDESCRIBE = {
    'overdye': {
        'bg': 'Второ багрене върху вече обагрен плат, за да се получи цвят, който '
              'едно багрене не дава — жълто под синьо дава зелено, каквото почти '
              'никое растение не дава направо. Различава се от повтарянето на същата '
              'баня за по-наситен резултат: тук второто багрило ляга върху първия '
              'цвят. Редът има значение и по-светлото отива първо.',
        'en': 'A second dyeing over cloth that is already dyed, to reach a colour a '
              'single dyeing does not give — yellow under blue gives the green almost '
              'no plant gives directly. It differs from repeating the same bath for '
              'greater depth: here the second dye settles over the first colour. Order '
              'matters, and the lighter colour goes first.',
    },
}


def main():
    data = json.loads(TECHNIQUES.read_text(encoding='utf-8'))
    techniques = data['techniques']
    by_code = {t['code']: t for t in techniques}

    categories = sorted({t['category'] for t in techniques} | {HAPA_ZOME['category']})
    if HAPA_ZOME['category'] not in categories:
        sys.exit(f"unknown category: {HAPA_ZOME['category']}")

    if HAPA_ZOME['code'] in by_code:
        by_code[HAPA_ZOME['code']].update(HAPA_ZOME)
        note = 'refreshed'
    else:
        techniques.append(dict(HAPA_ZOME))
        by_code[HAPA_ZOME['code']] = techniques[-1]
        note = 'added'

    for code, bg in RETITLE_BG.items():
        if code not in by_code:
            sys.exit(f'retitle names a technique that is not here: {code}')
        by_code[code]['name']['bg'] = bg

    for code, text in REDESCRIBE.items():
        if code not in by_code:
            sys.exit(f'redescription names a technique that is not here: {code}')
        by_code[code]['description'] = dict(text)

    data['packVersion'] = PACK_VERSION
    TECHNIQUES.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    print(f'techniques: {len(techniques)} records, pack {PACK_VERSION}')
    print(f"  hapa_zome {note} in category {HAPA_ZOME['category']}")
    print(f"  overdye renamed to „{RETITLE_BG['overdye']}\" (code unchanged)")


if __name__ == '__main__':
    main()

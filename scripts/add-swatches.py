#!/usr/bin/env python3
"""Add colour swatches to the nine plants that had none, and normalise the
source on the 132 that already had some (§13be).

Idempotent: a plant that already carries swatches for a source is left alone, so
running this twice does not double them.

Two things this script is careful about, because both are rules the library has
already set for itself.

  * The hex values are INFERRED FROM DESCRIPTIONS, not measured. Every one is
    written as `literature` confidence. None is `own_trial`. A hex read out of a
    sentence is a guess wearing the costume of a measurement, and the confidence
    field is what keeps it honest.

  * Every swatch cites a source that is IN THE REGISTER, by code. The existing
    132 carry the register's name as prose; they are normalised to the code in
    the same pass, which is a one-value mapping and not a guess.

The fruit swatches for elder and blackberry are anthocyanin and do not last.
Eight purely anthocyanin plants were removed from the library rather than kept
as warnings. These two stay because the leaf and bark are worth having — the
fugitive part is marked in the plant's prose, which is where the owner decided
it belongs, and NOT on the swatch.
"""

import json, sys, pathlib

SEED = pathlib.Path(__file__).resolve().parent.parent / 'seed' / 'plants.json'

# code -> list of swatches.
#
# `process` is 'immersion' or 'ecoprint'. It is left off only where the process
# genuinely was not recorded, which is nowhere below — these were all researched
# as one or the other.
#
# `partCode` must be a part the plant actually carries; the script checks.
SWATCHES = {

    # Genista tinctoria — the historical European yellow. Strong with alum,
    # shifting olive with iron. CAMEO describes it as a strong yellow dye;
    # Nature's Rainbow gives around 70 °C and notes slight alkalinity deepens it.
    'genista_tinctoria': [
        ('#E4C94D', 'лимонено жълто', 'lemon yellow', 'алуминиев мордант', 'aluminium mordant', 'immersion', 'flower', 'natures-rainbow'),
        ('#D2AC32', 'златисто жълто', 'golden yellow', 'алуминиев мордант, по-концентрирана баня', 'aluminium mordant, a stronger bath', 'immersion', 'flower', 'cameo-mfa'),
        ('#AD8C2E', 'охра', 'ochre', 'без мордант или изтощена баня', 'unmordanted, or an exhausted bath', 'immersion', 'leaf', 'natures-rainbow'),
        ('#77723E', 'маслинено', 'olive', 'с железни соли', 'with iron salts', 'immersion', 'leaf', 'natures-rainbow'),
    ],

    # Alkanna tinctoria — the colourant is not water-soluble and is extracted
    # with alcohol first. Maiwa gives grey, lavender and purple on mordanted
    # fibre, and greys to grey-violet with iron. Bright magenta belongs to the
    # extract, not to the cloth, so it is not among the swatches.
    'alkanna_tinctoria': [
        ('#B49AB5', 'лавандулово', 'lavender', 'алкохолен извлек, мордантирано влакно', 'alcohol extract, mordanted fibre', 'immersion', 'root', 'maiwa'),
        ('#907493', 'приглушено виолетово', 'muted violet', 'алкохолен извлек, протеиново влакно', 'alcohol extract, protein fibre', 'immersion', 'root', 'maiwa'),
        ('#746878', 'сиво-виолетово', 'grey-violet', 'с железни соли', 'with iron salts', 'immersion', 'root', 'maiwa'),
        ('#777478', 'приглушено сиво', 'muted grey', 'слаба баня', 'a weak bath', 'immersion', 'root', 'maiwa'),
    ],

    # Sambucus nigra — the part matters more here than almost anywhere. Leaf and
    # bark give the yellow-greens and olives; the fruit gives an anthocyanin
    # pink-violet that will not last.
    'sambucus_nigra': [
        ('#A69B55', 'жълто-зелено', 'yellow-green', 'алуминиев мордант', 'aluminium mordant', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#737246', 'маслинено', 'olive', 'с железни соли', 'with iron salts', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#8A7A5C', 'бежово-кафяво', 'beige-brown', 'кора, алуминиев мордант', 'bark, aluminium mordant', 'immersion', 'bark', 'crafty-place-guide'),
        ('#A26F84', 'розово-лилаво', 'pink-violet', 'плод, студена или хладка баня', 'fruit, a cold or barely warm bath', 'immersion', 'fruit', 'crafty-place-guide'),
        ('#786579', 'сиво-виолетово', 'grey-violet', 'плод, с желязо или алкално', 'fruit, with iron or alkaline', 'immersion', 'fruit', 'crafty-place-guide'),
        ('#6E6B4A', 'маслинен отпечатък', 'olive print', 'лист върху мордантиран плат', 'leaf on mordanted cloth', 'ecoprint', 'leaf', 'crafty-place-guide'),
        ('#4A4A44', 'сив до тъмносив контур', 'grey to dark grey outline', 'лист с желязно одеало', 'leaf against an iron blanket', 'ecoprint', 'leaf', 'crafty-place-guide'),
    ],

    # Dahlia — the flower's own colour does not predict the cloth. Different
    # cultivars give different results, which is why the palette is the typical
    # one rather than everything that has been reported.
    'dahlia_pinnata': [
        ('#D0A33F', 'златисто', 'gold', 'алуминиев мордант', 'aluminium mordant', 'immersion', 'flower', 'crafty-place-guide'),
        ('#B4823E', 'охра', 'ochre', 'по-концентрирана баня', 'a stronger bath', 'immersion', 'flower', 'crafty-place-guide'),
        ('#7C7843', 'маслинено', 'olive', 'с железни соли', 'with iron salts', 'immersion', 'flower', 'crafty-place-guide'),
        ('#676044', 'бронзово-зелено', 'bronze-green', 'листа, с желязо', 'leaves, with iron', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#9A8340', 'жълто-охрен отпечатък', 'yellow-ochre print', 'съцветие върху мордантиран плат', 'flower head on mordanted cloth', 'ecoprint', 'flower', 'crafty-place-guide'),
    ],

    # Frangula alnus — bark gives yellow to gold from a plain decoction. The
    # reds are real but historical and need aged or fermented bark; a swatch
    # without that condition beside it would promise something a simple bath
    # does not give.
    'frangula_alnus': [
        ('#D1A849', 'топло жълто', 'warm yellow', 'кора, обикновена отвара', 'bark, a plain decoction', 'immersion', 'bark', 'cameo-mfa'),
        ('#BE8738', 'златисто', 'gold', 'кора, алуминиев мордант', 'bark, aluminium mordant', 'immersion', 'bark', 'cameo-mfa'),
        ('#A25D39', 'ръждиво', 'rust', 'отлежала или ферментирала кора', 'aged or fermented bark', 'immersion', 'bark', 'cameo-mfa'),
        ('#774638', 'червеникаво-кафяво', 'reddish brown', 'отлежала кора, алкална обработка', 'aged bark, alkaline treatment', 'immersion', 'bark', 'cameo-mfa'),
    ],

    # Rubus fruticosus — leaves and stems carry the tannin and are the reliable
    # half; the fruit is the fugitive one.
    'rubus_fruticosus': [
        ('#C1AA6B', 'жълто-бежово', 'yellow-beige', 'листа, алуминиев мордант', 'leaves, aluminium mordant', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#7D794C', 'маслинено', 'olive', 'листа, с железни соли', 'leaves, with iron salts', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#686763', 'сиво', 'grey', 'таниново влакно с желязо', 'tannin-rich fibre with iron', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#806576', 'приглушено виолетово', 'muted violet', 'плод, хладка баня', 'fruit, a barely warm bath', 'immersion', 'fruit', 'crafty-place-guide'),
        ('#5B5A4C', 'тъмен маслинен контур', 'dark olive outline', 'лист с желязно одеало', 'leaf against an iron blanket', 'ecoprint', 'leaf', 'crafty-place-guide'),
    ],

    # Pelargonium — the clearest case for the whole change. Soft yellow through
    # olive in a bath; grey to near-black in a print with iron.
    'pelargonium_zonale': [
        ('#C6B76D', 'меко жълто', 'soft yellow', 'листа, алуминиев мордант', 'leaves, aluminium mordant', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#9B995D', 'жълто-зелено', 'yellow-green', 'листа, прясна баня', 'leaves, a fresh bath', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#74764C', 'маслинено', 'olive', 'с железни соли', 'with iron salts', 'immersion', 'leaf', 'crafty-place-guide'),
        ('#8E7A5E', 'топло бежово', 'warm beige', 'цветове', 'flowers', 'immersion', 'flower', 'crafty-place-guide'),
        ('#6E7059', 'сиво-зелен отпечатък', 'grey-green print', 'лист върху мордантиран плат', 'leaf on mordanted cloth', 'ecoprint', 'leaf', 'crafty-place-guide'),
        ('#3E3F3B', 'тъмносиво до почти черно', 'dark grey to near black', 'лист с желязно одеало', 'leaf against an iron blanket', 'ecoprint', 'leaf', 'crafty-place-guide'),
    ],

    # Rheum — the root is the dye part. Asian species are stronger than the
    # garden rhubarb this record describes, so the palette stays on the golds
    # rather than promising the deep red-yellows of R. emodi. The leaf is not a
    # dye part here: it is an oxalate assistant, and it is toxic to eat.
    'rheum_rhabarbarum': [
        ('#D1AC46', 'златисто жълто', 'golden yellow', 'корен, алуминиев мордант', 'root, aluminium mordant', 'immersion', 'root', 'cameo-mfa'),
        ('#B99A46', 'горчично', 'mustard', 'корен, по-концентрирана баня', 'root, a stronger bath', 'immersion', 'root', 'cameo-mfa'),
        ('#AC743B', 'охра', 'ochre', 'корен, алкална баня', 'root, an alkaline bath', 'immersion', 'root', 'cameo-mfa'),
        ('#895C3E', 'оранжево-кафяво', 'orange-brown', 'корен, с железни соли', 'root, with iron salts', 'immersion', 'root', 'cameo-mfa'),
    ],

    # Fraxinus excelsior — a quercetin-rich beige-olive from the bark. Other
    # shades appear in the historical record; the palette stays with the one
    # that is documented rather than including a rare blue as if it were typical.
    'fraxinus_excelsior': [
        ('#C1A66C', 'бежово', 'beige', 'кора, воден извлек', 'bark, a water extract', 'immersion', 'bark', 'cameo-mfa'),
        ('#B4934F', 'златисто-бежово', 'golden beige', 'кора, алуминиев мордант', 'bark, aluminium mordant', 'immersion', 'bark', 'cameo-mfa'),
        ('#817C4E', 'маслинено', 'olive', 'с железни соли', 'with iron salts', 'immersion', 'bark', 'cameo-mfa'),
        ('#686A59', 'сиво-маслинено', 'grey-olive', 'листа, с желязо', 'leaves, with iron', 'immersion', 'leaf', 'cameo-mfa'),
        ('#77754F', 'маслинен отпечатък', 'olive print', 'лист върху мордантиран плат', 'leaf on mordanted cloth', 'ecoprint', 'leaf', 'crafty-place-guide'),
    ],
}

OLD_SOURCE = 'НАТУРАЛНИ БАГРИЛА, Crafty Place'
NEW_SOURCE = 'crafty-place-guide'


def main():
    data = json.loads(SEED.read_text(encoding='utf-8'))
    plants = data['plants']
    by_code = {p['code']: p for p in plants}

    problems, added, normalised = [], 0, 0

    for code, rows in SWATCHES.items():
        p = by_code.get(code)
        if not p:
            problems.append(f'{code}: no such plant')
            continue
        parts = {x['partCode'] for x in p.get('parts', [])}
        for row in rows:
            if row[6] not in parts:
                problems.append(f'{code}: swatch part {row[6]!r} is not a part of the plant {sorted(parts)}')

    if problems:
        print('\n'.join(problems)); sys.exit(1)

    for code, rows in SWATCHES.items():
        p = by_code[code]
        if p.get('colours'):
            continue                      # already done; run again safely
        p['colours'] = [{
            'hex': hex_,
            'name': {'bg': bg, 'en': en},
            'conditions': {'bg': cbg, 'en': cen},
            'process': process,
            'partCode': part,
            'source': source,
            # Inferred from a description, never measured. This is the field
            # that keeps the distinction visible on the screen.
            'confidence': 'literature',
        } for hex_, bg, en, cbg, cen, process, part, source in rows]
        added += len(rows)

    for p in plants:
        for c in p.get('colours', []):
            if c.get('source') == OLD_SOURCE:
                c['source'] = NEW_SOURCE
                normalised += 1

    data['packVersion'] = '0.6.0'
    SEED.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    with_colours = sum(1 for p in plants if p.get('colours'))
    total = sum(len(p.get('colours', [])) for p in plants)
    print(f'added {added} swatches, normalised {normalised} source strings')
    print(f'{with_colours} of {len(plants)} plants carry swatches, {total} in all')


if __name__ == '__main__':
    main()

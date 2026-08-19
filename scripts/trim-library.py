#!/usr/bin/env python3
"""Bring the seeded plant library to five sections and no exceptions.

Re-runnable: it works from the current state of seed/plants.json towards a
described end state rather than applying a diff, so running it twice leaves the
same file. Nothing here depends on having been run before.

What it does, and why:

1.  Four gardening sections leave the app.  Propagation, husbandry, care and
    pests answer a different question from the one the app is for, and they
    exist on seven plants out of forty-eight.  Seven of forty-eight is not a
    section, it is a leftover.  The texts are written out to an archive first.

2.  The "Рецепта" section leaves the app.  Its numbers already sit in the
    plant's own fields, which the record shows directly above the prose —
    dosing per part and condition, extraction and dye temperature, the ceiling.
    A second copy in prose is a copy that drifts, and on four plants it already
    had.

3.  `character` — "Как се държи" / "How it behaves" — arrives as a field.  It
    carries what the numbers cannot say: the pitfalls, the order of work, the
    one thing that ruins the bath.  A field rather than a section, because a
    section that must exist on every plant is not a section.

4.  Two dosing corrections, where the field contradicted the owner's own guide:
    Japanese indigo is worked fresh, not dried; sumac leaf at 10–20% is a
    tannin dose, not a dye dose.
"""

import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'seed' / 'plants.json'
ARCHIVE = ROOT / 'scripts' / 'removed-sections.md'

# Headings that leave. Matched on the Bulgarian title, trimmed and lowered, with
# a parenthetical dropped — "Агротехника (отглеждане)" and "Агротехника" are one
# heading, and the seed carries both spellings.
DROP = {
    'агротехника', 'отглеждане', 'размножаване', 'грижи и поддръжка', 'грижи',
    'вредители и болести', 'рецепта',
}

def key(title_bg: str) -> str:
    t = (title_bg or '').split('(')[0]
    return t.strip().lower()

# Approved by the owner, taken from the salvage workbook verbatim.
CHARACTER = {
 'бреза': ('Кората се взима паднала или обелена, никога от живо дърво. Кисне 12–24 часа преди варене — без това дава малко. Банята става по-силна, ако престои няколко часа преди багрене.',
   'Bark is taken fallen or peeled, never from a living tree. It soaks 12–24 hours before boiling — without that it gives little. The bath grows stronger if it stands a few hours before dyeing.'),
 'кориопсис': ('Цветните глави се накисват половин час преди загряване. Може да се багри с цветовете вътре или прецедено. Бърка се плавно, иначе прави петна; цветът се стабилизира един-два дни след сушене на сянка.',
   'The flower heads soak for half an hour before heating. It can be dyed with the flowers left in or strained off. Stir gently or it blotches; the colour settles a day or two after drying in the shade.'),
 'смрадлика': ('Листата и кората са две различни бани: листата дават жълто за час, кората иска накисване през нощта и по-дълго варене. Силно танинова — багри и без стипца, и е отлична основа за надбагряне със синьо.',
   'Leaves and bark are two different baths: the leaves give yellow within the hour, the bark wants an overnight soak and longer boiling. Strongly tannic — it dyes without alum, and makes an excellent ground for overdyeing with blue.'),
 'жълт кантарион': ('Отдава багрилото си бавно — банята иска да престои няколко часа или през нощта. Само връхните цветни части дават чисто жълто.',
   'It gives up its dye slowly — the bath wants to stand for a few hours or overnight. Only the flowering tops give a clean yellow.'),
 'багрилна сърпица': ('Не се вари. Листата се заливат с гореща вода, банята се охлажда и оттам температурата е критична — над 55 °C се поврежда. Влакното влиза бавно, без да се вкарва въздух; тъмното идва от повторни потапяния, не от по-дълго стоене.',
   'It is not boiled. The leaves are covered with hot water, the bath is cooled, and from there the temperature is critical — above 55 °C it is spoiled. The fibre enters slowly, without carrying air in; depth comes from repeated dips, not from standing longer.'),
 'орех': ('Самофиксиращ се — работи и без стипца. Обвивките се варят цял час и масата може да остане в банята.',
   'Self-mordanting — it works without alum. The hulls boil for a full hour and the matter can stay in the bath.'),
 'ябълка': ('Кората иска накисване през нощта — това променя добива силно. Листата отиват към жълто, кората към бежово и земно.',
   'The bark wants an overnight soak — it changes the yield considerably. Leaves go towards yellow, bark towards beige and earth.'),
 'дъб': ('Кората кисне 12–24 часа преди варене. Жълъдите и шапчиците се смачкват леко и дават по-топло, ръждиво. Силно танинов; стипцата изважда чист златист тон.',
   'The bark soaks 12–24 hours before boiling. Acorns and cups are lightly crushed and give a warmer, rustier tone. Strongly tannic; alum brings out a clean gold.'),
 'жълта резеда': ('Накисва се в топла вода един час преди загряване. Прецедено дава най-чистото жълто, с растителната маса вътре — по-дълбоко. Оставя се да изстине в банята.',
   'It soaks in warm water for an hour before heating. Strained it gives the cleanest yellow; with the plant matter left in, it goes deeper. It is left to cool in the bath.'),
 'руй': ('Листата и плодчетата са две различни бани: листата към жълто и маслинено, плодчетата се стриват леко и дават по-топло, златисто. Дълъг престой усилва медения тон. Като танин, а не като багрило, листата се използват в много по-ниска доза — около 10–20%.',
   'Leaves and berries are two different baths: the leaves towards yellow and olive, the berries lightly crushed for a warmer gold. A long stand deepens the honeyed tone. Used as a tannin rather than as a dye, the leaves go in at a far lower dose — around 10–20%.'),
 'розмарин': ('Дървените части заедно с листата дават по-зеленикав тон, отколкото само листна маса. Банята потъмнява, ако престои през нощта.',
   'Woody parts together with the leaves give a greener tone than leaf alone. The bath darkens if it stands overnight.'),
 'бояджийски брош': ('Не бива да прехвърля тавана — над него червеното отива към тухлено и кафяво. След изключване платът може да престои в банята до денонощие за по-дълбок цвят.',
   'It must not pass the ceiling — above it the red turns brick and brown. Once the heat is off the cloth can stand in the bath for up to a day for a deeper colour.'),
 'тагетис': ('Цветовете се варят и банята се прецежда след охлаждане. Колкото повече цвят, толкова по-наситено. Платът може да престои в банята до денонощие.',
   'The flowers are boiled and the bath strained once it has cooled. The more flower, the deeper the colour. The cloth can stand in the bath for up to a day.'),
 'Японско индиго': ('Багри се от хладна баня, не от вряла. Цветът се ражда от въздуха след изваждане, затова тъмното идва от повторни потапяния.',
   'It dyes from a cool bath, not a boiling one. The colour is born from the air after lifting, so depth comes from repeated dips.'),
}

# (plant, part) -> the dosing list it should end with.
DOSING_FIX = {
    # The guide is explicit that the leaves are worked fresh and that drying
    # costs dye strength; the field carried dried only, and no fresh row at all.
    ('Японско индиго', 'leaf'): [
        {'condition': 'fresh', 'min': 300, 'max': 500},
        {'condition': 'dried', 'min': 100, 'max': 200},
    ],
    # 10–20% is a tannin dose. As a dye the guide gives 50–80% dried. The dosing
    # row has no dimension for purpose, so the tannin figure lives in the
    # character text rather than as a second, identically labelled row.
    ('руй', 'leaf'): [
        {'condition': 'dried', 'min': 50, 'max': 80},
    ],
}


def main():
    data = json.loads(SEED.read_text(encoding='utf-8'))
    plants = data['plants']

    removed, log = [], []

    for p in plants:
        name = p['nameCommon']['bg']

        keep, gone = [], []
        for s in p.get('sections') or []:
            (gone if key(s.get('title', {}).get('bg', '')) in DROP else keep).append(s)
        if gone:
            removed.append((name, gone))
            log.append(f'  − {name}: ' + ', '.join(s['title']['bg'] for s in gone))
        p['sections'] = keep

        # Present on every plant, empty where nothing is written yet, so the
        # field is part of the shape rather than something a few plants have.
        text = CHARACTER.get(name)
        p['character'] = {'bg': text[0], 'en': text[1]} if text else {'bg': '', 'en': ''}

        for part in p.get('parts') or []:
            fix = DOSING_FIX.get((name, part.get('partCode')))
            if fix and part.get('dosing') != fix:
                log.append(f'  ~ {name} / {part["partCode"]}: {part.get("dosing")} → {fix}')
                part['dosing'] = [dict(d) for d in fix]

    if removed:
        out = ['# Sections removed from the seeded library',
               '',
               'Written out by `scripts/trim-library.py` before deletion. These texts',
               'answer gardening questions rather than dyeing ones, and existed on seven',
               'plants out of forty-eight. They are kept here so nothing written is lost.',
               '']
        for name, secs in removed:
            out.append(f'## {name}')
            out.append('')
            for s in secs:
                out.append(f'### {s["title"]["bg"]}')
                out.append('')
                out.append(s['body'].get('bg', ''))
                out.append('')
        ARCHIVE.write_text('\n'.join(out), encoding='utf-8')

    SEED.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    print('\n'.join(log) if log else '  nothing to change — already trimmed')
    print()
    titles = {}
    for p in plants:
        for s in p.get('sections') or []:
            titles[s['title']['bg']] = titles.get(s['title']['bg'], 0) + 1
    for k, v in sorted(titles.items(), key=lambda x: -x[1]):
        mark = 'ok' if v == len(plants) else f'{len(plants) - v} missing'
        print(f'  {v:3}/{len(plants)}  {k:26} {mark}')
    withchar = sum(1 for p in plants if (p.get('character') or {}).get('bg'))
    print(f'\n  character written on {withchar}/{len(plants)}')
    if ARCHIVE.exists():
        print(f'  archive: {ARCHIVE.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

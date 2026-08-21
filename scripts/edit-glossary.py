#!/usr/bin/env python3
"""Bring `seed/glossary.json` to the shape the owner's review describes (§13cb).

Re-runnable: it works from the current state of the file towards a described end
state rather than applying a diff, so running it twice leaves the same file.

The review that drives this is the owner's own, and its governing principle is
that a word earns a place only if a person will meet it in a book, a recipe or a
community, and its meaning is not obvious from the word itself.  A term does NOT
earn a place merely by existing as a chemical concept or as a category in the
model.

WHAT THIS DOES, AND WHY

1.  Five terms leave.

    `affinity` and `buffer` are valid chemistry and too low-level for the use
    they get here; neither is attached to any workflow the application has.

    `hapa_zome` is a technique, not a word.  The application has a Techniques
    module and that is where it belongs — so `edit-techniques.py` adds it there
    in the same session.  Removing it from here alone would delete it from the
    application, which is why the two scripts are a pair.

    `bundling` is the same case: `bundle_roll`, `bundle_fold` and
    `barrier_layer` are already techniques with their own descriptions.

    `discharge` leaves because the method itself does not exist yet.  A glossary
    entry for a practice the application cannot record is a promise the screens
    do not keep.  It returns with the method — recorded in ROADMAP.md, not lost.

2.  Six Bulgarian titles change.  These were labelling faults, not entries that
    had failed to earn their place: three of them read as removable ONLY because
    the title was poor.  "Дообработка" can mean anything done after dyeing;
    "Кроки" is an English technical term transliterated into a Bulgarian word
    that carries no sense; "Одеяло" alone is too general to say which cloth.

3.  Seven terms are rewritten in substance, not in style.  Each had a sentence
    that was true of one dye and stated as a rule — the mordant/modifier
    difference given as timing alone, tannin ground given as though cellulose
    always requires it, pH given as though madder always wants alkaline.  A
    reference that overstates is worse than one that says less.

4.  Seven terms are added.  Six of them are more basic than anything the
    glossary held: the difference between a plant and the dye compound in it, a
    dye bath, eco print itself, re-dyeing, a fugitive dye, colourfastness as the
    parent of the three kinds, and water hardness.

5.  Every term is regrouped into the eight groups a reader would look under —
    basics, textile preparation, dyeing, eco print, indigo, pigment, colour
    chemistry, fastness — replacing six groups named after the model.

6.  The English is edited as English.  The Bulgarian prose here is the owner's
    own voice and the English had been following it phrase by phrase, which
    produced constructions that read as translated rather than written: a dye
    that "takes to" a fibre, "the reds that last", madder that "wants" alkaline
    water.  In a bilingual reference the English is a second original.

NOT DONE HERE, DELIBERATELY

`madder` in English stays `madder`, which is correct English.  The Bulgarian
"марена" is a loan from Russian and the Bulgarian word is „брош"; that runs
through four files and is `rename-madder-bg.py`.
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GLOSSARY = ROOT / 'seed' / 'glossary.json'
SOURCES = ROOT / 'seed' / 'sources.json'

PACK_VERSION = '0.2.0'

# The eight groups, in the order a reader is walked through them: what a dye is,
# how the cloth is prepared, how it is dyed, the two processes with rules of
# their own, and only then the chemistry and the fastness.  The old six were
# named after the model — `chemistry`, `process`, `fabric`, `ph`, `ecoprint`,
# `fastness` — which is a listing of where a term came from, not where a person
# would look for it.
GROUPS = [
    'basics', 'textile_prep', 'dyeing', 'ecoprint',
    'indigo', 'pigment', 'colour_chemistry', 'fastness',
]

REMOVE = ['affinity', 'buffer', 'hapa_zome', 'bundling', 'discharge']

# code -> group.  Every surviving and every new term is named here, so a term
# added later without a group fails the run rather than landing in a default.
GROUP_OF = {
    'natural_dye': 'basics',
    'dye_bath': 'basics',
    'wof': 'basics',
    'ph': 'basics',

    'cellulose_protein': 'textile_prep',
    'scouring': 'textile_prep',
    'tannin_ground': 'textile_prep',
    'mordant': 'textile_prep',

    'extraction': 'dyeing',
    'substantive_adjective': 'dyeing',
    'modifier': 'dyeing',
    'afterbath': 'dyeing',
    'overdye': 'dyeing',
    'exhaust': 'dyeing',
    'water_hardness': 'dyeing',

    'ecoprint': 'ecoprint',
    'blanket': 'ecoprint',
    'resist': 'ecoprint',

    'indigoid': 'indigo',
    'reduction_oxidation': 'indigo',

    'lake_pigment': 'pigment',
    'woa': 'pigment',

    'tannin': 'colour_chemistry',
    'tannin_kinds': 'colour_chemistry',
    'anthocyanin': 'colour_chemistry',
    'flavonoid': 'colour_chemistry',
    'anthraquinone': 'colour_chemistry',

    'colourfastness': 'fastness',
    'lightfastness': 'fastness',
    'washfastness': 'fastness',
    'crocking': 'fastness',
    'fugitive': 'fastness',
}

# Bulgarian titles only.  The English name already lives in `term.en` and in the
# aliases, which the search reads — but the aliases cannot be seen on the card,
# and a reader who knows the word from a book needs to recognise the card as the
# right one.  So the English is kept in the title where it is the word actually
# met in practice and Bulgarian has no settled equivalent.
RETITLE = {
    'afterbath': 'Последваща баня (afterbath)',
    'blanket': 'Багрилно одеяло (blanket)',
    'crocking': 'Устойчивост на триене (crocking)',
    'scouring': 'Предварително почистване (scouring)',
    'tannin_kinds': 'Видове танини',
}

# Substance, not style.  Each of these had a sentence that was true of one dye
# and written as a rule.
REDEFINE = {
    'mordant': {
        'bg': 'Мордантът е металната сол — най-често алуминиева — която подпомага '
              'свързването на багрилото с влакното. Байцването е самото действие: '
              'тъканта се обработва с него преди или по време на багренето. '
              'Мордантът не само задържа цвета, а често го и променя: едно и също '
              'багрило дава различен цвят със стипца, с желязо и с мед — не нюанс, '
              'а друг цвят.',
        'en': 'A mordant is a metal salt — most often an aluminium one — that helps '
              'the dye bind to the fibre. Mordanting is the act itself: the cloth is '
              'treated with it before or during dyeing. A mordant does more than hold '
              'the colour; it commonly changes it. The same dye yields a different '
              'colour with alum, with iron and with copper — not a shade of one '
              'colour but a different one.',
    },
    'modifier': {
        'bg': 'Вещество, което се използва основно за промяна на вече получен цвят — '
              'желязо за потъмняване, мед за преместване към зелено, киселина или '
              'основа за преместване по скалата. Разликата с морданта не е само във '
              'времето: някои вещества, като железните соли, изпълняват и двете роли '
              'според това кога и как се прилагат — желязото преди багренето действа '
              'като мордант, същото желязо след него като модификатор, и двете дават '
              'различен резултат.',
        'en': 'A substance used mainly to alter a colour already obtained — iron to '
              'darken, copper to shift towards green, acid or alkali to move along '
              'the scale. The difference from a mordant is not timing alone: some '
              'substances, iron salts among them, fill either role depending on when '
              'and how they are applied. Iron before dyeing behaves as a mordant, the '
              'same iron afterwards as a modifier, and the two give different results.',
    },
    'afterbath': {
        'bg': 'Кратка баня след багренето, в която парчето получава модификатор. '
              'Обикновено е студена или хладка и трае минути, не часове. Парчето не '
              'сменя състоянието си — то си остава боядисано, само носи вече и '
              'промяната.',
        'en': 'A short bath after dyeing in which the piece receives a modifier. '
              'Usually cool or lukewarm, and a matter of minutes rather than hours. '
              'The piece does not change state — it remains dyed and simply carries '
              'the shift as well.',
    },
    'scouring': {
        'bg': 'Основното почистване на влакното преди мордантиране и багрене. '
              'Премахва естествени и производствени остатъци — масла, восъци, апрет — '
              'както и омекотител и препарат от предишно пране. Всичко това пречи и '
              'води до петна и неравномерност, които изглеждат като провал на самото '
              'багрене. При целулозните влакна обикновено е алкално изпиране или '
              'изваряване и е по-интензивно от обикновено пране; протеиновите се '
              'третират по-меко.',
        'en': 'The main cleaning of the fibre before mordanting and dyeing. It removes '
              'natural and manufacturing residues — oils, waxes, sizing — along with '
              'softener and detergent from earlier laundering. All of it interferes, '
              'producing the patches and unevenness that read as a failure of the '
              'dyeing itself. On cellulose it is usually an alkaline wash or a boil, '
              'more intensive than ordinary laundering; protein fibres are treated '
              'more gently.',
    },
    'tannin_ground': {
        'bg': 'Предварителна обработка с танин, използвана най-вече при целулозни '
              'влакна като памук и лен. Танинът може да подобри свързването на '
              'последващия метален мордант и често увеличава наситеността и '
              'устойчивостта на цвета. Не е необходима във всяка рецепта — подходът '
              'зависи от морданта и багрилото; алуминиевият ацетат например се '
              'използва като директен мордант за целулоза. Изборът на танин влияе и '
              'върху основата: галовият оставя най-светла, кондензираният — по-топла '
              'и по-тъмна.',
        'en': 'A tannin pre-treatment, used mainly on cellulose fibres such as cotton '
              'and linen. Tannin can improve the binding of the metal mordant applied '
              'after it, and often increases depth and fastness. It is not required by '
              'every recipe — the approach depends on the mordant and the dye, and '
              'aluminium acetate, for one, is used as a direct mordant on cellulose. '
              'The choice of tannin also affects the ground: gallotannin leaves it '
              'lightest, condensed tannin warmer and darker.',
    },
    'ph': {
        'bg': 'Скалата от 1 до 14: под 7 е кисело, 7 е неутрално, над 7 е алкално. pH '
              'може значително да промени оттенъка и поведението на някои багрила. '
              'Антоцианините реагират особено силно; брошът често дава по-чисти '
              'червени тонове в неутрална до умерено алкална среда; много от жълтите '
              'реагират слабо. Реакцията е различна за всяко багрило, затова pH не '
              'бива да се използва като универсална рецепта за промяна на цвета.',
        'en': 'The scale from 1 to 14: below 7 is acid, 7 is neutral, above 7 is '
              'alkaline. pH can markedly change both the hue and the behaviour of some '
              'dyes. Anthocyanins respond especially strongly; madder often gives '
              'cleaner reds in neutral to mildly alkaline conditions; many yellows '
              'respond little. The response differs from dye to dye, so pH should not '
              'be treated as a general method for changing colour.',
    },
    'anthraquinone': {
        'bg': 'Група багрилни съединения, свързани с едни от най-трайните естествени '
              'червени. Срещат се например в броша и кошенилата. За разлика от много '
              'антоцианинови цветове антрахиноновите багрила обикновено имат добра '
              'устойчивост — античният текстил, оцелял с цвят, най-често е боядисан с '
              'тях. При броша температурата, pH и минералният състав на водата силно '
              'влияят върху оттенъка; прекомерното нагряване измества чистото червено '
              'към тухлени и кафеникави тонове.',
        'en': 'A group of dye compounds behind some of the most durable natural reds. '
              'They occur in madder and cochineal, among others. Unlike many '
              'anthocyanin colours, anthraquinone dyes generally have good fastness — '
              'ancient textiles that survive with their colour are most often dyed '
              'with them. With madder, temperature, pH and the mineral content of the '
              'water all affect the hue strongly; excessive heat shifts a clear red '
              'towards brick and brown.',
    },
    'blanket': {
        'bg': 'Допълнителен слой плат, който се навива заедно с основната тъкан при '
              'еко принт. Може да бъде напоен с багрилна баня, с желязо или с друг '
              'разтвор и предава цвят или модификатор към основния плат по време на '
              'обработката. Самото одеяло също често получава интересен отпечатък и '
              'може да се използва повторно. Един вързоп дава два резултата.',
        'en': 'An additional layer of cloth rolled up with the main textile in eco '
              'print. It may be soaked in a dye bath, in iron or in another solution, '
              'and passes colour or modifier to the main cloth during processing. The '
              'blanket itself often takes an interesting print as well and can be used '
              'again. One bundle gives two results.',
    },
    'washfastness': {
        'bg': 'Колко цвят се губи при пране и колко от него се пренася върху текстила, '
              'изпран заедно с него. Различна е от светлоустойчивостта — цвят може да '
              'е стабилен на светлина и пак да се измива. Първите изпирания винаги '
              'свалят несвързаното багрило; тревожно е, ако загубата продължава и след '
              'третото. Температурата и препаратът също имат значение: алкалният '
              'препарат измества оттенъка на някои багрила независимо от устойчивостта '
              'им.',
        'en': 'How much colour is lost in washing, and how much of it transfers to '
              'textiles washed alongside. It is distinct from lightfastness: a colour '
              'can be stable in light and still wash out. The first few washes always '
              'carry off unbound dye; loss continuing past the third is the warning '
              'sign. Temperature and detergent matter too — an alkaline detergent '
              'shifts the hue of some dyes regardless of how fast they are.',
    },
    'lightfastness': {
        'bg': 'Колко издържа цветът на светлина, преди да избледнее. Мери се с '
              'изложена мостра, половината от която е покрита — след седмици разликата '
              'се вижда. Това е слабото място на растителните багрила и разликата '
              'между тях е огромна: брошът и индигото остават, повечето цветни '
              'листенца — не.',
        'en': 'How long a colour survives light before fading. It is measured with an '
              'exposed swatch, half of it covered — after some weeks the difference '
              'shows. This is the weak point of plant dyes and the spread between them '
              'is very wide: madder and indigo hold, most flower petals do not.',
    },
    'crocking': {
        'bg': 'Способността на обагрения текстил да не отдава цвят при сухо или мокро '
              'триене. Цвят, който излиза при триене и оставя следа върху кожа или '
              'друга тъкан, почти винаги значи, че по повърхността е останало '
              'несвързано багрило — обикновено защото е било повече, отколкото '
              'влакното може да поеме, или защото изплакването е било кратко.',
        'en': 'The ability of a dyed textile not to give up colour under dry or wet '
              'rubbing. Colour that comes off on rubbing and marks skin or another '
              'cloth nearly always means unbound dye left sitting on the surface — '
              'usually because there was more of it than the fibre could take, or '
              'because the rinsing was short.',
    },
    'resist': {
        'bg': 'Каквото пречи на цвета да стигне до тъканта — конец, щипка, дъска, '
              'восък, дори плътно притиснат лист. Защитеното остава светло и точно то '
              'рисува. В шибори резистът е целта; в еко принт често е страничен ефект, '
              'който трябва да се предвиди.',
        'en': 'Whatever keeps colour from reaching the cloth — thread, clamp, board, '
              'wax, even a tightly pressed leaf. What is protected stays pale, and that '
              'is what draws the figure. In shibori the resist is the point; in eco '
              'print it is often a side effect that has to be anticipated.',
    },
}

# The six that were missing and are more basic than most of what was there, plus
# the parent the three fastnesses never had.
ADD = [
    {
        'code': 'natural_dye',
        'term': {'bg': 'Естествено багрило', 'en': 'Natural dye'},
        'aliases': ['багрилно вещество', 'natural dye', 'dyestuff', 'багрилна суровина'],
        'definition': {
            'bg': 'Багрилното вещество, което идва от растение, лишей, гъба или '
                  'насекомо — за разлика от растението или суровината, в която се '
                  'съдържа. Дъбовият лист не е багрилото; багрило са танините в него. '
                  'Разликата има значение: количеството багрилно вещество в една и '
                  'съща суровина се мени с вида, сезона, почвата и начина на сушене, '
                  'затова дозирането се дава спрямо суровината, а резултатът не е '
                  'едно и също нещо при две реколти.',
            'en': 'The colouring compound obtained from a plant, lichen, fungus or '
                  'insect — as distinct from the plant or raw material that holds it. '
                  'An oak leaf is not the dye; the tannins in it are. The distinction '
                  'matters, because the amount of dye compound in the same raw '
                  'material varies with species, season, soil and drying. Dosing is '
                  'therefore given against the raw material, and two harvests are not '
                  'the same thing.',
        },
        'seeAlso': ['extraction', 'dye_bath', 'fugitive'],
        'sourceCode': 'boutrup-ellis',
    },
    {
        'code': 'dye_bath',
        'term': {'bg': 'Багрилна баня', 'en': 'Dye bath'},
        'aliases': ['баня', 'dye bath', 'багрилен разтвор'],
        'definition': {
            'bg': 'Течността, в която се багри тъканта: вода, извлечени багрилни '
                  'вещества и според процеса добавки — мордант, модификатор, сол, '
                  'киселина или основа. Обемът трябва да стига тъканта да се движи '
                  'свободно; притиснат плат се багри на петна. Обемът обаче не решава '
                  'колко багрило влиза — то се дава спрямо тежестта на тъканта, не '
                  'спрямо водата.',
            'en': 'The liquid in which the textile is dyed: water, extracted dye '
                  'compounds and, depending on the process, additions such as mordant, '
                  'modifier, salt, acid or alkali. The volume has to be enough for the '
                  'cloth to move freely, since cloth packed tight dyes in patches. '
                  'Volume does not set how much dye goes in, though: that is given '
                  'against the weight of the fibre, not against the water.',
        },
        'seeAlso': ['wof', 'extraction', 'exhaust'],
        'sourceCode': 'boutrup-ellis',
    },
    {
        'code': 'ecoprint',
        'term': {'bg': 'Еко принт', 'en': 'Eco print'},
        'aliases': ['ботанически контактен печат', 'eco print', 'ecoprint',
                    'botanical contact print', 'контактен печат'],
        'definition': {
            'bg': 'Багрене чрез пряк контакт: листа, цветове или кора се подреждат '
                  'върху тъканта и се притискат към нея, вместо да се вари в баня. '
                  'Цветът остава там, където растението докосва плата, и носи неговата '
                  'форма. Затова резултатът зависи не само от растението и морданта, а '
                  'и от натиска, влагата, топлината и това какво е било между слоевете.',
            'en': 'Dyeing by direct contact: leaves, flowers or bark are laid on the '
                  'cloth and pressed against it rather than boiled in a bath. The '
                  'colour stays where the plant touches the textile and takes its '
                  'shape. The result therefore depends not only on the plant and the '
                  'mordant but on pressure, moisture, heat and whatever lay between '
                  'the layers.',
        },
        'seeAlso': ['blanket', 'resist', 'modifier'],
        'sourceCode': 'india-flint-eco-colour',
    },
    {
        'code': 'overdye',
        'term': {'bg': 'Повторно багрене', 'en': 'Overdyeing'},
        'aliases': ['надбагряване', 'наслагване', 'overdye', 'overdyeing',
                    'второ багрене'],
        'definition': {
            'bg': 'Второ багрене върху вече обагрен плат, за да се получи цвят, който '
                  'едно багрене не дава — жълто под синьо дава зелено. Различава се от '
                  'повтарянето на същата баня, за да излезе по-наситено: тук второто '
                  'багрило ляга върху първия цвят, а не го допълва. Затова редът има '
                  'значение и по-светлото отива първо.',
            'en': 'A second dyeing over cloth that is already dyed, to reach a colour a '
                  'single dyeing does not give — yellow under blue gives green. It '
                  'differs from repeating the same bath for greater depth: here the '
                  'second dye settles over the first colour rather than adding to it. '
                  'Order therefore matters, and the lighter colour goes first.',
        },
        'seeAlso': ['modifier', 'exhaust', 'afterbath'],
        'sourceCode': 'jenny-dean-wild-colour',
    },
    {
        'code': 'fugitive',
        'term': {'bg': 'Нетрайно багрило', 'en': 'Fugitive dye'},
        'aliases': ['нетрайно', 'fugitive', 'fugitive dye', 'избледняващо багрило'],
        'definition': {
            'bg': 'Багрило, което дава силен цвят в деня на багренето и го губи за '
                  'седмици или при първите изпирания. Много цветни листенца, цвеклото '
                  'и антоцианиновите плодове са тук: цветът е истински, но не се '
                  'задържа върху влакното. Нетрайността не се вижда на прясна мостра — '
                  'личи само след излагане на светлина и пране, затова се проверява, '
                  'преди багрилото да влезе в работа, която трябва да остане.',
            'en': 'A dye that gives a strong colour on the day and loses it within '
                  'weeks, or at the first washes. Many flower petals, beetroot and '
                  'anthocyanin fruits belong here: the colour is real but does not hold '
                  'on the fibre. Fugitiveness is invisible on a fresh swatch and shows '
                  'only after exposure to light and washing, so it is tested before the '
                  'dye goes into work meant to last.',
        },
        'seeAlso': ['colourfastness', 'lightfastness', 'anthocyanin'],
        'sourceCode': 'jenny-dean-wild-colour',
    },
    {
        'code': 'colourfastness',
        'term': {'bg': 'Устойчивост на цвета', 'en': 'Colourfastness'},
        'aliases': ['устойчивост', 'colourfastness', 'colorfastness', 'трайност на цвета'],
        'definition': {
            'bg': 'Общото название за това колко се задържа цветът върху текстила. '
                  'Мери се в три отделни посоки, които не вървят заедно: на светлина, '
                  'на пране и на триене. Едно багрене може да е стабилно на светлина и '
                  'пак да се измива, или да издържа пране и да оставя следа при сухо '
                  'триене. Затова се проверяват и трите, а не се съди по едното.',
            'en': 'The general name for how well a colour holds on a textile. It is '
                  'measured in three separate directions, which do not move together: '
                  'light, washing and rubbing. A dyeing can be stable in light and '
                  'still wash out, or survive washing and still mark under dry rubbing. '
                  'All three are tested rather than one being taken for the rest.',
        },
        'seeAlso': ['lightfastness', 'washfastness', 'crocking'],
        'sourceCode': 'boutrup-ellis',
    },
    {
        'code': 'water_hardness',
        'term': {'bg': 'Твърдост на водата', 'en': 'Water hardness'},
        'aliases': ['твърда вода', 'мека вода', 'water hardness', 'hard water', 'калций'],
        'definition': {
            'bg': 'Съдържанието на калциеви и магнезиеви соли във водата. Твърдата вода '
                  'променя резултата при някои багрила — при броша например поддържа '
                  'по-топлите, тухлени тонове, — а при други притъпява цвета и утаява '
                  'сапуна при пране. Това е една от честите причини една и съща рецепта '
                  'да дава различен цвят на две места. Ако се търси повторяемост, '
                  'водата се записва като условие на работата наравно с pH и '
                  'температурата.',
            'en': 'The calcium and magnesium content of the water. Hard water changes '
                  'the result with some dyes — with madder it favours the warmer, brick '
                  'tones — and with others dulls the colour and precipitates soap '
                  'during washing. It is one of the common reasons the same recipe '
                  'gives a different colour in two places. Where repeatability matters, '
                  'the water is recorded as a condition of the work alongside pH and '
                  'temperature.',
        },
        'seeAlso': ['ph', 'dye_bath', 'anthraquinone'],
        'sourceCode': 'boutrup-ellis',
    },
]

# The English pass, on terms whose meaning is unchanged but whose English had
# been following the Bulgarian phrase by phrase.  Bulgarian untouched here.
REWRITE_EN = {
    'substantive_adjective':
        'A substantive dye binds to the fibre without a mordant — indigo, walnut, '
        'many tannins. An adjective dye needs one, and most plant dyes are of that '
        'kind. The terms are counter-intuitive and worth learning: "adjective" does '
        'not mean weaker, it means the colour depends on what stands between the dye '
        'and the fibre.',
    'exhaust':
        'A bath does not give up all its colour at once. After the first cloth comes '
        'out, what is left will dye a second one paler, and often a third paler '
        'still. Those are not failures but a scale of depth from one extraction, and '
        'the paler steps are frequently the more useful ones.',
    'tannin':
        'A large group of plant compounds that bind to both fibre and metal. In '
        'natural dyeing they do two jobs: they are a colour in their own right — the '
        'beiges, the greys and, with iron, the blacks — and they are the ground that '
        'lets cellulose take a metal mordant. Oak, sumac, myrobalan and tea are all '
        'here, and they do not give the same result.',
}


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def main():
    data = load(GLOSSARY)
    terms = data['terms']
    source_codes = {s['code'] for s in load(SOURCES)['sources']}

    by_code = {t['code']: t for t in terms}

    # 1. Removals.
    removed = [c for c in REMOVE if c in by_code]
    terms = [t for t in terms if t['code'] not in REMOVE]
    by_code = {t['code']: t for t in terms}

    # 2. Additions, or refresh if a previous run already added them.  Written as
    #    replace-or-append so the script converges rather than duplicating.
    added, refreshed = [], []
    for spec in ADD:
        entry = dict(spec)
        if entry['code'] in by_code:
            by_code[entry['code']].update(entry)
            refreshed.append(entry['code'])
        else:
            terms.append(entry)
            by_code[entry['code']] = entry
            added.append(entry['code'])

    # 3. Titles.
    for code, title in RETITLE.items():
        if code not in by_code:
            sys.exit(f'retitle names a term that is not here: {code}')
        by_code[code]['term']['bg'] = title

    # 4. Definitions, both languages.
    for code, text in REDEFINE.items():
        if code not in by_code:
            sys.exit(f'redefinition names a term that is not here: {code}')
        by_code[code]['definition'] = dict(text)

    # 5. English only.
    for code, en in REWRITE_EN.items():
        if code not in by_code:
            sys.exit(f'English rewrite names a term that is not here: {code}')
        by_code[code]['definition']['en'] = en

    # 6. Groups.  Anything not named in GROUP_OF stops the run: a default group
    #    would put a term somewhere plausible and nobody would notice which.
    ungrouped = [t['code'] for t in terms if t['code'] not in GROUP_OF]
    if ungrouped:
        sys.exit(f'no group given for: {", ".join(ungrouped)}')
    for t in terms:
        t['group'] = GROUP_OF[t['code']]

    # 7. Cross-references to terms that have left.  Guard 24d would catch these,
    #    but it should catch a mistake, not the predictable consequence of a
    #    removal this script performed itself.
    codes = set(by_code)
    cleaned = []
    for t in terms:
        keep = [c for c in t.get('seeAlso', []) if c in codes]
        if keep != t.get('seeAlso', []):
            cleaned.append(t['code'])
        t['seeAlso'] = keep

    # 8. Checks that must hold before the file is written.
    bad_source = [t['code'] for t in terms
                  if t.get('sourceCode') and t['sourceCode'] not in source_codes]
    if bad_source:
        sys.exit(f'attribution to a source that does not exist: {", ".join(bad_source)}')

    half = [f"{t['code']}.{f}.{lang}"
            for t in terms for f in ('term', 'definition') for lang in ('bg', 'en')
            if not t.get(f, {}).get(lang, '').strip()]
    if half:
        sys.exit(f'missing text: {", ".join(half)}')

    if sorted(set(GROUP_OF.values())) != sorted(GROUPS):
        sys.exit('a group is used that is not in GROUPS, or a group is unused')

    # Ordered by group, then alphabetically inside it, so the file reads in the
    # order the screen shows.
    terms.sort(key=lambda t: (GROUPS.index(t['group']), t['term']['bg']))

    data['terms'] = terms
    data['packVersion'] = PACK_VERSION
    data['description'] = {
        'bg': 'Думите на занаята, обяснени със свои думи. Тук стои дума, която човек '
              'ще срещне в книга, рецепта или общност и чието значение не е очевидно '
              'от самата дума. Не стоят тук нито понятия, които са кодове в модела и '
              'носят обяснението си там, където се показват, нито техники — те са в '
              'модула Техники.',
        'en': 'The words of the craft, explained in our own words. A word belongs here '
              'if a person will meet it in a book, a recipe or a community and its '
              'meaning is not obvious from the word itself. Concepts that are codes in '
              'the model do not: they carry their explanation where they are shown. '
              'Neither do techniques, which live in the Techniques module.',
    }

    GLOSSARY.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    print(f'glossary: {len(terms)} terms, pack {PACK_VERSION}')
    print(f'  removed   ({len(removed)}): {", ".join(removed) or "—"}')
    print(f'  added     ({len(added)}): {", ".join(added) or "—"}')
    if refreshed:
        print(f'  refreshed ({len(refreshed)}): {", ".join(refreshed)}')
    print(f'  retitled  ({len(RETITLE)}), redefined ({len(REDEFINE)}), '
          f'English redone ({len(REWRITE_EN)})')
    if cleaned:
        print(f'  seeAlso cleaned on: {", ".join(cleaned)}')
    for g in GROUPS:
        n = sum(1 for t in terms if t['group'] == g)
        print(f'    {g:18} {n}')


if __name__ == '__main__':
    main()

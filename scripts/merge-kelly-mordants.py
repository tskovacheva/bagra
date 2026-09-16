"""§13ec: the compound mordant and its three companions, from Alison Kelly's
book, crediting Michel Garcia's recipe.

QUANTITIES. The book gives the compound mordant TWICE and the two do not agree:
a fixed batch for up to 250 g of fibre, and a page of percentages of the weight
of fibre. The owner chose the BATCH — recalculated to 100 g of fibre, which is
what these figures are:

    50 g alum / 250 g  →  20 g per 100 g  →  20% WOF
    25 g soda / 250 g  →  10 g per 100 g  →  10% WOF  (the page says 5%)
    30 g soda / 250 g  →  12 g per 100 g  →  12% WOF  (the page says 6%)
   1–2 g iron / 250 g  →  0.4–0.8 per 100 →  0.4–0.8% (the page says 0.2–0.5%)
  5–10 g iron / 250 g  →  2–4 per 100 g   →  2–4%     (the page says 2–3%)
   500 ml vinegar/250  →  200 ml per 100  →  200% WOF (the page gives none)

Filed as percentages rather than as a fixed batch so the recipe answers for any
weight of cloth; at 100 g the work view shows exactly the figures above.

BRIGHT AND DARK ARE TWO RECORDS. They differ in the iron AND in the soda, so
they are not one recipe with a choice on one line.

The oatmeal bath is its own recipe, not a step: it happens after the cloth has
dried completely, which is the whole point of the method. It is attached as
`requiredFollowOn`, so both mordants carry it on their work view.

Run from the repository root:  python3 scripts/merge-kelly-mordants.py
"""
import json

SOURCES = [
 {"code": "alison-kelly-printing", "kind": "book",
  "name": "Printing from the Garden",
  "author": "Alison Kelly",
  "note": {"bg": "Книга за еко принт върху плат. Дава сложния мордант, банята с овесени ядки, соевото мляко и желязната баня, като посочва, че сложният мордант следва рецепта на Мишел Гарсия.",
           "en": "A book on eco printing on cloth. It gives the compound mordant, the oatmeal bath, the soy milk bath and the iron bath, and says the compound mordant follows a recipe of Michel Garcia's."}},
 {"code": "michel-garcia", "kind": "person",
  "name": "Michel Garcia",
  "author": "Michel Garcia",
  "note": {"bg": "Химик и ботаник, чиито рецепти за мордантиране на целулоза без нагряване се преподават и преразказват широко. Сложният мордант тук идва от негова рецепта, както е предадена от Алисън Кели.",
           "en": "A chemist and botanist whose recipes for mordanting cellulose without heat are widely taught and retold. The compound mordant here comes from a recipe of his, as given by Alison Kelly."}},
]

CITE = ["alison-kelly-printing", "michel-garcia"]

def line(i, role, pct_min, pct_max, unit, sub, bg, en):
    o = {"id": i + "-o", "substanceId": sub}
    if pct_min == pct_max:
        o["qtyMin"] = o["qtyMax"] = pct_min
    else:
        o["qtyMin"], o["qtyMax"] = pct_min, pct_max
    return {"id": i, "roleCode": role, "basis": "percent_wof", "unit": unit,
            "quantity": pct_min if pct_min == pct_max else None,
            "quantityMin": pct_min, "quantityMax": pct_max,
            "note": {"bg": bg, "en": en}, "options": [o]}

def step(i, bg, en):
    return {"id": i, "text": {"bg": bg, "en": en}}

COMMON_STEPS = lambda p: [
 step(p+"s1", "С маска: претегли стипцата и я сложи в съда. Добави оцета и бъркай, докато се разтвори напълно.",
              "Wearing a mask: weigh the alum and put it in the vessel. Add the vinegar and whisk until it is completely dissolved."),
 step(p+"s2", "Добави железния сулфат и бъркай, докато се разтвори. Всичко трябва да е разтворено, преди да влезе содата — иначе разтворът става мътен.",
              "Add the ferrous sulfate and whisk until dissolved. Everything must be fully dissolved before the soda ash goes in, or the mordant turns murky."),
 step(p+"s3", "Добавяй содата бавно, малко по малко. Ако влезе бързо, сместа прелива. Пенене и отделяне на газ е нормално — не вдишвай парите.",
              "Add the soda ash slowly, a little at a time. Too fast and it boils over. Frothing and off-gassing are normal — do not breathe the fumes."),
 step(p+"s4", "С ръкавици: сложи СУХИЯ плат в разтвора и го работи с ръце 1–2 минути.",
              "Wearing gloves: put the DRY cloth into the solution and work it with your hands for one to two minutes."),
 step(p+"s5", "Извади плата и го изстискай леко над съда, като пазиш течността.",
              "Take the cloth out and wring it gently over the vessel, keeping the liquid."),
 step(p+"s6", "Закачи го опънат, ъгъл до ъгъл, без гънки и застъпвания. Сгънат върху себе си плат дава ивици.",
              "Hang it taut, corner to corner, with no folds or overlaps. Cloth folded onto itself streaks."),
 step(p+"s7", "Остави да изсъхне НАПЪЛНО. Това не е изчакване, а част от рецептата: докато водата се изпарява, мордантът влиза навътре във влакното, а оцетът се изпарява.",
              "Let it dry COMPLETELY. This is not waiting, it is part of the recipe: as the water evaporates the mordant moves into the fibre, and the vinegar evaporates with it."),
 step(p+"s8", "Веднага щом изсъхне, мини на банята с овесени ядки.",
              "As soon as it is dry, go on to the oatmeal bath."),
]

RECIPES = [
 {"code": "compound-mordant-bright", "type": "mordant", "output": "none",
  "scaleBy": "weight", "appliesTo": ["cellulose", "protein"],
  "sourceCodes": CITE, "distributable": True,
  "requiredFollowOn": ["seed:oatmeal-fixing-bath"],
  "name": {"bg": "Сложен мордант — светъл резултат", "en": "Compound mordant — bright outcome"},
  "notes": {"bg": "Алуминиев ацетат, направен на място от стипца, оцет и сода, с малко желязо. Платът влиза СУХ и изсъхва отново — така оцетът се изпарява и връзката се затяга. Задължително следва баня с овесени ядки. Количествата са от партидата в книгата, преизчислени на 100 г плат.",
            "en": "Aluminium acetate made in place from alum, vinegar and soda ash, with a little iron. The cloth goes in DRY and dries again — that is how the vinegar evaporates and the bond tightens. An oatmeal bath must follow. The quantities are the book's batch, recalculated to 100 g of cloth."},
  "ingredients": [
   line("cmb-1", "acid_source", 200, 200, "ml", "seed:acetic_acid",
        "Дестилиран бял оцет. 200 мл на 100 г плат.",
        "Distilled white vinegar. 200 ml to 100 g of cloth."),
   line("cmb-2", "aluminium_source", 20, 20, "g", "seed:alum_potassium_12",
        "Калиева стипца. Разтваря се докрай, преди да влезе каквото и да е друго.",
        "Potassium alum. Dissolved completely before anything else goes in."),
   line("cmb-3", "modifier", 0.4, 0.8, "g", "seed:iron_sulfate",
        "Железен сулфат, малко. Повече желязо разяжда коприна и вълна — мери точно.",
        "Ferrous sulfate, a little. Too much iron damages silk and wool — measure it carefully."),
   line("cmb-4", "alkali", 10, 10, "g", "seed:soda_ash",
        "Сода. Влиза бавно и последна.",
        "Soda ash. It goes in slowly, and last."),
  ],
  "steps": COMMON_STEPS("cmb-")},

 {"code": "compound-mordant-dark", "type": "mordant", "output": "none",
  "scaleBy": "weight", "appliesTo": ["cellulose", "protein"],
  "sourceCodes": CITE, "distributable": True,
  "requiredFollowOn": ["seed:oatmeal-fixing-bath"],
  "name": {"bg": "Сложен мордант — тъмен резултат", "en": "Compound mordant — dark outcome"},
  "notes": {"bg": "Същият мордант с повече желязо и малко повече сода — по-тъмен и по-плътен отпечатък. Желязото натъжава цветовете: жълтото става маслинено, а с танини дава сиво и почти черно. Задължително следва баня с овесени ядки. Количествата са от партидата в книгата, преизчислени на 100 г плат.",
            "en": "The same mordant with more iron and a little more soda — a darker, bolder print. Iron saddens the colours: yellows go olive, and with tannins it gives greys and near-blacks. An oatmeal bath must follow. The quantities are the book's batch, recalculated to 100 g of cloth."},
  "ingredients": [
   line("cmd-1", "acid_source", 200, 200, "ml", "seed:acetic_acid",
        "Дестилиран бял оцет. 200 мл на 100 г плат.",
        "Distilled white vinegar. 200 ml to 100 g of cloth."),
   line("cmd-2", "aluminium_source", 20, 20, "g", "seed:alum_potassium_12",
        "Калиева стипца. Разтваря се докрай, преди да влезе каквото и да е друго.",
        "Potassium alum. Dissolved completely before anything else goes in."),
   line("cmd-3", "modifier", 2, 4, "g", "seed:iron_sulfate",
        "Железен сулфат. Повече желязо разяжда коприна и вълна — за тях върви към долната граница.",
        "Ferrous sulfate. Too much iron damages silk and wool — for those, stay at the lower end."),
   line("cmd-4", "alkali", 12, 12, "g", "seed:soda_ash",
        "Сода. Влиза бавно и последна.",
        "Soda ash. It goes in slowly, and last."),
  ],
  "steps": COMMON_STEPS("cmd-")},

 {"code": "oatmeal-fixing-bath", "type": "mordant", "output": "none",
  "scaleBy": "weight", "appliesTo": ["cellulose", "protein"],
  "sourceCodes": CITE, "distributable": True,
  "name": {"bg": "Баня с овесени ядки или трици", "en": "Oatmeal or bran fixing bath"},
  "notes": {"bg": "Прави се СЛЕД сложния мордант и след като платът е изсъхнал напълно. Отмива останалия по повърхността мордант и затяга връзката на металните соли с влакното. Разтворът върши работа за още плат: държи се покрит, на хладно и сухо, до три дни — при мехурчета, мухъл или миризма се изхвърля. По-старото име на тази стъпка е „торене“, защото преди овеса се е използвала кравешка тор.",
            "en": "Done AFTER the compound mordant and after the cloth has dried completely. It rinses away stray mordant left on the surface and strengthens the bond of the metallic salts to the fibre. The solution will fix more cloth: keep it covered, cool and dry, for up to three days — discard it at the first bubbles, mould or smell. The older name for this step is „dunging\", because cow manure was used before oats."},
  "ingredients": [
   line("ofb-1", "assistant", 80, 80, "g", "seed:oats",
        "Овесени ядки, 80 г. Пшеничните трици вършат същата работа.",
        "Oats, 80 g. Wheat bran does the same job."),
  ],
  "steps": [
   step("ofb-s1", "Вържи овеса в квадрат марля или в найлонов чорап на вързоп.",
                  "Tie the oats into a bundle in a square of cheesecloth or a nylon stocking."),
   step("ofb-s2", "Напълни купа с около 2 л топла вода на 100 г овес и пусни вързопа вътре.",
                  "Fill a bowl with about 2 litres of warm water per 100 g of oats and put the bundle in."),
   step("ofb-s3", "Работи вързопа с ръце няколко минути, докато овесът се насити, после остави 15–20 минути или докато водата стане млечна. Извади вързопа и го изхвърли.",
                  "Work the bundle with your hands for a few minutes until the oats are saturated, then leave it fifteen to twenty minutes, or until the water turns milky. Take the bundle out and discard it."),
   step("ofb-s4", "Прелей разтвора в по-голям съд и долей студена или стайна вода, колкото да покрие плата.",
                  "Pour the solution into a larger vessel and top it up with cold or room-temperature water, enough to cover the cloth."),
   step("ofb-s5", "Сложи плата, разработи го с ръце и остави 5–10 минути.",
                  "Put the cloth in, work it with your hands, and leave it five to ten minutes."),
   step("ofb-s6", "Извади и изплакни с чешмяна вода, за да излязат частиците. Изстискай леко — платът трябва да е влажен, не капещ. Оттук може да се печата, или да се изсуши за по-късно.",
                  "Take it out and rinse under the tap to wash off stray particles. Wring gently — the cloth should be damp, not dripping. You can print from here, or dry it for later."),
  ]},

 {"code": "soy-milk-bath", "type": "mordant", "output": "none",
  "scaleBy": "weight", "appliesTo": ["cellulose"],
  "sourceCodes": ["alison-kelly-printing"], "distributable": True,
  "name": {"bg": "Баня със соево мляко", "en": "Soy milk bath"},
  "notes": {"bg": "Соевият протеин ляга върху целулозата и ѝ дава това, което ѝ липсва: коприната и вълната се свързват с растителния цвят сами, памукът и хартията — не. Може да се прави след сложния мордант, за по-наситен отпечатък, или самостоятелно — тогава е по-прост и по-безопасен избор, особено с деца, защото няма прахове за вдишване, но устойчивостта на пране и светлина е по-малка, отколкото с метален мордант. Използва се неподсладено и неовкусено мляко, за предпочитане био.",
            "en": "Soy protein settles onto cellulose and gives it what it lacks: silk and wool bond with plant colour by themselves, cotton and paper do not. It can follow the compound mordant, for a more saturated print, or stand alone — a simpler and safer option, especially with children, since there are no powders to inhale, though the wash- and lightfastness are lower than with a metallic mordant. Use unsweetened, unflavoured milk, preferably organic."},
  "ingredients": [
   line("smb-1", "assistant", 1000, 1000, "ml", "seed:soy_milk",
        "Соево мляко, 1 л на 100 г плат, долято с вода, колкото платът да се движи свободно.",
        "Soy milk, 1 litre to 100 g of cloth, topped up with water so the cloth can move freely."),
  ],
  "steps": [
   step("smb-s1", "Сипи млякото в кофа и долей вода, колкото платът да е потопен и да се движи свободно.",
                  "Pour the milk into a bucket and top up with enough water for the cloth to be submerged and move freely."),
   step("smb-s2", "Сложи намокрения плат. Провери нивото — трябва да има място за движение. Остави 12 часа.",
                  "Add the wetted-out cloth. Check the level — there must be room to move. Leave for twelve hours."),
   step("smb-s3", "Разбърквай внимателно от време на време.",
                  "Agitate and stir gently from time to time."),
   step("smb-s4", "След 12 часа извади плата и го изстискай над кофата. Закачи го да изсъхне напълно.",
                  "After twelve hours take the cloth out and wring it over the bucket. Hang it to dry completely."),
   step("smb-s5", "Когато е напълно сух, изплакни добре. Оттук може да се печата, или да се прибере за по-късно.",
                  "When it is completely dry, rinse well. You can print from here, or store it for later."),
  ]},

 {"code": "iron-bath-dark", "type": "mordant", "output": "none",
  "scaleBy": "weight", "appliesTo": ["cellulose", "protein"],
  "sourceCodes": ["alison-kelly-printing"], "distributable": True,
  "name": {"bg": "Желязна баня за тъмен резултат", "en": "Iron bath for a dark outcome"},
  "notes": {"bg": "Малко желязо върши много. Платът влиза в банята НЕПОСРЕДСТВЕНО преди печат, защото желязото се окислява бързо във вода и пожълтява плата. Повече желязо разяжда коприна и вълна. Около 1% дава по-наситен резултат, до 2.5% — по-тъмен. Останалата вода след няколко минути пожълтява от окисляването и може да се изхвърли в канала.",
            "en": "A little iron goes a long way. The cloth goes into the bath IMMEDIATELY before printing, because iron oxidises quickly in water and yellows the textile. Too much iron damages silk and wool. Around 1% gives a more saturated result, up to 2.5% a darker one. After a few minutes the leftover water yellows from oxidation and can go down the drain."},
  "ingredients": [
   line("ibd-1", "modifier", 1, 2.5, "g", "seed:iron_sulfate",
        "Железен сулфат, 1–2.5% от теглото на плата. Мери точно.",
        "Ferrous sulfate, 1–2.5% of the weight of the cloth. Measure it accurately."),
  ],
  "steps": [
   step("ibd-s1", "С маска: претегли железния сулфат и го сложи в съда. Добави 2 л студена вода на 100 г плат и бъркай, докато прахът се разтвори напълно — може да отнеме около минута.",
                  "Wearing a mask: weigh the ferrous sulfate into the vessel. Add 2 litres of cold water per 100 g of cloth and whisk until the powder is fully dissolved — this may take a minute or so."),
   step("ibd-s2", "С ръкавици: потопи плата и го работи с ръце около 15 секунди.",
                  "Wearing gloves: immerse the cloth and work it with your hands for about fifteen seconds."),
   step("ibd-s3", "Изстискай леко и остави да поизсъхне на въже — влажен, не капещ, когато го слагаш за печат.",
                  "Wring gently and let it dry slightly on a line — damp, not dripping, when you lay it out to print."),
  ]},
]

def merge(path, key, rows, version):
    d = json.load(open(path, encoding='utf8'))
    have = {r['code'] for r in d[key]}
    added = 0
    for r in rows:
        if r['code'] in have:
            print(f"held  {r['code']}")
            continue
        d[key].append(r); added += 1
        print(f"add   {r['code']}")
    if added:
        d['packVersion'] = version
        open(path, 'w', encoding='utf8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
    return added

n = merge('seed/sources.json', 'sources', SOURCES, '12')
n += merge('seed/recipes.json', 'recipes', RECIPES, '0.15.0')
print(f'{n} records written.')

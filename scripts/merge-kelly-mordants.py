"""§13ec: the three mordant recipes from Alison Kelly's book, and the bath that
fixes the first of them.

ATTRIBUTION, as the owner set it on 14 September 2026: Kelly's book, crediting
Garcia's recipe. Two source codes, nothing else said in the record.

THE FIGURES. Kelly gives the compound mordant TWICE and the two do not agree —
a batch for up to 250 g of cloth, and a page of percentages. The owner chose the
BATCH, recalculated to 100 g of cloth, which is what these records hold:

    alum 20% WOF · soda ash 10% · vinegar 200% · iron 0.4–0.8% (bright) or 2–4% (dark)

The percentage page gives half the soda and less iron. Not recorded here: the
record states one set of figures, and a recipe that gives two answers to one
question is not a recipe.

Run from the repository root:  python3 scripts/merge-kelly-mordants.py
"""
import json

SUBS = [
 {"code": "soy_milk", "category": "binder",
  "name": {"bg": "Соево мляко", "en": "Soy milk"},
  "sourceCodes": ["alison-kelly-printing"],
  "typicalUse": {
   "bg": "Мордант и фиксатор за целулоза. Протеинът се хваща за памука и лена, които сами нямат протеин, и така платът приема повече цвят. По-слабо трайно от металните морданти, но безопасно — става и с деца. Неподсладено и без аромат.",
   "en": "A mordant and fixer for cellulose. The protein attaches to cotton and linen, which have none of their own, so the cloth takes more colour. Less lasting than a metallic mordant but safe — suitable with children. Unsweetened and unflavoured."}},
 {"code": "wheat_bran", "category": "binder",
  "name": {"bg": "Пшенични трици", "en": "Wheat bran"},
  "sourceCodes": ["alison-kelly-printing"],
  "typicalUse": {
   "bg": "Вързани в марля и накиснати, дават млечна вода, която фиксира морданта към влакното и отмива остатъчните соли. Взаимозаменяеми с овесените ядки.",
   "en": "Tied in cheesecloth and soaked, they give a milky water that fixes the mordant to the fibre and rinses off the stray salts. Interchangeable with oat groats."}},
]

SOURCES = [
 {"code": "alison-kelly-printing", "kind": "book",
  "name": "Printing from the Garden",
  "author": "Alison Kelly",
  "note": {"bg": "Ръководство за еко принт върху плат. Дава сложния мордант, банята с овесени ядки, соевото мляко и желязната баня, с количества и снимки на всяка стъпка.",
           "en": "A guide to botanical printing on fabric. It gives the compound mordant, the oatmeal bath, the soy milk bath and the iron bath, with quantities and a photograph of every step."}},
 {"code": "michel-garcia", "kind": "person",
  "name": "Michel Garcia",
  "author": "Michel Garcia",
  "note": {"bg": "Химик и ботаник, чиито методи за мордантиране на целулоза без нагряване стоят зад голяма част от съвременната практика. Сложният мордант тук е негова рецепта, адаптирана от Алисън Кели.",
           "en": "A chemist and botanist whose methods for mordanting cellulose without heat lie behind much of current practice. The compound mordant here is his recipe, as adapted by Alison Kelly."}},
]

def ing(i, role, basis, qty, unit, bg, en, sub=None, qmin=None, qmax=None):
    line = {"id": i, "roleCode": role, "basis": basis, "unit": unit,
            "note": {"bg": bg, "en": en}, "options": []}
    if qty is not None: line["quantity"] = qty
    if sub:
        o = {"id": i + "-o", "substanceId": sub}
        if qmin is not None: o["qtyMin"], o["qtyMax"] = qmin, qmax
        line["options"].append(o)
    return line

def step(i, bg, en): return {"id": i, "text": {"bg": bg, "en": en}}

CREDIT = ["alison-kelly-printing", "michel-garcia"]

def compound(code, name_bg, name_en, fe_min, fe_max, note_bg, note_en):
    return {
      "code": code, "type": "mordant", "output": "none", "scaleBy": "weight",
      "appliesTo": ["cellulose", "protein"], "sourceCodes": CREDIT,
      "requiredFollowOn": ["seed:bran-fix-bath"],
      "name": {"bg": name_bg, "en": name_en},
      "notes": {"bg": note_bg, "en": note_en},
      "ingredients": [
        ing("cm-alum", "mordant", "percent_wof", 20, "g",
            "Калиева стипца. Разтваря се в оцета — с маска, прахът не се вдишва.",
            "Potassium alum. Dissolved in the vinegar — wear a mask, the powder is not to be breathed.",
            "seed:alum_potassium_12"),
        ing("cm-vinegar", "acid_source", "percent_wof", 200, "ml",
            "Дестилиран бял оцет. Държи стипцата в разтвор, докато содата я превърне.",
            "Distilled white vinegar. It keeps the alum in solution until the soda ash converts it.",
            "seed:acetic_acid"),
        ing("cm-iron", "modifier", "percent_wof", None, "g",
            "Железен сулфат. Разтваря се докрай, преди содата да влезе — иначе мордантът става мътен.",
            "Ferrous sulfate. Dissolved completely before the soda ash goes in, or the mordant turns murky.",
            "seed:iron_sulfate", fe_min, fe_max),
        ing("cm-soda", "alkali", "percent_wof", 10, "g",
            "Сода. Влиза бавно — сместа кипва и се надига.",
            "Soda ash. It goes in slowly — the mixture bubbles and rises.",
            "seed:soda_ash"),
      ],
      "steps": [
        step("cm-s1", "С маска: претегли стипцата, сложи я в съда, добави оцета и бъркай, докато се разтвори напълно.",
                      "Wearing a mask: weigh the alum, put it in the vessel, add the vinegar and whisk until it has completely dissolved."),
        step("cm-s2", "Добави железния сулфат и бъркай до пълно разтваряне. Всички частици трябва да са се разтворили, преди содата да влезе.",
                      "Add the ferrous sulfate and whisk until completely dissolved. Every particle must be dissolved before the soda ash goes in."),
        step("cm-s3", "Добавяй содата бавно, на малки порции. Ще кипи и ще изпуска газ — това е нормално, но не дишай изпаренията. Бъркай до пълно разтваряне.",
                      "Add the soda ash slowly, a little at a time. It will bubble and off-gas — that is normal, but do not breathe the fumes. Stir until fully dissolved."),
        step("cm-s4", "С ръкавици: сложи СУХИЯ плат в разтвора и го омесвай 1–2 минути.",
                      "Wearing gloves: put the DRY cloth into the solution and work it into the mordant for one to two minutes."),
        step("cm-s5", "Извади плата и го изстискай внимателно над съда, като запазиш излишната течност.",
                      "Take the cloth out and wring it gently over the vessel, keeping the excess liquid."),
        step("cm-s6", "Закачи плата опънат, ъгъл до ъгъл, без гънки и застъпвания. Ако се сгъне върху себе си, остават ивици.",
                      "Hang the cloth taut, corner to corner, with no folds or overlaps. Folded onto itself it will streak."),
        step("cm-s7", "Остави да изсъхне НАПЪЛНО. Изсъхналият плат е мек и покрит с тънък слой мордант. Оцетът се изпарява и връзката с влакното се затяга.",
                      "Let it dry COMPLETELY. Dry, the cloth is soft and coated in a fine powder of mordant. The vinegar evaporates and the bond to the fibre tightens."),
        step("cm-s8", "Веднага щом изсъхне, потопи го в банята с трици — виж следващата рецепта.",
                      "As soon as it is dry, put it through the bran bath — see the recipe that follows."),
      ]}

RECIPES = [
 compound("compound-mordant-bright", "Сложен мордант — светъл резултат",
          "Compound mordant — bright outcome", 0.4, 0.8,
          "Количествата са спрямо сухото тегло на плата. Малко желязо — за ярък и естествен цвят. Платът влиза СУХ, не намокрен. Партидата се смята за изчерпана, след като е мордантирала своя плат.",
          "Quantities are against the dry weight of the cloth. Little iron — for vibrant, natural colour. The cloth goes in DRY, not wetted out. The batch is spent once it has mordanted its cloth."),
 compound("compound-mordant-dark", "Сложен мордант — тъмен резултат",
          "Compound mordant — dark outcome", 2, 4,
          "Количествата са спрямо сухото тегло на плата. Повече желязо — по-тъмен и по-плътен резултат. Внимавай с коприна и вълна: желязото ги разяжда. Платът влиза СУХ.",
          "Quantities are against the dry weight of the cloth. More iron — a darker, bolder result. Take care with silk and wool: iron damages them. The cloth goes in DRY."),

 {"code": "bran-fix-bath", "type": "mordant", "output": "none", "scaleBy": "weight",
  "appliesTo": ["cellulose", "protein"], "sourceCodes": CREDIT,
  "name": {"bg": "Баня с трици или овесени ядки", "en": "Bran or oatmeal bath"},
  "notes": {"bg": "Прави се СЛЕД сложния мордант, върху напълно изсъхнал плат. Отмива остатъчните соли и затяга връзката на морданта с влакното. Разтворът стига за още плат — пази се покрит и на хладно до три дни; при мехурчета, плесен или миризма се изхвърля. Историческото име на тази стъпка е „торене“ — правело се е с оборска тор, преди триците да я заместят.",
            "en": "Done AFTER the compound mordant, on cloth that is completely dry. It rinses off the stray salts and tightens the bond of the mordant to the fibre. The solution will fix more cloth — keep it covered and cool for up to three days; discard it at the first bubbles, mould or smell. The historical name for this step is „dunging“ — it was done with cow manure before bran replaced it."},
  "ingredients": [
   ing("bf-1", "assistant", "absolute", 80, "g",
       "Овесени ядки или пшенични трици, вързани в марля или в найлонов чорап.",
       "Oat groats or wheat bran, tied in cheesecloth or a nylon stocking.",
       "seed:oats"),
  ],
  "steps": [
   step("bf-s1", "Вържи ядките или триците на вързопче. Напълни купа с около 2 литра топла вода и потопи вързопчето.",
                 "Tie the oats or bran into a bundle. Fill a bowl with about 2 litres of warm water and put the bundle in."),
   step("bf-s2", "Мачкай вързопчето с ръце няколко минути, докато се насити, после го остави 15–20 минути, докато водата стане млечна. Извади вързопчето и го изхвърли.",
                 "Work the bundle with your hands for a few minutes until it is saturated, then leave it fifteen to twenty minutes until the water turns milky. Take the bundle out and discard it."),
   step("bf-s3", "Излей разтвора в по-голям съд и добави студена вода, колкото да покрие плата.",
                 "Pour the solution into a larger vessel and add enough cold water to cover the cloth."),
   step("bf-s4", "Сложи сухия мордантиран плат и го омесвай с ръце, после остави 5–10 минути.",
                 "Put the dry mordanted cloth in and work it with your hands, then leave it five to ten minutes."),
   step("bf-s5", "Извади и изплакни с чешмяна вода. Изстискай до влажно, не капещо. Оттук нататък платът е готов за печат или се суши за по-късно.",
                 "Take it out and rinse under the tap. Wring it to damp, not dripping. From here the cloth is ready to print, or dried for later."),
  ]},

 {"code": "soy-milk-bath", "type": "mordant", "output": "none", "scaleBy": "weight",
  "appliesTo": ["cellulose"], "sourceCodes": ["alison-kelly-printing"],
  "name": {"bg": "Баня със соево мляко", "en": "Soy milk bath"},
  "notes": {"bg": "За целулоза. Може след сложния мордант — добавя протеин към плат, който няма — или самостоятелно, като по-безопасен мордант. Сама по себе си държи по-слабо от металните морданти. Неподсладено и без аромат соево мляко, за предпочитане био.",
            "en": "For cellulose. It can follow the compound mordant — adding protein to a fibre that has none — or stand on its own as a safer mordant. Alone it holds less well than a metallic mordant. Unsweetened, unflavoured soy milk, organic for preference."},
  "ingredients": [
   ing("sm-1", "mordant", "absolute", 1000, "ml",
       "Соево мляко, неподсладено и без аромат. Водата отгоре е толкова, че платът да се движи свободно.",
       "Soy milk, unsweetened and unflavoured. Water on top, enough for the cloth to move freely.",
       "seed:soy_milk"),
  ],
  "steps": [
   step("sm-s1", "Сипи соевото мляко в кофа и долей вода, колкото платът да се покрие и да се движи свободно.",
                 "Pour the soy milk into a bucket and top up with enough water for the cloth to be submerged and move freely."),
   step("sm-s2", "Сложи намокрения плат. Провери, че има място да се движи. Остави 12 часа.",
                 "Add the wetted-out cloth. Check there is room for it to move. Leave for twelve hours."),
   step("sm-s3", "Разбърквай внимателно от време на време.",
                 "Agitate and stir gently from time to time."),
   step("sm-s4", "След 12 часа извади плата и го изстискай над кофата. Окачи да изсъхне НАПЪЛНО.",
                 "After twelve hours take the cloth out and wring it over the bucket. Hang it to dry COMPLETELY."),
   step("sm-s5", "Когато е напълно сух, изплакни добре. Оттук нататък е готов за печат или се прибира за по-късно.",
                 "When it is fully dry, rinse well. From here it is ready to print, or stored for later."),
  ]},

 {"code": "iron-bath-dark", "type": "mordant", "output": "none", "scaleBy": "weight",
  "appliesTo": ["cellulose", "protein"], "sourceCodes": ["alison-kelly-printing"],
  "liquorRatio": 20,
  "name": {"bg": "Желязна баня за тъмен резултат", "en": "Iron bath for a dark outcome"},
  "notes": {"bg": "Платът влиза в нея НЕПОСРЕДСТВЕНО преди печат: желязото се окислява бързо във вода и жълти плата. Малко желязо стига много. Повече желязо разяжда коприна и вълна — мери точно. Останалата вода пожълтява след няколко минути и се изхвърля в канала.",
            "en": "The cloth goes in IMMEDIATELY before printing: iron oxidises fast in water and will yellow the cloth. A little goes a very long way. Too much iron damages silk and wool — measure accurately. The leftover water yellows within minutes and is rinsed down the drain."},
  "ingredients": [
   ing("ib-1", "modifier", "percent_wof", None, "g",
       "Железен сулфат. Около 1% за по-наситен резултат, до 2.5% за по-тъмен.",
       "Ferrous sulfate. Around 1% for a more saturated result, up to 2.5% for a darker one.",
       "seed:iron_sulfate", 1, 2.5),
  ],
  "steps": [
   step("ib-s1", "С маска: претегли железния сулфат и го сложи в съда. Добави студената вода и бъркай до пълно разтваряне — може да отнеме минута.",
                 "Wearing a mask: weigh the ferrous sulfate into the vessel. Add the cold water and whisk until the powder is fully dissolved — this may take a minute."),
   step("ib-s2", "С ръкавици: потопи плата и го омесвай с ръце около 15 секунди.",
                 "Wearing gloves: immerse the cloth and work it with your hands for about fifteen seconds."),
   step("ib-s3", "Изстискай внимателно и остави да поизсъхне на рафт или простор. Когато го слагаш за печат, трябва да е влажен, не капещ.",
                 "Wring gently and let it dry a little on a rack or line. When you lay it out to print it should be damp, not dripping wet."),
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
n += merge('seed/substances.json', 'substances', SUBS, '0.7.0')
n += merge('seed/recipes.json', 'recipes', RECIPES, '0.15.0')
print(f'{n} records written.')

"""§13eb: the two paste thickeners, and Nicola Cliffe's three print pastes.

The owner chose Cliffe over Maiwa on 14 September 2026, having read both:
Maiwa's mordant paste is the SAME recipe with the same figures, so nothing is
lost by taking Cliffe, who carries the whole sequence through to the dye bath;
Maiwa's pigment paste has no quantities at all; and Maiwa's ready-to-use paste
is a DIFFERENT recipe chemically — potassium alum kept in solution with vinegar
— which the owner set aside in favour of Cliffe's aluminium acetate.

Maiwa's mixing warnings are folded into the mordant paste's steps: the vessel
four to five times the liquid, the soda ash a little at a time because of the
froth, and the fifteen minutes the gum needs to thicken. Credited alongside
Cliffe — two sources on one record, which §13ea made possible.

NOT written, and each for its own reason:
  - a `paste` process a trial can choose. The vocabulary still says „скоро" and
    that is still true: the diary cannot record a paste print yet. The library
    knowing the recipes and the diary being able to use them are two pieces of
    work, and this is the first.
  - Maiwa's alum-and-vinegar paste as a second variant of 2.3. It is a real
    alternative and it is not this release's.

Run from the repository root:  python3 scripts/merge-print-pastes.py
"""
import json, sys

# ---------------------------------------------------------------- substances
SUBS = [
 {"code": "guar_gum", "category": "binder",
  "name": {"bg": "Гуар гума", "en": "Guar gum"},
  "sourceCodes": ["nicola-cliffe-printing"],
  "typicalUse": {
   "bg": "Сгъстител за печатни пасти. Работи и в кисела среда, затова държи в мордант пастата с оцет. Дава по-плътна паста и по-остър ръб — за ситопечат. Влиза в студен разтвор, по малко, иначе се сбива на бучки.",
   "en": "A thickener for print pastes. It works in an acid bath, which is why it holds in the vinegar mordant paste. Gives a stiffer paste and a crisper edge — for screen printing. Goes into a cold solution a little at a time, or it lumps."}},
 {"code": "cornflour", "category": "binder",
  "name": {"bg": "Царевично нишесте", "en": "Cornflour"},
  "sourceCodes": ["nicola-cliffe-printing"],
  "typicalUse": {
   "bg": "Сгъстител за печатни пасти, сгъстява се на водна баня. Покрива калъпа по-добре от гумите, които се сбиват — затова е за печат с калъп.",
   "en": "A thickener for print pastes, thickened over a water bath. It covers a block better than the gums, which gel together — so it is the one for block printing."}},
]

SOURCE = {"code": "nicola-cliffe-printing", "kind": "book",
          "name": "Printing with Natural Dyes",
          "author": "Nicola Cliffe",
          "note": {"bg": "Ръководство за печат с натурални багрила. Глава 6 дава пастите: мордант паста без багрило, багрилна паста без мордант и готова паста с мордант, всяка с количества и с това какво става след нанасянето.",
                   "en": "A guide to printing with natural dyes. Chapter 6 gives the pastes: a mordant paste with no dye, a dye paste with no mordant, and a ready-to-use paste with a mordant — each with quantities and with what happens to the cloth afterwards."}}

MAIWA = {"code": "maiwa-print-paint", "kind": "course",
         "name": "Print and Paint with Natural Dyes",
         "author": "Maiwa School of Textiles",
         "note": {"bg": "Онлайн курс. Дава същата мордант паста със същите количества като Клиф, а от него са взети предупрежденията при разбъркването. Неговата готова паста с мордант е по друга химия — стипца, държана в разтвор с оцет — и не е избрана за библиотеката.",
                  "en": "An online course. It gives the same mordant paste with the same figures as Cliffe, and its mixing warnings are taken from here. Its ready-to-use mordant paste follows different chemistry — alum kept in solution with vinegar — and was not the one chosen for the library."}}

# ------------------------------------------------------------------ recipes
# ABSOLUTE quantities, as the book gives them: „makes about 200 ml" is a batch,
# not a ratio. A ratio would have meant inventing a basis the book does not
# state, and it also left every figure showing „—" until something was typed
# into the amount field — see §13eb.
def ing(i, role, basis, qty, unit, note_bg, note_en, opts=None, qmin=None, qmax=None):
    line = {"id": i, "roleCode": role, "basis": basis, "unit": unit,
            "note": {"bg": note_bg, "en": note_en}}
    if qty is not None: line["quantity"] = qty
    line["options"] = opts or []
    if qmin is not None: line["quantityMin"], line["quantityMax"] = qmin, qmax
    return line

def step(i, bg, en):
    return {"id": i, "text": {"bg": bg, "en": en}}

RECIPES = [
 # 2.1 — mordant paste, no dye. Cliffe 6.5, enriched with Maiwa's mixing.
 {"code": "mordant-print-paste", "type": "mordant", "output": "none",
  "scaleBy": "raw", "appliesTo": ["cellulose", "protein"],
  "sourceCodes": ["nicola-cliffe-printing", "maiwa-print-paint"],
  "name": {"bg": "Мордант паста за печат", "en": "Mordant print paste"},
  "notes": {"bg": "Прави около 200 мл. Пастата носи морданта, не багрилото: печата се върху немордантиран плат, после платът влиза в багрилната баня и цвят хваща само там, където е печатано. Най-добре с адјективно багрило — субстантивното оцветява и фона. Количествата на Клиф и на Maiwa съвпадат.",
            "en": "Makes about 200 ml. The paste carries the mordant, not the dye: it is printed onto unmordanted cloth, and when the cloth goes into the dye bath only the printed areas take colour. Best with an adjective dye — a substantive one will colour the ground as well. Cliffe's figures and Maiwa's agree."},
  "ingredients": [
   ing("mpp-1", "acid_source", "absolute", 200, "ml",
       "Оцет 5%. Основата на пастата — 200 мл на 20 г стипца.",
       "5% vinegar. The base of the paste — 200 ml to 20 g of alum.",
       [{"id": "mpp-o1", "substanceId": "seed:acetic_acid"}]),
   ing("mpp-2", "mordant", "absolute", 20, "g",
       "Калиева стипца, 20 г. Може да не се разтвори докрай и това е нормално.",
       "Potassium alum, 20 g. It may not all dissolve, and that is normal.",
       [{"id": "mpp-o2", "substanceId": "seed:alum_potassium_12"}]),
   ing("mpp-3", "alkali", "ratio_to_dyestuff", 0.5, "g",
       "Сода, 10 г. Влиза бавно — сместа кипва и се надига.",
       "Soda ash, 10 g. It goes in slowly — the mixture froths and rises.",
       [{"id": "mpp-o3", "substanceId": "seed:soda_ash"}]),
   ing("mpp-4", "thickener", "ratio_to_dyestuff", 0.1, "g",
       "Гуар гума, 2 г. Работи и в кисела среда, затова е тя тук.",
       "Guar gum, 2 g. It works in an acid bath, which is why it is the one here.",
       [{"id": "mpp-o4", "substanceId": "seed:guar_gum"}]),
   ing("mpp-5", "marker", None, None, "g",
       # ONE sentence, and it has to carry both facts: the weigh list shows the
       # first sentence only (§13dx), and „it washes out" in a second sentence
       # would never reach the screen this line exists for.
       "Капка багрилен екстракт, само за да се вижда къде печаташ — този цвят се отмива и не остава в плата.",
       "A drop of dye extract, only so you can see where you are printing — that colour washes out and is not in the finished cloth."),
  ],
  "steps": [
   step("mpp-s1", "Вземи съд поне 4–5 пъти по-голям от течността — сместа ще се надигне.",
                  "Take a vessel at least four to five times the volume of the liquid — the mixture will rise."),
   step("mpp-s2", "Разтвори стипцата в оцета. Бъркай 5–10 минути. Ако не се разтвори всичко, няма страшно.",
                  "Dissolve the alum in the vinegar. Stir for five to ten minutes. If it does not all dissolve, that is fine."),
   step("mpp-s3", "Добавяй содата малко по малко. Ще кипи и ще пени. Спри, когато вече не се образуват мехурчета при разбъркване.",
                  "Add the soda ash a little at a time. It will fizz and froth. Stop when swirling no longer raises bubbles."),
   step("mpp-s4", "Чак когато пенята спадне, добави гумата — наведнъж — и разбъркай. Ако стане на бучки, използвай пасатор.",
                  "Only when the frothing has subsided, add the gum — all at once — and stir. If it lumps, use a stick blender."),
   step("mpp-s5", "Остави около 15 минути да се сгъсти.",
                  "Leave about fifteen minutes to thicken."),
   step("mpp-s6", "Добави капка екстракт, за да виждаш къде печаташ. Нанеси с калъп или през сито върху сухия плат.",
                  "Add a little extract so you can see where you are printing. Apply with a block or through a screen onto the dry cloth."),
   step("mpp-s7", "Остави да изсъхне напълно. Изсуши със сешоар или изглади с ютия.",
                  "Let it dry completely. Use a hairdryer or an iron to be sure it is thoroughly dry."),
   step("mpp-s8", "Неутрализирай във варова баня 10–20 минути според дебелината на плата.",
                  "Neutralise in the calcium carbonate bath for ten to twenty minutes, depending on the thickness of the cloth."),
   step("mpp-s9", "Изпери добре в топла вода, за да излезе сгъстителят, преди платът да влезе в багрилната баня.",
                  "Wash thoroughly in warm water to rinse out the thickener before the cloth goes into the dye bath."),
  ]},

 # 2.2 — dye paste, no mordant. Cliffe 6.2.
 {"code": "dye-print-paste", "type": "paste", "output": "none",
  "scaleBy": "raw", "appliesTo": ["cellulose", "protein"],
  "sourceCodes": ["nicola-cliffe-printing"],
  "name": {"bg": "Багрилна паста без мордант", "en": "Dye print paste, no mordant"},
  "notes": {"bg": "Прави около 200 мл. Нанася се върху предварително мордантиран плат — пастата няма мордант и сама няма да задържи адјективно багрило. Фонът остава без цвят. Пази се около две седмици в затворен съд.",
            "en": "Makes about 200 ml. Printed onto pre-mordanted cloth — the paste has no mordant and will not fix an adjective dye on its own. The ground stays clear. Keeps about two weeks in a closed jar."},
  "ingredients": [
   ing("dpp-1", "dyestuff", "ratio_to_dyestuff", 1, "ml",
       "200 мл багрилен разтвор от извличане, или 5–10 г екстракт, разтворен в 200 мл топла вода. Започвай с по-малко — още екстракт винаги може да се добави.",
       "200 ml of dye solution from an extraction, or 5–10 g of extract dissolved in 200 ml of warm water. Start with less — more extract can always be added."),
   ing("dpp-2", "thickener", None, None, "g",
       "Нишесте 5–10 г за печат с калъп, или гуар гума 2–4 г за ситопечат. Нишестето покрива калъпа по-добре; гумата дава по-остър ръб без разтичане.",
       "5–10 g cornflour for block printing, or 2–4 g guar gum for screen printing. The starch covers a block better; the gum gives a crisper edge with no seeping.",
       [{"id": "dpp-o1", "substanceId": "seed:cornflour"},
        {"id": "dpp-o2", "substanceId": "seed:guar_gum"}]),
  ],
  "steps": [
   step("dpp-s1", "Сипи разтвора в съд с широко гърло.",
                  "Pour the solution into a wide-mouthed jar or beaker."),
   step("dpp-s2", "С НИШЕСТЕ: поръси го, докато бъркаш, после сгъсти на водна баня. Бъркай непрекъснато, докато пастата се сгъсти и стане полупрозрачна — като сос.",
                  "WITH STARCH: sprinkle it in while stirring, then thicken over a water bath. Stir constantly until the paste thickens and turns translucent — like a sauce."),
   step("dpp-s3", "С ГУМА: в студен разтвор, по малко, с усърдно бъркане. Ако стане на бучки, пасатор или прецеждане през ситна цедка.",
                  "WITH GUM: into a cold solution, a little at a time, stirring thoroughly. If it lumps, use a stick blender or push it through a fine sieve."),
   step("dpp-s4", "Нанеси върху мордантирания плат с калъп или през сито.",
                  "Apply to the mordanted cloth with a block or through a screen."),
  ]},

 # 2.3 — ready-to-use dye paste with a mordant. Cliffe 6.4.
 {"code": "dye-mordant-print-paste", "type": "paste", "output": "none",
  "scaleBy": "raw", "appliesTo": ["cellulose", "protein"],
  "sourceCodes": ["nicola-cliffe-printing"],
  "name": {"bg": "Готова паста с мордант", "en": "Ready-to-use dye paste with a mordant"},
  "notes": {"bg": "Прави около 200 мл. Носи и багрилото, и морданта, затова се нанася направо върху немордантиран плат и не следва багрилна баня. Колко екстракт зависи от багрилото — 1–10% обикновено стига; тегли го точно и добавяй на малки стъпки, докато цветът стане какъвто го искаш. Не се пази — прави само колкото ще използваш.",
            "en": "Makes about 200 ml. It carries both the dye and the mordant, so it goes straight onto unmordanted cloth and no dye bath follows. How much extract depends on the dye — 1–10% is usually enough; weigh it accurately and add in small increments until the depth of colour is right. It does not keep — make only what you will use."},
  "ingredients": [
   ing("dmp-1", "dyestuff", "ratio_to_dyestuff", 1, "ml",
       "200 мл багрилен разтвор, или 2–20 г екстракт на прах.",
       "200 ml of dye extract solution, or 2–20 g of extract powder."),
   ing("dmp-2", "mordant", "ratio_to_dyestuff", 0.025, "g",
       "Алуминиев ацетат, 5 г, разтворен в малко гореща вода и оставен да изстине.",
       "Aluminium acetate, 5 g, dissolved in a little hot water and left to cool.",
       [{"id": "dmp-o1", "substanceId": "seed:al_acetate"}]),
   ing("dmp-3", "thickener", "ratio_to_dyestuff", 0.0125, "g",
       "Гума, 2–3 г. За печат с калъп — по-малко гума, повече разтвор, или нишесте вместо гума.",
       "Gum, 2–3 g. For block printing use less gum, more solution, or starch instead of gum.",
       [{"id": "dmp-o2", "substanceId": "seed:guar_gum"},
        {"id": "dmp-o3", "substanceId": "seed:cornflour"}]),
  ],
  "steps": [
   step("dmp-s1", "Разтвори алуминиевия ацетат в малко гореща вода и остави да изстине.",
                  "Dissolve the aluminium acetate in a little hot water and allow it to cool."),
   step("dmp-s2", "Смеси го с багрилния разтвор.",
                  "Mix it into the dye extract solution."),
   step("dmp-s3", "Сгъсти с гумата, с пасатор, за да няма бучки.",
                  "Thicken with the gum, using a stick blender to avoid lumps."),
   step("dmp-s4", "Нанеси и остави да изсъхне напълно.",
                  "Apply, and let the print dry thoroughly."),
   step("dmp-s5", "Пари 15–30 минути.",
                  "Steam for fifteen to thirty minutes."),
   step("dmp-s6", "Неутрализирай във варова баня, после изпери с неутрален сапун.",
                  "Neutralise in the chalk bath, then wash in a pH-neutral soap."),
  ]},
]

def merge(path, key, rows, version):
    d = json.load(open(path, encoding='utf8'))
    have = {r['code'] for r in d[key]}
    added = 0
    for r in rows:
        if r['code'] in have:
            print(f"held  {r['code']} already in {path}")
            continue
        d[key].append(r); added += 1
        print(f"add   {r['code']}")
    if added:
        d['packVersion'] = version
        open(path, 'w', encoding='utf8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
    return added

n = 0
n += merge('seed/sources.json', 'sources', [SOURCE, MAIWA], '11')  # this pack counts in whole numbers
n += merge('seed/substances.json', 'substances', SUBS, '0.6.0')
n += merge('seed/recipes.json', 'recipes', RECIPES, '0.12.0')
print(f'{n} records written.')

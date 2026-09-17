# Language package, step 2 — every text changed in rc68

Generated from the edit itself, not written afterwards. Old values are exactly what rc67 shipped.

Items marked ⚠ are the ones where the edit could have changed the meaning; the reason is given under the table.

## Interface dictionary (`i18n.js`)

| lang | key | before | after |
|---|---|---|---|
| bg | `stock.one [shadowed copy removed]` | Буркан | — (removed) |
| bg | `ref.colour [shadowed copy removed]` | Цвят | — (removed) |
| bg | `ref.col.source [shadowed copy removed]` | От какво | — (removed) |
| bg | `ref.col.conditions [shadowed copy removed]` | Условия | — (removed) |
| bg | `ref.col.colour [shadowed copy removed]` | Цвят | — (removed) |
| bg | `trials.result [shadowed copy removed]` | резултат | — (removed) |
| bg | `fabrics.addPhoto [shadowed copy removed]` | Избери снимка | — (removed) |
| bg | `fabrics.removePhoto [shadowed copy removed]` | Махни снимката | — (removed) |
| bg | `fabrics.photoHint [shadowed copy removed]` ⚠ | Как изглежда платът или дрехата преди работа. Полезно е после, при сравнение. | — (removed) |
| bg | `fabrics.photo [unused, removed]` | Снимка | — (removed) |
| bg | `fabrics.photo [unused, removed]` | Снимка преди | — (removed) |
| en | `stock.one [shadowed copy removed]` | Jar | — (removed) |
| en | `ref.colour [shadowed copy removed]` | Colour | — (removed) |
| en | `ref.col.source [shadowed copy removed]` | From | — (removed) |
| en | `ref.col.conditions [shadowed copy removed]` | Conditions | — (removed) |
| en | `ref.col.colour [shadowed copy removed]` | Colour | — (removed) |
| en | `trials.result [shadowed copy removed]` | result | — (removed) |
| en | `fabrics.addPhoto [shadowed copy removed]` | Choose a photo | — (removed) |
| en | `fabrics.removePhoto [shadowed copy removed]` | Remove photo | — (removed) |
| en | `fabrics.photoHint [shadowed copy removed]` ⚠ | How the cloth or garment looked before the work. Useful later, for comparison. | — (removed) |
| en | `fabrics.photo [unused, removed]` | Photo | — (removed) |
| en | `fabrics.photo [unused, removed]` | Photo before | — (removed) |
| bg | `fabrics.photoHint` ⚠ | Как е изглеждал платът преди работа. Полезно е повече, отколкото звучи. | Как е изглеждал платът или дрехата преди работа. Полезно е после, за сравнение. |
| en | `fabrics.photoHint` ⚠ | What the cloth looked like before the work. More useful than it sounds. | What the cloth or garment looked like before the work. Useful later, for comparison. |
| bg | `materials.sub` | Багрила, танини, морданти, pH модификатори. | Багрила, танини, закрепващи средства, pH модификатори. |
| bg | `materials.emptyHint` | Багрила, танини, морданти, pH модификатори и помощни вещества. | Багрила, танини, закрепващи средства, pH модификатори и помощни вещества. |
| bg | `substances.emptyHint` | Морданти, танини, багрила, pH модификатори. Веществото е знание — бурканът е наличност. | Закрепващи средства, танини, багрила, pH модификатори. Веществото е знание — бурканът е наличност. |
| bg | `substances.purposePlaceholder` | Препарат за изпиране на целулоза преди мордантиране. | Препарат за изпиране на целулоза преди обработка със закрепващо средство. |
| bg | `ref.approxSwatchLong` | Мострата е ориентировъчна. Този запис не е измерван — цветът идва от собственото измерване на растението при същия мордант ({from}), затова се чете като посока, не като стойност. | Мострата е ориентировъчна. Този запис не е измерван — цветът идва от собственото измерване на растението при същото закрепващо средство ({from}), затова се чете като посока, не като стойност. |
| bg | `fabrics.warn.mixed` ⚠ | Смесена целулоза и протеин — двете части приемат мордант и цвят различно. Един мордантен маршрут няма да свърши работа за целия плат. | Смесена целулоза и протеин — двете части приемат закрепващото средство и цвета различно. Една и съща обработка няма да свърши работа за целия плат. |
| bg | `tools.finishing` | След мордантирането е нужна варова баня — тя свързва морданта, не просто регулира pH. | След обработката със закрепващо средство е нужна варова баня — тя свързва морданта, а не просто регулира pH. |
| bg | `tools.when.alum` | Преди мордантиране на целулозни тъкани, когато си приготвяш сам ацетат. | Преди обработка на целулозни тъкани със закрепващо средство, когато сам приготвяш ацетата. |
| bg | `recipes.blanketKind.mordant` | мордантно | с мордант |
| bg | `recipes.followOnHint` | Не е съвет, а част от рецептата. Варовата баня свързва морданта. | Не е съвет, а част от рецептата. Варовата баня свързва закрепващото средство. |
| bg | `chains.emptyHint` | Например: очистване → танин → мордант за целулоза. Въвеждаш теглото веднъж и получаваш цялата подготовка наред. | Например: изпиране → танин → мордант за целулоза. Въвеждаш теглото веднъж и получаваш цялата подготовка наред. |
| bg | `recipes.producesHint` ⚠ | Рецептата не се прилага върху плат, а прави вещество, което после се използва. Приготвянето и мордантирането са два процеса. | Рецептата не се прилага върху плат, а прави вещество, което после се използва. Приготвянето на средството и обработката на плата с него са два отделни процеса. |
| bg | `library.phWarn` | Твърдата вода, самото растение и мордантът също местят pH. Дълга баня рядко свършва там, където е започнала — премервай, а не предполагай. | Твърдата вода, самото растение и закрепващото средство също местят pH. Дълга баня рядко свършва там, където е започнала — премервай, а не предполагай. |
| bg | `plants.dyeClassHint` ⚠ | Субстантивното хваща без мордант, адективното иска. | Субстантивните багрила могат да се свържат с влакното без закрепващо средство. Адективните се нуждаят от него, за да се свържат трайно. |
| bg | `plants.coloursHint` | Какво може да даде това багрило при различни условия. Конкретните комбинации с тъкан и мордант идват в Справочника. | Какво може да даде това багрило при различни условия. Конкретните комбинации с тъкан и закрепващо средство са в Справочника. |
| bg | `dash.waiting` | {name} стои мордантиран от {n} дни. | {name} чака с мордант от {n} дни. |
| bg | `trials.readyToWork` | Готови за работа · мордансирани | Готови за работа · с мордант |
| bg | `trials.mordantedAgo` | мордансиран преди {n} дни | с мордант от {n} дни |
| bg | `trials.enhancementsWhat` | Допълнителни обработки и слоеве, които променят или усилват отпечатъка — мордансирано или предварително багрено одеало, третирани растения, кисела пара, желязна обработка. | Допълнителни обработки и слоеве, които променят или усилват отпечатъка — одеало с мордант или предварително багрено одеало, третирани растения, кисела пара, желязна обработка. |
| bg | `about.reference` ⚠ | Справочната част идва заредена: растения с техните части, химия и цветове, комбинации „това върху това с този мордант“, рецепти, вещества, техники и калкулатори. Тя е знание, което важи и без твоите записи, и се обновява отделно от тях. | Справочната част идва заредена: растения с техните части, химия и цветове; комбинации „това растение върху това влакно с това закрепващо средство“; рецепти, вещества, техники и калкулатори. Тя е знание, което важи и без твоите записи, и се обновява отделно от тях. |
| bg | `fabrics.curedFor` | Мордантиран преди {n} дни | С мордант от {n} дни |
| bg | `batch.sub` ⚠ | Изберете няколко, когато например правите едно изваряване или една байцваща баня за няколко плата наведнъж. Банята е едно събитие, а не по едно на парче. | Избери няколко, когато например правиш едно изпиране или една баня със закрепващо средство за няколко плата наведнъж. Банята е едно събитие, а не по едно на парче. |
| bg | `batch.warnUnwashed` | {n} от избраните не са изпрани ({list}). Мордантирането обикновено се прави върху изпран плат. | {n} от избраните не са изпрани ({list}). Обработката със закрепващо средство обикновено се прави върху изпран плат. |
| bg | `fabrics.splitHint` | Когато едно парче тръгне по свой път — изпрано, мордантирано — то става отделен запис със своя история. Останалите остават в партидата. | Когато едно парче тръгне по свой път — изпрано, с мордант — то става отделен запис със своя история. Останалите остават в партидата. |
| bg | `dashboard.sub` ⚠ | Какво има в кутиите, какво предстои, какво липсва в справочника. | Текуща работа, какво е в сезон и тъканите по етап. |
| bg | `trials.working` ⚠ | На работа | Текуща работа |
| en | `dashboard.sub` ⚠ | What is in the boxes, what is next, what the reference is missing. | Work under way, what is in season and your cloth by stage. |
| en | `trials.working` ⚠ | In hand | Work under way |
| en | `plants.dyeClassHint` ⚠ | Substantive holds without a mordant; adjective needs one. | Substantive dyes can bind to the fibre without a mordant. Adjective dyes need one to bind lastingly. |
| en | `about.reference` ⚠ | The reference half arrives filled: plants with their parts, chemistry and colours; combinations of „this on that with this mordant"; recipes, substances, techniques and calculators. It is knowledge that holds whether or not you have recorded anything, and it is updated separately from your own records. | The reference library comes preloaded: plants with their parts, chemistry and colours; combinations of “this plant on this fibre with this mordant”; recipes, substances, techniques and calculators. It holds whether or not you have recorded anything, and it is updated separately from your own records. |
| en | `help.recipes` | Recipes are roles and proportions, not brands. The working view shows the quantities in large figures, and where a recipe scales you enter the weight of cloth or the amount of raw material and the figures follow. | Recipes are roles and proportions, not brands. The working view shows the quantities in large figures, and where a recipe scales you enter the weight of cloth or the amount of raw material and the quantities are recalculated. |
| en | `help.plants` | Plants is the reference: each plant has parts, and the parts carry temperatures, ratios and gathering months. The combinations answer „oak leaves on cotton with aluminium acetate — what should I expect". | Plants is the reference: each plant has parts, and the parts carry temperatures, ratios and gathering months. The combinations answer “oak leaves on cotton with aluminium acetate — what should I expect?” |
| en | `backup.badFile` | That is not a Багра backup file. | That is not a Rubia backup file. |
| bg | `nav.mainLabel [new]` | — | Основна навигация |
| en | `nav.mainLabel [new]` | — | Main navigation |
| bg | `units.gsmMetric [new]` | — (was written into units.js) | г/м² |
| en | `units.gsmMetric [new]` | — (was „г/м²" from units.js) | g/m² |
| en | `dash.waiting` | {name} has been mordanted and waiting for {n} days. | {name} has been waiting, mordanted, for {n} days. |

## Vocabulary labels (`vocab.js`)

| before | after |
|---|---|
| `V('fabric_state', 'mordanted', 'мордантиран',  'mordanted', 3),` | `V('fabric_state', 'mordanted', 'с мордант',    'mordanted', 3),` |
| `V('fabric_action', 'mordant',    'мордантиране',    'mordanting', 3),` | `V('fabric_action', 'mordant',    'обработка с мордант', 'mordanting', 3),` |
| `само по себе си може да замести или намали байцването.` | `само по себе си може да замести закрепващото средство или да намали нуждата от него.` |
| `V('enhancement', 'cloth_mordant',      'платът е мордантиран',        'cloth was mordanted', 1),` | `V('enhancement', 'cloth_mordant',      'платът е с мордант',          'cloth was mordanted', 1),` |
| `V('medium_where', 'mordant_bath', 'мордантна баня',  'mordant bath', 2),` | `V('medium_where', 'mordant_bath', 'баня с мордант',  'mordant bath', 2),` |

## Seed data

| record | field | before | after |
|---|---|---|---|
| plants `rubus_fruticosus` | `nameBotanical`, `photoCredit.taxon` | Rubus fruticosus L. (в практиката често Rubus fruticosus agg.) | Rubus fruticosus L. |
| plants `rubus_fruticosus` | `description` | — | + „В практиката под това име често се разбира сборният вид Rubus fruticosus agg." / „In practice the name is often used for the aggregate species, Rubus fruticosus agg." |
| plants `dahlia_pinnata` | `nameBotanical`, `photoCredit.taxon` | Dahlia pinnata Cav. (градинските далии са сложна културна група; резултатът зависи от сорта) | Dahlia pinnata Cav. |
| plants `dahlia_pinnata` | section „Как се държи" | — | + „Градинските далии са сложна културна група и резултатът зависи от сорта." / „Garden dahlias are a complex cultivated group, and the result depends on the cultivar." (first sentence) |
| plants `rheum_rhabarbarum` | `nameBotanical`, `photoCredit.taxon` | Rheum rhabarbarum L. (други Rheum spp., особено азиатски видове, могат да са по-силни багрила) | Rheum rhabarbarum L. — the comment is NOT moved: „Как се държи" already says that some Asian Rheum species are richer in dye anthraquinones |
| glossary `mordant` | `term.bg` | Мордант и байцване | Мордант (закрепващо средство) |
| glossary `mordant` ⚠ | `definition.bg` | Мордантът е металната сол — най-често алуминиева — която подпомага свързването на багрилото с влакното. Байцването е самото действие: тъканта се обработва с него преди или по време на багренето. … | Мордантът е закрепващо средство — най-често алуминиева сол — което подпомага свързването на багрилото с влакното. Обработката със закрепващо средство (наричана още мордантиране или байцване) се прави преди или по време на багренето. … (the rest unchanged) |
| glossary `mordant` | `aliases` | байц, байцване, мордантиране, стипцоване, mordanting | + закрепващо средство |
| glossary `cellulose_protein` | `definition.bg` | …приемат цвят охотно и се байцват по-просто. | …приемат цвят охотно и обработката им със закрепващо средство е по-проста. |
| glossary `scouring` | `term.bg` | Предварително почистване (scouring) | Предварително изпиране |
| glossary `scouring` | `definition.bg`, first sentence | …преди мордантиране и багрене. | …преди обработката със закрепващо средство и багренето. |
| glossary `substantive_adjective` ⚠ | `definition.bg`, first two sentences | Субстантивното багрило се хваща за влакното само, без байц. Адективното не се хваща — нужен му е мордант като мост между влакното и цвета. | Субстантивното багрило се свързва с влакното без закрепващо средство. Адективното не се свързва трайно само — нужен му е мордант като мост между влакното и цвета. |

Pack versions: plants 0.12.0 → 0.12.1, glossary 0.2.0 → 0.2.1, manifest in step.

**The photo taxon had the same Bulgarian comment as the botanical name.** It was hidden only because the caption prints the taxon when it DIFFERS from the name. Cleaning the name alone would have put the comment under the photograph. Both were cleaned.

## Code

| file | what | why |
|---|---|---|
| `modules/batch.js` | six reads of `name.bg` → `text(name)` | recipe and chain names were drawn in Bulgarian on the English batch screen |
| `modules/batch.js` | weight unit „г" → `t('tools.grams')` | Cyrillic unit on the English screen |
| `modules/chains.js`, `modules/recipes.js` | ingredient option note `note.bg` → `text(note)` | same fault, in the recipe and chain editors |
| `units.js` | metric gsm symbol from `t('units.gsmMetric')` | „г/м²" on the English screen; Bulgarian unchanged |
| `app.js` | `aria-label` of both navigations from `t('nav.mainLabel')` | written into `index.html` in Bulgarian |
| `backup.js` | error message „not a Багра backup file" → „unrecognised format" | appended to the alert in either language |

## Where the meaning may have moved ⚠

- **`dashboard.sub`** — Meaning narrowed on purpose: „what the reference is missing" is gone, because the home screen has no such panel. It shows work under way, the season panel and cloth by stage.
- **`trials.working`** — Different word, same section. „In hand" / „На работа" become „Work under way" / „Текуща работа", parallel to „Finished work". „In progress" was not used: it already names a planned pigment batch and an unfinished trial.
- **`plants.dyeClassHint`** — Adds „lastingly" / „трайно". It is the owner's proposed wording made precise — an adjective dye may take up weakly without a mordant — and it is a scientific claim: marked for the scientific audit.
- **`fabrics.photoHint`** — The live text was replaced by the fuller one that sat shadowed above it: „or garment" and „for comparison" come back, „more useful than it sounds" goes.
- **`fabrics.warn.mixed`** — „One mordanting route" became „една и съща обработка" in Bulgarian — broader: it now reads as any treatment, which is what the warning means, but it is wider than before.
- **`recipes.producesHint`** — Clarified, not changed: „preparing and mordanting" is spelled out as preparing the agent and treating the cloth with it.
- **`batch.sub`** — „Изваряване" (a boil scour) became „изпиране" (the approved term). The boil is a kind of scour, and the specific nuance is lost in Bulgarian. The formal „Изберете" became „Избери", as everywhere else in the application.
- **`about.reference`** — „This on that with this mordant" is spelled out as „this plant on this fibre with this mordant". A combination also names a part and a process, so the phrase is an example, not a definition.
- **glossary `mordant`** — the Bulgarian term now carries „(закрепващо средство)", and „байцване" is named as another word for the act rather than the act's own name.
- **glossary `substantive_adjective`** — „не се хваща" became „не се свързва трайно само". „Трайно" is a claim about fastness. Marked for the scientific audit. The English definition says something different again (it names indigo as substantive); not touched here.

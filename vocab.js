// vocab.js — controlled vocabularies (§13.1) and band definitions (§13.7).
//
// The code is the data; the label is looked up per language at render time.
// Codes never change once published, because they travel inside reference
// packs. Adding a term is a data change, not a code change — these defaults
// are seeded into the `vocabulary` store on first run and are editable there.

export const DIMENSIONS = [
  'fibre_class', 'fibre', 'fabric_form', 'fabric_structure', 'fabric_state',
  'fabric_action',
  'plant_part', 'chemistry_class', 'chemistry_level', 'plant_role',
  'compositional_role', 'plant_type', 'habitat', 'extraction_mode', 'recipe_output', 'fastness', 'toxicity_level',
  'precaution',
  'material_category', 'mordant_type', 'tannin_type', 'colour_effect',
  'dye_class', 'recipe_type', 'ingredient_role', 'basis', 'basis_refers_to',
  'process', 'enhancement', 'bundle_role', 'step_type', 'medium_where',
  'placement_condition', 'facing', 'print_quality', 'confidence',
  'technique_category', 'assessment', 'water_source', 'season',
  'trial_status', 'trial_stage',
];

const V = (dimension, code, bg, en, order = 0, description = null) =>
  ({ key: dimension + ':' + code, dimension, code, label: { bg, en }, order, description });

export const VOCABULARY = [
  // --- fibre -------------------------------------------------------------
  V('fibre_class', 'cellulose',     'целулозно',     'cellulose', 1),
  V('fibre_class', 'protein',       'протеиново',    'protein', 2),
  V('fibre_class', 'mixed',         'смесено',       'mixed', 3),
  V('fibre_class', 'part_synthetic','частично синт.','part synthetic', 4),

  V('fibre', 'cotton',   'памук',    'cotton', 1),
  V('fibre', 'linen',    'лен',      'linen', 2),
  V('fibre', 'hemp',     'коноп',    'hemp', 3),
  V('fibre', 'ramie',    'рами',     'ramie', 4),
  V('fibre', 'viscose',  'вискоза',  'viscose', 5),
  V('fibre', 'silk',     'коприна',  'silk', 6),
  V('fibre', 'wool',     'вълна',    'wool', 7),
  V('fibre', 'elastane', 'еластан',  'elastane', 8),
  V('fibre', 'polyester','полиестер','polyester', 9),

  // --- fabric ------------------------------------------------------------
  V('fabric_form', 'garment',   'дреха',       'garment', 1),
  V('fabric_form', 'scarf',     'шал',         'scarf', 2),
  V('fabric_form', 'cut_piece', 'парче плат',  'cut piece', 3),
  V('fabric_form', 'roll',      'руло',        'roll', 4),

  V('fabric_structure', 'plain',     'обикновена сплитка',      'plain weave', 1),
  V('fabric_structure', 'crepe',     'креп',                    'crepe', 2),
  V('fabric_structure', 'jersey',    'трико / плетиво',         'jersey / knit', 3),
  V('fabric_structure', 'twill',     'кепър',                   'twill', 4),
  V('fabric_structure', 'satin',     'сатен',                   'satin', 5),
  V('fabric_structure', 'oxford',    'оксфорд',                 'oxford', 6),
  V('fabric_structure', 'poplin',    'поплин',                  'poplin', 7),
  V('fabric_structure', 'canvas',    'канвас / брезент',        'canvas', 8),
  V('fabric_structure', 'flannel',   'фланел',                  'flannel', 9),
  V('fabric_structure', 'muslin',    'муселин',                 'muslin', 10),
  V('fabric_structure', 'jacquard',  'жакард',                  'jacquard', 11),
  V('fabric_structure', 'denim',     'деним / дънков плат',     'denim', 12),
  V('fabric_structure', 'batiste',   'батиста',                 'batiste', 13),
  V('fabric_structure', 'terry',     'хавлиен плат',            'terry cloth', 14),
  V('fabric_structure', 'velvet',    'кадифе',                  'velvet', 15),
  V('fabric_structure', 'corduroy',  'рипсено кадифе',          'corduroy', 16),
  V('fabric_structure', 'voile',     'воал',                    'voile', 17),
  V('fabric_structure', 'gauze',     'марля',                   'gauze', 18),
  V('fabric_structure', 'other',     'друго',                   'other', 19),

  // The boxes on the shelf, in order (§3, A.1).
  //
  // `tanned` is gone (§13bd). Tannin on cellulose is a route, an alternative to
  // aluminium acetate — a tanned piece may go to eco print, to a paste print,
  // wait for alum, or be finished as it is. That is not a stop on the way
  // anywhere, so it is not a box: it is a treatment the piece carries, and it
  // lives in `fabric_action` below. Nothing was ever written with it.
  //
  // Three of these are boxes she physically sorts into; `dyed` and `finished`
  // are states of the piece rather than shelves, and are written by a trial.
  V('fabric_state', 'unwashed',  'неизпран',     'unwashed', 1),
  V('fabric_state', 'scoured',   'изпран',       'scoured', 2),
  V('fabric_state', 'mordanted', 'мордантиран',  'mordanted', 3),
  V('fabric_state', 'dyed',      'набагрен',     'dyed', 4),
  V('fabric_state', 'finished',  'завършен',     'finished', 5),

  // What was done to a piece (§13bd). The first eight are chosen from the chip
  // row on a group action; `dye` and `finish` are written by a trial and are
  // never offered, which is why `MANUAL_ACTIONS` in migrate-actions.js stops
  // at eight rather than listing all ten.
  //
  // Only `wash`, `mordant`, `dye` and `finish` move a piece between boxes. The
  // rest are carried as labels, because an iron afterbath does not take a dyed
  // piece off the dyed shelf and tanning does not put a piece on the mordanted
  // one.
  V('fabric_action', 'wash',       'изпиране',        'washing', 1),
  V('fabric_action', 'tannin',     'танин',           'tannin', 2),
  V('fabric_action', 'mordant',    'мордантиране',    'mordanting', 3),
  V('fabric_action', 'neutralise', 'неутрализиране',  'neutralising', 4),
  V('fabric_action', 'iron',       'желязна баня',    'iron bath', 5),
  V('fabric_action', 'soy',        'соево мляко',     'soy milk', 6),
  V('fabric_action', 'bleach',     'избелване',       'bleaching', 7),
  V('fabric_action', 'other',      'друго',           'other', 8),
  V('fabric_action', 'dye',        'багрене',         'dyeing', 9),
  V('fabric_action', 'finish',     'приключване',     'finishing', 10),

  // --- plants ------------------------------------------------------------
  V('plant_part', 'leaf',   'лист',     'leaf', 1),
  V('plant_part', 'bark',   'кора',     'bark', 2),
  V('plant_part', 'root',   'корен',    'root', 3),
  V('plant_part', 'flower', 'цвят',     'flower', 4),
  V('plant_part', 'fruit',  'плод',     'fruit', 5),
  V('plant_part', 'hull',   'обвивка',  'hull', 6),
  V('plant_part', 'gall',   'шикалка',  'gall', 7),
  V('plant_part', 'seed',   'семе',     'seed', 8),
  V('plant_part', 'shell',  'черупка',  'shell', 9),
  // Cutch and sappanwood are made from the wood at the centre of the trunk,
  // not from the bark — a distinction the audit corrected and the vocabulary
  // could not express (§13aw).
  V('plant_part', 'heartwood', 'сърцевинна дървесина', 'heartwood', 10),
  V('plant_part', 'whole',  'цяло',     'whole plant', 11),

  // Tannins, without saying which kind (§13ba). The audit reports „high
  // tannins" — the level, not the subtype — and choosing gallo, ellagi or
  // condensed on its behalf would add a claim its sources never made. Where the
  // subtype IS known, the three below say it.
  V('chemistry_class', 'tannin',         'танини',       'tannins', 0.5,
    { bg: 'Танини, без да се уточнява кой вид — записано е нивото, не подвидът.',
      en: 'Tannins, with the kind unspecified — the level is known, the subtype is not.' }),
  V('chemistry_class', 'tannin_gallo',   'галотанини',   'gallotannins', 1),
  V('chemistry_class', 'tannin_ellagi',  'елаготанини',  'ellagitannins', 2),
  V('chemistry_class', 'tannin_cond',    'кондензирани танини', 'condensed tannins', 3),
  V('chemistry_class', 'anthocyanin',    'антоцианини',  'anthocyanins', 4),
  V('chemistry_class', 'flavonoid',      'флавоноиди',   'flavonoids', 5),
  // Coreopsis and its relatives owe their oranges to chalcones and aurones
  // rather than to flavonoids in general; folding them together loses the
  // distinction that explains why the colour behaves as it does.
  V('chemistry_class', 'chalcone',       'халкони',      'chalcones', 5.1),
  V('chemistry_class', 'aurone',         'аурони',       'aurones', 5.2),
  // Anthraquinones were absent, and they are the chemistry of madder's alizarin
  // and purpurin, buckthorn's emodin, henna's lawsone and cochineal — including
  // all four plants marked at heightened care, which are marked for exactly this
  // reason. `quinone` would have swallowed them and lost the distinction that
  // matters most in the reddest corner of the library.
  V('chemistry_class', 'anthraquinone', 'антрахинони', 'anthraquinones', 0),
  V('chemistry_class', 'quinone',        'хинони',       'quinones', 6),
  V('chemistry_class', 'carotenoid',     'каротеноиди',  'carotenoids', 7),
  V('chemistry_class', 'indigoid',       'индигоиди',    'indigoids', 8),
  V('chemistry_class', 'betalain',       'беталаини',    'betalains', 9),
  V('chemistry_class', 'alkaloid',       'алкалоиди',    'alkaloids', 10),

  V('chemistry_level', 'trace',    'следи',     'trace', 1),
  V('chemistry_level', 'moderate', 'умерено',   'moderate', 2),
  V('chemistry_level', 'high',     'високо',    'high', 3),
  V('chemistry_level', 'dominant', 'доминиращо','dominant', 4),

  V('plant_role', 'dye',                 'багрилно',   'dye plant', 1),
  V('plant_role', 'ecoprint',            'еко принт',  'eco print', 2),
  // The owner did not know what this meant, which is a fault in the label and
  // not in her: a term that needs explaining must carry the explanation where
  // it is shown (§13aw). A role says what a plant is FOR, which is why this is
  // not chemistry: chemistry says what is inside a part.
  V('plant_role', 'mordant_accumulator', 'акумулатор', 'mordant accumulator', 3,
    { bg: 'Растение, което трупа алуминий в тъканите си, така че само по себе си може да замести или намали байцването.',
      en: 'A plant that accumulates aluminium in its tissue, so it can stand in for a mordant or reduce how much is needed.' }),

  // Eco-print specific and absent from most references (§4).
  V('compositional_role', 'shape_printer', 'оформящо',      'shape printer', 1),
  V('compositional_role', 'filler',        'фон и текстура','texture filler', 2),
  V('compositional_role', 'resist',        'резист',        'resist', 3),

  // What matters to a dyer is whether the plant is within reach, not where the
  // money went: growing it, finding it locally, or having it shipped in.
  // What the plant IS, not what the owner has (§13ay).
  //
  // `availability` used to sit here with values like „сам го отглеждам" — a
  // sentence about the owner, on a record that ships to other people in a seed
  // pack. The same fault „искам го" had in §11b, and it is gone.
  //
  // Growth form is one value, never two. Half the audit rows arrived as
  // „Храст / малко дърво", and a field that accepts a slash stops being a field
  // and becomes prose the filter cannot read. The nuance belongs in „Как се
  // държи"; here the plant is a shrub.
  V('plant_type', 'tree',     'дърво',     'tree', 1),
  V('plant_type', 'shrub',    'храст',     'shrub', 2),
  V('plant_type', 'subshrub', 'полухраст', 'subshrub', 3),
  V('plant_type', 'herb',     'тревисто',  'herbaceous', 4),

  // Three, not four. „Градинско" and „култивирано" arrived together on fifteen
  // of fifty-seven rows, and two values that always travel as a pair are one
  // value wearing two names. Habitat may hold several: rue really is both wild
  // and grown, and those are two truths rather than one hesitation.
  V('habitat', 'wild',     'диворастящо', 'wild', 1),
  V('habitat', 'garden',   'градинско',   'garden', 2),
  V('habitat', 'imported', 'вносно',      'imported', 3),

  // How the colour is got out of the part (§13az).
  //
  // Temperature alone could not say this. Woad, Japanese indigo and alkanet
  // have no extraction temperature — not an unknown one, none: the ordinary
  // "simmer it in water" schema does not apply to them at all, and leaving the
  // field empty said "nobody has measured it yet", which is a different and
  // false statement.
  V('extraction_mode', 'decoction', 'гореща отвара', 'hot decoction', 1,
    { bg: 'Обичайното: частта се вари или се държи гореща във вода.',
      en: 'The ordinary way: the part is simmered or held hot in water.' }),
  V('extraction_mode', 'cold', 'студена', 'cold extraction', 2,
    { bg: 'Извлича се на стайна температура; нагряването разваля цвета.',
      en: 'Extracted at room temperature; heat spoils the colour.' }),
  V('extraction_mode', 'solvent', 'с разтворител', 'solvent extraction', 3,
    { bg: 'Багрилото не е водоразтворимо — извлича се със спирт или масло.',
      en: 'The dye is not water soluble — alcohol or oil is used instead.' }),
  V('extraction_mode', 'vat', 'редукционна вана', 'reduction vat', 4,
    { bg: 'Индигов процес: багрилото се редуцира, а цветът се появява на въздух.',
      en: 'An indigo process: the dye is reduced, and the colour appears in air.' }),

  V('fastness', 'unknown',   'неизвестно', 'unknown', 0),
  V('fastness', 'poor',      'слаба',      'poor', 1),
  V('fastness', 'moderate',  'умерена',    'moderate', 2),
  V('fastness', 'good',      'добра',      'good', 3),
  V('fastness', 'excellent', 'отлична',    'excellent', 4),

  // --- materials ---------------------------------------------------------
  V('material_category', 'dyestuff',  'багрило',        'dyestuff', 1),
  V('material_category', 'tannin',    'танин',          'tannin', 2),
  V('material_category', 'mordant',   'мордант',        'mordant', 3),
  V('material_category', 'modifier',  'pH модификатор', 'pH modifier', 4),
  V('material_category', 'auxiliary', 'помощно',        'auxiliary', 5),

  V('mordant_type', 'alum_potassium',  'калиева стипца',    'potassium alum', 1),
  V('mordant_type', 'alum_acetate',    'алуминиев ацетат',  'aluminium acetate', 2),
  V('mordant_type', 'alum_sulfate',    'алуминиев сулфат',  'aluminium sulfate', 3),
  V('mordant_type', 'iron',            'желязо',            'iron', 4),
  V('mordant_type', 'titanium_oxalate','титанов оксалат',   'titanium oxalate', 5),
  V('mordant_type', 'copper',          'мед',               'copper', 6),
  V('mordant_type', 'symplocos',       'симплокос',         'symplocos', 7),

  V('unit', 'g',  'г',  'g', 1),
  V('unit', 'kg', 'кг', 'kg', 2),
  V('unit', 'ml', 'мл', 'ml', 3),
  V('unit', 'l',  'л',  'L', 4),

  V('tannin_type', 'gallo',    'галотанин',   'gallotannin', 1),
  V('tannin_type', 'ellagi',   'елаготанин',  'ellagitannin', 2),
  V('tannin_type', 'condensed','кондензиран', 'condensed', 3),

  V('colour_effect', 'brightening', 'изсветлява', 'brightening', 1),
  V('colour_effect', 'saddening',   'потъмнява',  'saddening', 2),
  V('colour_effect', 'darkening',   'зачерня',    'darkening', 3),
  V('colour_effect', 'warming',     'затопля',    'warming', 4),

  // Substantive bonds without a mordant; adjective does not (§8.0).
  V('dye_class', 'substantive', 'субстантивно', 'substantive', 1),
  V('dye_class', 'adjective',   'адективно',    'adjective', 2),

  // --- recipes -----------------------------------------------------------
  V('recipe_type', 'scour',    'изпиране',   'scouring', 1),
  V('recipe_type', 'tannin',   'танин',      'tannin', 2),
  V('recipe_type', 'mordant',  'мордант',    'mordant', 3),
  V('recipe_type', 'dye',      'багрене',    'dyeing', 4),
  V('recipe_type', 'ecoprint', 'еко принт',  'eco print', 5),
  V('recipe_type', 'pigment',  'пигмент',    'pigment', 6),
  V('recipe_type', 'paste',    'багрилна паста', 'dye paste', 7),
  V('recipe_type', 'blanket',  'одеяло',     'blanket', 8),

  // What a recipe PRODUCES, which is a different question from what it is for.
  //
  // It settles two things with one field. First, the middle link of a pigment
  // chain — solution → PIGMENT → watercolour — had nowhere to be declared, so a
  // recipe could not say it makes a thing the next recipe consumes (§13bv).
  //
  // Second, and the reason it is a vocabulary rather than a boolean: it tells a
  // recipe that is WORKED from one that is only READ. A pigment recipe yields
  // batches and is logged; a watercolour recipe is followed and not recorded,
  // because the owner does not count watercolours (§13bx). Without something
  // saying so, a person hunts for where to log the watercolour they just made
  // and finds nothing — and absence of a button is not an answer.
  V('recipe_output', 'none',     'нищо за записване', 'nothing recorded', 1,
    { bg: 'Рецепта, която се чете и следва, но не се води. Няма записи от нея.',
      en: 'A recipe that is read and followed but not logged. It keeps no records.' }),
  V('recipe_output', 'pigment',  'пигмент',    'pigment', 2,
    { bg: 'Произвежда пигмент. Всяко правене е партида със свой запис.',
      en: 'Produces a pigment. Each making is a batch with a record of its own.' }),
  V('recipe_output', 'extract',  'извлек',     'extract', 3,
    { bg: 'Произвежда багрилен извлек, който влиза в следваща рецепта.',
      en: 'Produces a dye extract that feeds the next recipe.' }),

  V('ingredient_role', 'tannin',           'танин',              'tannin', 1),
  V('ingredient_role', 'mordant',          'мордант',            'mordant', 2),
  V('ingredient_role', 'dyestuff',         'багрило',            'dyestuff', 3),
  V('ingredient_role', 'alkali',           'алкали',             'alkali', 4),
  V('ingredient_role', 'acid_source',      'киселина',           'acid', 5),
  V('ingredient_role', 'surfactant',       'сапун / препарат',   'soap or detergent', 6),
  V('ingredient_role', 'modifier',         'модификатор',        'modifier', 7),
  V('ingredient_role', 'aluminium_source', 'алуминиев източник', 'aluminium source', 8),
  V('ingredient_role', 'sodium_source',    'натриев източник',   'sodium source', 9),
  V('ingredient_role', 'assistant',        'помощно',            'assistant', 10),

  V('basis', 'percent_wof',      '% WOF',            '% WOF', 1),
  V('basis', 'percent_of_bath',  '% от банята',      '% of bath', 2),
  V('basis', 'grams_per_litre',  'г/л',              'g/L', 3),
  V('basis', 'ratio_to_dyestuff','спрямо багрилото', 'ratio to dyestuff', 4),
  V('basis', 'absolute',         'абсолютно',        'absolute', 5),

  // The threefold trap: 5–8% of finished acetate vs 15–20% of raw alum (§5.1).
  V('basis_refers_to', 'finished_product', 'готов продукт', 'finished product', 1),
  V('basis_refers_to', 'raw_input',        'суровина',      'raw input', 2),

  // --- process -----------------------------------------------------------
  V('process', 'immersion', 'потапящо багрене', 'immersion dyeing', 1),
  V('process', 'ecoprint',  'еко принт',        'eco print', 2),
  // Paste printing needs a thickener, a screen and a fixing step this app does
  // not yet model, so offering it would promise more than it delivers.
  V('process', 'paste',     'печат с паста (скоро)', 'paste print (not yet)', 3),

  // The seven enhancements, layered rather than exclusive (§8.0).
  // Named after what one does, not after the chemistry behind it. "Adjective
  // carrier blanket" is precise and unusable at the bench; "blanket soaked in
  // a dye" is the same fact in words that describe an action.
  V('enhancement', 'cloth_mordant',      'платът е мордантиран',        'cloth was mordanted', 1),
  V('enhancement', 'botanical_mordant',  'листата са потопени в мордант','leaves dipped in mordant', 2),
  V('enhancement', 'predye_substantive', 'платът е предварително набагрен','cloth was pre-dyed', 3),
  V('enhancement', 'blanket_mordant',    'одеяло, топено в мордант',    'blanket soaked in mordant', 4),
  V('enhancement', 'blanket_dye',        'одеяло, топено в багрило',    'blanket soaked in dye', 5),
  V('enhancement', 'ph_modifier',        'добавен pH модификатор',      'a pH modifier was added', 6),

  V('bundle_role', 'printing_cloth',  'печатащ плат',  'printing cloth', 1),
  V('bundle_role', 'receiving_cloth', 'приемащ плат',  'receiving cloth', 2),
  V('bundle_role', 'carrier_blanket', 'одеяло',        'carrier blanket', 3),
  V('bundle_role', 'barrier',         'бариера',       'barrier', 4),

  // Physical actions belong in the sequence alongside the chemistry: laying
  // the cloth on foil, arranging leaves and laying the blanket are steps, not
  // a separate list beside them. Keeping them apart broke the order in which
  // the work is actually done and remembered.
  V('step_type', 'prep_chain',    'подготовка (верига)',   'preparation (chain)', 0.5),
  V('step_type', 'lay_base',      'разстилане върху основа','laying on a base', 0.6),
  V('step_type', 'arrange',       'нареждане на растения', 'arranging the plants', 0.7),
  V('step_type', 'lay_blanket',   'застилане с одеяло',    'laying the blanket', 0.8),
  V('step_type', 'bundle',        'вързване / навиване',   'bundling', 0.9),
  // Decoration: resist and shibori were never expressible. `bundle` above is
  // the eco-print bundle and is a different act from binding for shibori.
  // Removing a resist is its own step because it usually happens much later —
  // after the dye bath, sometimes after the rinse.
  V('step_type', 'shibori_bind',  'сгъване / стягане',  'folding & binding', 1.1),
  V('step_type', 'apply_resist',  'нанасяне на резист', 'applying resist', 1.2),
  V('step_type', 'print_paste',   'печат с паста',      'paste printing', 1.3),
  V('step_type', 'remove_resist', 'махане на резиста',  'removing resist', 1.4),

  V('step_type', 'scour',         'изпиране',        'scour', 1),
  V('step_type', 'tannin',        'танин',           'tannin', 2),
  V('step_type', 'mordant',       'мордант',         'mordant', 3),
  V('step_type', 'dye',           'багрилна баня',   'dye bath', 4),
  V('step_type', 'bundle_steam',  'вързоп на пара',  'bundle & steam', 5),
  V('step_type', 'bundle_boil',   'вързоп на котлон','bundle & boil', 6),
  V('step_type', 'post_iron',     'желязна баня',    'iron afterbath', 7),
  V('step_type', 'post_modifier', 'модификатор',     'modifier bath', 8),
  V('step_type', 'soap',          'сапунисване',     'soaping', 9),
  V('step_type', 'rinse',         'изплакване',      'rinse', 10),
  V('step_type', 'dry',           'сушене',          'drying', 11),
  V('step_type', 'cure',          'отлежаване',      'curing', 12),

  V('medium_where', 'dye_bath',     'багрилна баня',   'dye bath', 1),
  V('medium_where', 'mordant_bath', 'мордантна баня',  'mordant bath', 2),
  V('medium_where', 'steam_water',  'вода за пара',    'steam water', 3),
  V('medium_where', 'rinse',        'изплакване',      'rinse', 4),
  V('medium_where', 'afterbath',    'последваща баня', 'afterbath', 5),

  // --- placements --------------------------------------------------------
  V('placement_condition', 'fresh',      'свежо',        'fresh', 1),
  V('placement_condition', 'dried',      'сушено',       'dried', 2),
  V('placement_condition', 'rehydrated', 'рехидратирано','rehydrated', 3),
  V('placement_condition', 'frozen',     'замразено',    'frozen', 4),

  // --- safety, for the practice of dyeing ---------------------------------
  //
  // Three levels, not a toxic/not-toxic flag: one word would put eucalyptus and
  // madder in the same box when their risk differs in kind, not only in degree.
  // The level is a code, so the colour is a rendering of it and the label comes
  // from this table in both languages — no sentence to write and translate for
  // each of forty-eight plants.
  //
  // This is an assessment for natural dyeing and eco print. It is not a food,
  // medical or foraging judgement, and the profile says so.
  V('toxicity_level', 'low',      'нисък риск',        'low risk', 1),
  V('toxicity_level', 'caution',  'умерено внимание',  'take care', 2),
  V('toxicity_level', 'elevated', 'повишено внимание', 'heightened care', 3),

  // What to actually do, coded rather than written. "Dust is an inhalation
  // risk" and "wear a mask when grinding" are the same fact, and the second is
  // the one that changes what happens at the bench. Coded also means these can
  // be filtered — "show me everything that wants a mask" is a real question to
  // ask before starting.
  V('precaution', 'gloves',            'ръкавици',                    'gloves', 1),
  V('precaution', 'ventilation',       'вентилация',                  'ventilation', 2),
  V('precaution', 'dust_mask',         'маска при прах',              'mask for dust', 3),
  V('precaution', 'separate_vessels',  'отделни съдове',              'separate vessels', 4),
  V('precaution', 'no_ingestion',      'да не се поглъща',            'do not ingest', 5),
  V('precaution', 'photosensitivity',  'фоточувствителност',          'photosensitivity', 6),
  V('precaution', 'contact_allergy',   'възможна контактна алергия',  'possible contact allergy', 7),
  // A third of the library sits between low and caution for one recurring
  // reason: the leaf is low risk and the essential oil or concentrated extract
  // is not. Rounding all of them up would make "take care" meaningless, so the
  // level stays low and the distinction is carried here.
  V('precaution', 'concentrate_differs', 'концентратът не е листото', 'the concentrate is not the leaf', 8),

  V('facing', 'face_down', 'с лицето надолу', 'face down', 1),
  V('facing', 'face_up',   'с лицето нагоре', 'face up', 2),

  V('print_quality', 'sharp',   'ясен',    'sharp', 1),
  V('print_quality', 'soft',    'мек',     'soft', 2),
  V('print_quality', 'diffuse', 'размит',  'diffuse', 3),
  V('print_quality', 'none',    'без',     'none', 4),

  V('season', 'spring', 'пролет', 'spring', 1),
  V('season', 'summer', 'лято',   'summer', 2),
  V('season', 'autumn', 'есен',   'autumn', 3),
  V('season', 'winter', 'зима',   'winter', 4),

  // --- combinations & trials --------------------------------------------
  // Confidence belongs to a single claim, not to a whole record: a plant's
  // dyeing temperature can be well established while its preferred leaf
  // surface is a guess, and one label over both would flatten the difference.
  V('claim_confidence', 'literature',  'от литература',     'published source', 1),
  V('claim_confidence', 'own_trial',   'мой тест',           'confirmed here', 2),
  V('claim_confidence', 'practice',    'практика',           'practitioner advice', 3),
  V('claim_confidence', 'unverified',  'нуждае се от тест',  'needs testing', 4),

  V('confidence', 'unverified',   'непроверено',      'unverified', 1),
  V('confidence', 'literature',   'от литература',    'literature only', 2),
  V('confidence', 'practice',     'от практика',      'from practice', 3),
  V('confidence', 'confirmed',    'потвърдено',       'confirmed by trials', 4),
  V('confidence', 'contradicted', 'опровергано',      'contradicted by trials', 5),

  // "Successful" and "worth doing again" are different questions: a technically
  // clean result can be dull, and a failed piece can reveal an effect worth
  // chasing. Both belong on a trial.
  V('repeat', 'yes',     'да, без промени', 'yes, unchanged', 1),
  V('repeat', 'changes', 'да, с промени',   'yes, with changes', 2),
  V('repeat', 'no',      'не',              'no', 3),
  V('repeat', 'unsure',  'още не знам',     'not sure yet', 4),

  // One record with three ages, not a plan record and a result record (§8.0a).
  // The work is usually decided and begun within the same hour, and asking for
  // it twice is how recording stops happening.
  V('trial_status', 'planned',     'замислен',   'planned', 1),
  V('trial_status', 'in_progress', 'в ход',      'in progress', 2),
  V('trial_status', 'complete',    'завършен',   'complete', 3),

  // The shape of a working day (§8.0b). Six markers, of which only the middle
  // four hold steps: raw cloth is the fabric record and finished is the trial's
  // own status, both of which already exist and must not be entered twice.
  //
  // A stage is a LABEL on a step, not a slot. Colouring before a print and
  // again afterwards is two runs of the same stage, and the timeline shows
  // what happened rather than a template.
  V('trial_stage', 'raw',      'сурова тъкан',            'raw cloth', 1),
  V('trial_stage', 'prep',     'предварителна обработка', 'preparation', 2),
  V('trial_stage', 'decorate', 'декорация',               'decoration', 3),
  V('trial_stage', 'colour',   'багрене и принт',         'colouring and printing', 4),
  V('trial_stage', 'after',    'последваща обработка',    'after-treatment', 5),
  V('trial_stage', 'done',     'готово',                  'finished', 6),

  V('assessment', 'success', 'успех',    'success', 1),
  V('assessment', 'partial', 'частично', 'partial', 2),
  V('assessment', 'failure', 'неуспех',  'failure', 3),

  V('technique_category', 'resist',         'резист',      'resist', 1),
  V('technique_category', 'shibori',        'шибори',      'shibori', 2),
  V('technique_category', 'printing',       'печат',       'printing', 3),
  V('technique_category', 'bundling',       'вързване',    'bundling', 4),
  V('technique_category', 'post_treatment', 'последваща',  'post-treatment', 5),

  V('water_source', 'tap',       'чешмяна',    'tap', 1),
  V('water_source', 'rain',      'дъждовна',   'rain', 2),
  V('water_source', 'well',      'кладенец',   'well', 3),
  V('water_source', 'distilled', 'дестилирана','distilled', 4),
];

// Band definitions (§13.7, revised in §13bp).
//
// These encode judgement, not fact, and ship as data so that revising them
// costs nothing. Checked against the library for the first time in 1.0.0, which
// found three things:
//
//   * 104 of 114 dye temperatures fell in one band. A band that holds nine
//     tenths of the library distinguishes nothing.
//   * `concentration` was being asked to band two incompatible quantities —
//     mordant strength, which runs 0.5% to 20%, and dyestuff, which runs 15% to
//     500%. All 250 plant dosings landed in "high".
//   * The numbers were drawn around iron and the data was written for alum. All
//     ordinary alum mordanting is "high" on the old scale, yet sixteen of the
//     thirty-one seeded combinations record alum as "medium" — because whoever
//     wrote them meant "the usual amount". The definitions and the data already
//     disagreed.
//
const B = (dimension, code, min, max, unit, bg, en) =>
  ({ key: dimension + ':' + code, dimension, code, min, max, unit, label: { bg, en } });

export const BANDS = [
  // MORDANT STRENGTH IS RELATIVE, and this is the change that makes the rest
  // work. 2% iron is a great deal; 2% alum is nothing. No absolute scale can
  // serve both, and the one that tried was built around iron.
  //
  // The numbers below are MULTIPLES of the substance's own standard dose, which
  // every mordant already carries: alum 15%, alum acetate 6%, iron 1%, copper
  // 2%, titanium 2%. So "medium alum" means the usual mordanting — which is
  // what the seeded combinations meant all along, and they become correct
  // without being touched.
  B('mordant_strength', 'trace',  0,    0.25, '×', 'следи',  'trace'),
  B('mordant_strength', 'low',    0.25, 0.75, '×', 'ниска',  'low'),
  B('mordant_strength', 'medium', 0.75, 1.25, '×', 'средна', 'medium'),
  B('mordant_strength', 'high',   1.25, null, '×', 'висока', 'high'),

  // How much plant went into the bath, against the weight of goods. A different
  // question from mordant strength and on a different order of magnitude: the
  // library holds 15% to 500%, and the boundaries are drawn where its own
  // values cluster.
  B('dyestuff_ratio', 'sparing',   0,   50,   '%', 'пестеливо',      'sparing'),
  B('dyestuff_ratio', 'usual',     50,  150,  '%', 'обичайно',       'usual'),
  B('dyestuff_ratio', 'strong',    150, 300,  '%', 'наситено',       'strong'),
  B('dyestuff_ratio', 'very_strong', 300, null, '%', 'много наситено', 'very strong'),

  // Kept for anything still measured as a plain percentage of goods with no
  // reference dose behind it — a modifier, an assistant. Not used in a
  // combination key.
  B('concentration', 'trace',  0,    0.5,  '%', 'следи',  'trace'),
  B('concentration', 'low',    0.5,  1.5,  '%', 'ниска',  'low'),
  B('concentration', 'medium', 1.5,  2.5,  '%', 'средна', 'medium'),
  B('concentration', 'high',   2.5,  null, '%', 'висока', 'high'),

  B('duration_steam', 'short',  0,   60,   'min', 'кратко', 'short'),
  B('duration_steam', 'medium', 60,  120,  'min', 'средно', 'medium'),
  B('duration_steam', 'long',   120, null, 'min', 'дълго',  'long'),

  B('duration_bath', 'short',  0,   45,   'min', 'кратко', 'short'),
  B('duration_bath', 'medium', 45,  120,  'min', 'средно', 'medium'),
  B('duration_bath', 'long',   120, null, 'min', 'дълго',  'long'),

  // Redrawn on the library's own figures. The old four put nine tenths of every
  // recorded dye temperature into "simmer", so madder — which must stay under
  // about 60 °C or it loses its red — banded identically to oak bark at 90 °C.
  // The distinct starting temperatures in the library are 40, 45, 60, 70, 75,
  // 80 and 85, and these boundaries fall between them rather than across them.
  B('temperature', 'cold',   0,  40,   '°C', 'студено', 'cold'),
  B('temperature', 'warm',   40, 65,   '°C', 'умерено', 'warm'),
  B('temperature', 'hot',    65, 85,   '°C', 'горещо',  'hot'),
  B('temperature', 'simmer', 85, 95,   '°C', 'къкрене', 'simmer'),
  B('temperature', 'boil',   95, null, '°C', 'вряло',   'boil'),

  B('ph', 'acid',     0,  6.5,  'pH', 'кисело',    'acid'),
  B('ph', 'neutral',  6.5, 7.5, 'pH', 'неутрално', 'neutral'),
  B('ph', 'alkaline', 7.5, 14,  'pH', 'алкално',   'alkaline'),
];

// Resolve a raw figure to its band code. Exact values stay on the trial; only
// the band travels into a combination key (§7).
export function bandFor(dimension, value, bands = BANDS) {
  if (value == null) return null;
  const row = bands.find(b =>
    b.dimension === dimension &&
    value >= b.min &&
    (b.max == null || value < b.max));
  return row ? row.code : null;
}

/**
 * The band a mordant dose falls in, given the substance it was made with.
 *
 * `mordantBand(15, { standardPercentWof: 15 })` → 'medium'
 * `mordantBand(15, { standardPercentWof: 1 })`  → 'high'   (fifteen times iron)
 *
 * Returns null when the substance carries no standard dose: a ratio against an
 * unknown reference is not a weak answer but a made-up one, and the caller has
 * to be able to tell the difference (§13d).
 */
export function mordantBand(percentWof, substance, bands = BANDS) {
  const standard = substance?.standardPercentWof;
  if (percentWof == null || !standard) return null;
  return bandFor('mordant_strength', percentWof / standard, bands);
}

/** What a band means in real percent, for showing beside the word. */
export function bandRange(dimension, code, bands = BANDS) {
  return bands.find(b => b.dimension === dimension && b.code === code) || null;
}

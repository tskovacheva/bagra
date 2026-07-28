// vocab.js — controlled vocabularies (§13.1) and band definitions (§13.7).
//
// The code is the data; the label is looked up per language at render time.
// Codes never change once published, because they travel inside reference
// packs. Adding a term is a data change, not a code change — these defaults
// are seeded into the `vocabulary` store on first run and are editable there.

export const DIMENSIONS = [
  'fibre_class', 'fibre', 'fabric_form', 'fabric_structure', 'fabric_state',
  'plant_part', 'chemistry_class', 'chemistry_level', 'plant_role',
  'compositional_role', 'availability', 'fastness', 'toxicity_level',
  'material_category', 'mordant_type', 'tannin_type', 'colour_effect',
  'dye_class', 'recipe_type', 'ingredient_role', 'basis', 'basis_refers_to',
  'process', 'enhancement', 'bundle_role', 'step_type', 'medium_where',
  'placement_condition', 'facing', 'print_quality', 'confidence',
  'technique_category', 'assessment', 'water_source', 'season',
];

const V = (dimension, code, bg, en, order = 0, description = null) =>
  ({ dimension, code, label: { bg, en }, order, description });

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
  V('fabric_state', 'unwashed',  'неизпран',     'unwashed', 1),
  V('fabric_state', 'scoured',   'изпран',       'scoured', 2),
  V('fabric_state', 'tanned',    'танииран',     'tannin-treated', 3),
  V('fabric_state', 'mordanted', 'мордантиран',  'mordanted', 4),
  V('fabric_state', 'dyed',      'набагрен',     'dyed', 5),
  V('fabric_state', 'finished',  'завършен',     'finished', 6),

  // --- plants ------------------------------------------------------------
  V('plant_part', 'leaf',   'лист',     'leaf', 1),
  V('plant_part', 'bark',   'кора',     'bark', 2),
  V('plant_part', 'root',   'корен',    'root', 3),
  V('plant_part', 'flower', 'цвят',     'flower', 4),
  V('plant_part', 'fruit',  'плод',     'fruit', 5),
  V('plant_part', 'hull',   'обвивка',  'hull', 6),
  V('plant_part', 'gall',   'шикалка',  'gall', 7),
  V('plant_part', 'whole',  'цяло',     'whole plant', 8),

  V('chemistry_class', 'tannin_gallo',   'галотанини',   'gallotannins', 1),
  V('chemistry_class', 'tannin_ellagi',  'елаготанини',  'ellagitannins', 2),
  V('chemistry_class', 'tannin_cond',    'кондензирани танини', 'condensed tannins', 3),
  V('chemistry_class', 'anthocyanin',    'антоциани',    'anthocyanins', 4),
  V('chemistry_class', 'flavonoid',      'флавоноиди',   'flavonoids', 5),
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
  V('plant_role', 'mordant_accumulator', 'акумулатор', 'mordant accumulator', 3),

  // Eco-print specific and absent from most references (§4).
  V('compositional_role', 'shape_printer', 'оформящо',      'shape printer', 1),
  V('compositional_role', 'filler',        'фон и текстура','texture filler', 2),
  V('compositional_role', 'resist',        'резист',        'resist', 3),

  V('availability', 'grows_here',       'расте тук',   'grows here', 1),
  V('availability', 'forageable_local', 'намира се',   'forageable locally', 2),
  V('availability', 'purchased',        'купува се',   'purchased', 3),

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

  V('ingredient_role', 'aluminium_source', 'алуминиев източник', 'aluminium source', 1),
  V('ingredient_role', 'sodium_source',    'натриев източник',   'sodium source', 2),
  V('ingredient_role', 'acid_source',      'киселинен източник', 'acid source', 3),
  V('ingredient_role', 'dyestuff',         'багрило',            'dyestuff', 4),
  V('ingredient_role', 'assistant',        'помощно',            'assistant', 5),

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
  V('process', 'paste',     'печат с паста',    'paste print', 3),

  // The seven enhancements, layered rather than exclusive (§8.0).
  V('enhancement', 'cloth_mordant',      'мордантиран плат',        'cloth pre-mordanted', 1),
  V('enhancement', 'botanical_mordant',  'мордантирани растения',   'botanicals pre-mordanted', 2),
  V('enhancement', 'predye_substantive', 'предварително субстантивно','pre-dyed, substantive', 3),
  V('enhancement', 'blanket_substantive','субстантивно одеяло',     'substantive carrier blanket', 4),
  V('enhancement', 'predye_adjective',   'предварително адективно', 'pre-dyed, adjective', 5),
  V('enhancement', 'blanket_adjective',  'адективно одеяло',        'adjective carrier blanket', 6),
  V('enhancement', 'ph_modifier',        'pH модификатор',          'pH modifier', 7),

  V('bundle_role', 'printing_cloth',  'печатащ плат',  'printing cloth', 1),
  V('bundle_role', 'receiving_cloth', 'приемащ плат',  'receiving cloth', 2),
  V('bundle_role', 'carrier_blanket', 'одеяло',        'carrier blanket', 3),
  V('bundle_role', 'barrier',         'бариера',       'barrier', 4),

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
  V('confidence', 'unverified',   'непроверено',      'unverified', 1),
  V('confidence', 'literature',   'от литература',    'literature only', 2),
  V('confidence', 'confirmed',    'потвърдено',       'confirmed by trials', 3),
  V('confidence', 'contradicted', 'опровергано',      'contradicted by trials', 4),

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

// Band definitions (§13.7). These encode judgement, not fact, and are meant to
// be revised — they ship as data precisely so revising them costs nothing.
// The numbers below are provisional and still to be checked against practice.
const B = (dimension, code, min, max, unit, bg, en) =>
  ({ dimension, code, min, max, unit, label: { bg, en } });

export const BANDS = [
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

  B('temperature', 'cold',   0,  30,   '°C', 'студено',  'cold'),
  B('temperature', 'warm',   30, 70,   '°C', 'топло',    'warm'),
  B('temperature', 'simmer', 70, 95,   '°C', 'къкрене',  'simmer'),
  B('temperature', 'boil',   95, null, '°C', 'вряло',    'boil'),

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

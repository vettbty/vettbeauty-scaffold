// Subcategories for the browse filters.
//
// The catalogue carries a curated subcategory for about half the products. The
// rest are blank, so a subcategory filter built from the data alone would hide
// half of every category. Curated labels win (folded through ALIASES so near
// duplicates like "Sunscreen" and "SPF" share one chip); a blank is inferred
// from the product name with the ordered keyword RULES below — first match
// wins, so specific patterns ("dry shampoo", "lip liner") sit above general
// ones ("shampoo", "liner"). Anything unmatched files under "Other".

export const OTHER = 'Other';

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'skincare', label: 'Skincare' },
  { key: 'makeup', label: 'Makeup' },
  { key: 'hair', label: 'Hair' },
  { key: 'body', label: 'Body' },
  { key: 'fragrance', label: 'Fragrance' },
  { key: 'tools-devices', label: 'Tools & Devices' },
  { key: 'wellness', label: 'Wellness' },
  { key: 'nails', label: 'Nails' },
];

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const ALIASES: Record<string, Record<string, string>> = {
  Skincare: {
    Sunscreen: 'SPF',
    'Cleansing Balm': 'Cleanser',
    'Exfoliating Cleanser': 'Cleanser',
    Toner: 'Toner & Essence',
    'Facial Mist': 'Toner & Essence',
    Oil: 'Face Oil',
  },
  Makeup: {
    'Lip Gloss': 'Lip Gloss & Oil',
    'Lip Oil': 'Lip Gloss & Oil',
    Bronzer: 'Bronzer & Contour',
    'Self-Tanner': 'Bronzer & Contour',
  },
  Body: {
    Moisturizer: 'Body Lotion',
    'Hand Cream': 'Hand & Foot',
  },
  Fragrance: {
    'Body Mist': 'Body & Hair Mist',
    Rollerball: 'Perfume Oil & Solid',
    'Eau de Toilette': 'Eau de Toilette & Cologne',
  },
  Nails: {
    'Nail Treatment': 'Nail Care',
    'Nail Tool': 'Nail Tools',
  },
};

type Rule = [string, RegExp];

const RULES: Record<string, Rule[]> = {
  Skincare: [
    ['SPF', /\bspf\b|sunscreen|sun ?screen|\bsun\b|\buv\b|sunblock/],
    ['Cleanser', /cleans|face wash|facial wash|micellar|\bh2o\b|remov|wash\b|foam\b|beauty bar|face bar|soap|\bbar\b/],
    ['Eye Cream', /\beye|under ?eye/],
    ['Lip Care', /\blip/],
    ['Mask', /mask|patch|\bpack\b|nose strip/],
    ['Exfoliant', /exfoli|peel|\baha\b|\bbha\b|glycolic|salicylic|scrub|dermaplan/],
    ['Serum', /serum|ampou?le?|booster|drops|concentrate|\bshot\b|\bc e ferulic/],
    ['Toner & Essence', /toner|essence|tonic|\bmist|\bpads?\b|lotion p50/],
    ['Treatment', /treatment|spot|acne|blemish|retin|pimple|clearing|solution/],
    ['Face Oil', /\boil\b/],
    ['Moisturizer', /cream|creme|moistur|lotion|hydrator|emulsion|gel\b|balm|butter|jelly|fluid|milk/],
  ],
  Makeup: [
    ['Mascara', /mascara|lash (?:primer|tubing)/],
    ['Brow', /brow/],
    ['Lashes', /lash/],
    ['Lip Liner', /lip ?liner|lip pencil/],
    ['Lip Gloss & Oil', /gloss|lip oil|lip lacquer|lip glaze|plump/],
    ['Lip Care', /lip (?:balm|scrub|mask|treatment|sleeping)|lip butter/],
    ['Lipstick', /lip|rouge|\btint\b|lip stain/],
    ['Eyeliner', /eyeliner|eye ?liner|\bliner\b|kohl|khol/],
    ['Eyeshadow', /shadow|eye (?:palette|crayon|stick|stylus)|glitter|sparkle/],
    ['Setting Spray', /setting (?:spray|mist)|fix(?:ing)? (?:spray|mist)/],
    ['Primer', /primer|\bbase\b|prep/],
    ['Concealer', /conceal|corrector/],
    ['Tinted Moisturizer', /skin tint|tinted|\bbb\b|\bcc\b|blemish balm|serum foundation/],
    ['Foundation', /foundation|cushion|complexion|\bmakeup\b/],
    ['Powder', /powder|\bpact\b/],
    ['Blush', /blush|cheek/],
    ['Bronzer & Contour', /bronz|contour|sculpt|shading|tann/],
    ['Highlighter', /highlight|glow|illuminat|luminiz|shimmer|radiance/],
    ['Multi-Use', /multi|stick|color (?:cream|crayon|pot)|balm/],
  ],
  Hair: [
    ['Dry Shampoo', /dry shampoo|dry wash/],
    ['Scalp Treatment', /scalp/],
    ['Shampoo', /shampoo|co-?wash|cleanser/],
    ['Hair Mask', /mask|masque/],
    ['Hair Mist & Perfume', /mist|perfume|fragrance/],
    ['Leave-In', /leave-?in|detangl/],
    ['Conditioner', /conditioner/],
    ['Heat Protectant', /heat|thermal|protect/],
    ['Hair Colour', /colou?r|dye|\broot|toner|gloss|glaze|grey|gray|henna|hair (?:mascara|shadow|shading|cushion)|hairline/],
    ['Hair Oil', /\boil\b/],
    ['Treatment', /bond|repair|treatment|serum|rinse|growth|thicken|densif|ampoule|essence|vinegar|supplement/],
    ['Hair Tools', /dryer|\biron\b|straighten|steamer|brush|comb|styler|curler/],
    ['Hair Accessories', /clip|scrunch|\bties?\b|headband|band\b|pin\b|ponytail|bonnet|extension/],
    ['Styling', /spray|gel|mousse|foam|cream|putty|paste|pomade|wax|texture|curl|edge|volum|smooth|frizz|hold|styl/],
  ],
  Body: [
    ['Deodorant', /deodorant|anti-?perspirant|\bdeo\b/],
    ['SPF', /\bspf\b|sunscreen|\bsun\b/],
    ['Self-Tanner', /tan\b|tann|bronz|glow drops/],
    ['Shaving & Hair Removal', /shav|razor|hair remov|\bwax|epilat|trim/],
    ['Hand & Foot', /\bhands?\b|\bfoot\b|\bfeet\b|heel|cuticle/],
    ['Body Scrub', /scrub|exfoli|\baha\b|glycolic|\bkp\b|polish/],
    ['Bath', /bath|soak|salts?\b/],
    ['Body Wash', /wash|soap|shower|cleans|bar\b/],
    ['Body Oil', /\boil\b/],
    ['Body Mist', /mist|body spray|fragrance|perfume|parfum/],
    ['Body Treatment', /acne|blemish|patch|ointment|healing|repair|jelly|\bkp\b/],
    ['Body Lotion', /lotion|cream|butter|balm|moistur|serum|milk|souffle|whip|ampoule|toner|conditioner/],
  ],
  Fragrance: [
    ['Home Fragrance', /candle|room|diffuser|home|laundry|detergent/],
    ['Body & Hair Mist', /mist|body spray|hair perfume|hair mist|hair fragrance/],
    ['Perfume Oil & Solid', /perfume oil|fragrance oil|\boil\b|solid|roll-?on|rollerball|balm/],
    ['Eau de Toilette & Cologne', /toilette|\bedt\b|cologne/],
    ['Eau de Parfum', /parfum|\bedp\b|perfume|elixir|extrait|fragrance/],
  ],
  Nails: [
    ['Press-On Nails', /press-?on|nail (?:tips|extensions)/],
    ['Nail Polish Remover', /remov/],
    ['Base & Top Coat', /top ?coat|base ?coat|seal/],
    ['Nail Tools', /file\b|clipper|kit|system|\bset\b|lamp|pen\b|buffer/],
    ['Nail Care', /treatment|strength|cuticle|serum|cream|oil|repair|patch|growth|hard|cure|care/],
    ['Nail Polish', /polish|lacquer|colou?r|gel|enamel|nail/],
  ],
  'Tools & Devices': [
    ['Oral Care', /tooth|teeth|floss|whiten|oral|sonicare/],
    ['LED Device', /\bled\b|light therapy|red light|infrared/],
    ['Microcurrent', /microcurrent|toning device|nuface|ziip/],
    ['Hair Tool', /dryer|\biron\b|straighten|styler|airwrap|curl|blow|hair brush|hot brush|wave/],
    ['Lash Tool', /lash|curler/],
    ['Nail Tool', /nail/],
    ['Brush', /brush/],
    ['Sponge', /sponge|blender|puff/],
    ['Blotting Paper', /blotting|paper/],
    ['Hair Accessories', /clip|bonnet|pony|scrunch|headband/],
    ['Body Tool', /razor|shav|massag|body/],
    ['Skin Tool', /gua sha|roller|dermaplan|facial|face|skin|cleansing|wand|derma|pore|ice/],
  ],
  Wellness: [
    ['Oral Care', /tooth|teeth|floss|whiten|mouth|oral|breath|tongue/],
    ['Intimate Care', /feminine|intimate|panty|period|pads\b|lubricant|glide/],
    ['Eye & Lens Care', /dailies|oasys|biofinity|aosept|opti-?free|contact lens|lens/],
    ['Supplement', /supplement|vitamin|collagen|gumm|capsule|probiotic|nutraceutical|greens|powder|tablet|softgel|magnesium|protein|shake|kombucha|omega|fish oil|formula|immun|arginine|retinol|\bglu\b|innersitol/],
    ['Sleep', /sleep|pillow|melatonin|night|steam eye mask/],
    ['Aromatherapy', /aroma|essential oil|diffuser|candle/],
    ['Fitness', /legging|\bmat\b|weights?|shoes?|\bbra\b|training|yoga|running|bangles|bottle|duffel|socks|gym/],
    ['Home', /filter|purifier|vacuum|laundry|shower|blender|lunch|humidifier/],
    ['Tech', /watch|earbuds|headphones|sauna|massager|device|ring\b/],
  ],
};

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// A curated label outside the category's chip set ("Woody Floral" under
// Fragrance, "Restorative Shampoo and Conditioner Set") is read as a hint: the
// rules run over the label first, then the name.
export function subcategoryFor(category: string, subcategory: string | null | undefined, name: string): string {
  const rules = RULES[category] ?? [];
  const curated = (subcategory ?? '').trim();
  const aliased = ALIASES[category]?.[curated] ?? curated;
  if (aliased && rules.some(([label]) => label === aliased)) return aliased;
  for (const text of [aliased, name]) {
    const n = fold(text);
    if (!n) continue;
    for (const [label, re] of rules) if (re.test(n)) return label;
  }
  return OTHER;
}

// Every subcategory a category can produce, "Other" last.
export function subcategoriesOf(category: string): string[] {
  return [...(RULES[category] ?? []).map(([label]) => label), OTHER];
}

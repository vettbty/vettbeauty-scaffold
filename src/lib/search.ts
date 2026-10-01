// Catalogue search for /browse.
//
// The old search matched the whole query as one substring of brand, name or
// award, so "vitamin c serum" missed a product named "Vitamin C Brightening
// Serum", "avene" missed "Avène", "sunscreen" missed everything filed as SPF,
// and one typo returned nothing. This matches word by word instead:
//
//   - every query word must match somewhere in the product (brand, name,
//     category, subcategory or award) — as a word, a word prefix ("moist"),
//     a synonym ("sunscreen" ↔ "spf"), or within one or two typos
//   - accents, case, punctuation and British/US spelling are ignored
//   - results rank by where the words hit (brand and name above award text),
//     then by award count
import type { Product } from './data';

const STOP = new Set(['the', 'a', 'an', 'and', 'for', 'with', 'of', 'by', 'in', 'to', 'best', 'my']);

// Each group is mutually interchangeable. Keys are written in normalised form
// (see norm()): "moisturizer", "color".
const SYNONYM_GROUPS: string[][] = [
  ['spf', 'sunscreen', 'sunblock', 'suncream', 'sun'],
  ['moisturizer', 'moisturizing', 'moisturizers', 'moisturiser', 'cream', 'hydrator'],
  ['cleanser', 'cleansing', 'wash', 'facewash'],
  ['perfume', 'parfum', 'fragrance', 'scent', 'edp', 'cologne'],
  ['lipstick', 'lip'],
  ['gloss', 'lipgloss'],
  ['eyeliner', 'liner'],
  ['eyeshadow', 'shadow'],
  ['mascara', 'lash', 'lashes'],
  ['brow', 'eyebrow', 'brows'],
  ['blush', 'blusher', 'cheek'],
  ['highlighter', 'highlight', 'glow'],
  ['toner', 'essence', 'tonic'],
  ['serum', 'ampoule', 'ampule'],
  ['exfoliant', 'exfoliator', 'exfoliating', 'peel', 'scrub'],
  ['retinol', 'retinoid', 'retinal', 'retin'],
  ['vitamin', 'vit'],
  ['hyaluronic', 'ha'],
  ['niacinamide', 'b3'],
  ['color', 'dye', 'tint'],
  ['deodorant', 'deo', 'antiperspirant'],
  ['hairdryer', 'dryer', 'blowdryer'],
  ['straightener', 'flatiron', 'iron'],
  ['toothpaste', 'tooth', 'teeth', 'whitening'],
  ['supplement', 'supplements', 'vitamins', 'gummies', 'gummy', 'capsules'],
  ['nail', 'nails', 'manicure', 'mani'],
  ['polish', 'lacquer', 'varnish'],
  ['tan', 'tanner', 'selftan', 'bronzing'],
];

// British → US and other spelling folds, applied to both query and catalogue
// so either spelling finds the other.
function norm(word: string): string {
  return word
    .replace(/^colour/, 'color')
    .replace(/our$/, 'or')
    .replace(/is(e|er|ers|ing|ed)$/, 'iz$1')
    .replace(/^grey$/, 'gray');
}

export function fold(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(s: string): string[] {
  return fold(s).split(' ').filter(Boolean).map(norm);
}

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  const g = group.map(norm);
  for (const w of g) SYNONYMS.set(w, [...new Set([...(SYNONYMS.get(w) ?? []), ...g])]);
}

// Field weights: a hit in the name or brand is what a shopper means; a hit in
// award text ("Best Serum") is weaker evidence.
const FIELDS = [
  ['brand', 5],
  ['name', 4],
  ['subcategory', 3],
  ['category', 2],
  ['awards', 1],
] as const;
type Field = typeof FIELDS[number][0];

interface Indexed {
  product: Product;
  fields: Record<Field, string[]>;
  compact: string; // brand + name with spaces removed: "lipgloss" finds "Lip Gloss"
}

let index: Indexed[] | null = null;
let vocab: string[] = [];

function build(products: Product[]): Indexed[] {
  const v = new Set<string>();
  const out = products.map(product => {
    const fields: Record<Field, string[]> = {
      brand: words(product.brand),
      name: words(product.name),
      subcategory: words(product.subcategory ?? ''),
      category: words(product.category),
      awards: words(product.awardsWon.join(' ')),
    };
    for (const f of Object.values(fields)) for (const w of f) v.add(w);
    return { product, fields, compact: fold(`${product.brand} ${product.name}`).replace(/ /g, '') };
  });
  vocab = [...v];
  return out;
}

function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

// For one query word: every catalogue word it should match, with a strength.
// 1 = exact, 0.8 = synonym, 0.7 = prefix, 0.45 / 0.3 = one / two typos.
function expand(term: string): Map<string, number> {
  const hits = new Map<string, number>();
  const put = (w: string, s: number) => { if ((hits.get(w) ?? 0) < s) hits.set(w, s); };
  const syns = SYNONYMS.get(term) ?? [];
  const maxTypos = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
  for (const w of vocab) {
    if (w === term) put(w, 1);
    else if (syns.includes(w)) put(w, 0.8);
    else if (term.length >= 2 && w.startsWith(term)) put(w, 0.7);
    else if (term.length >= 2 && syns.some(s => s.length >= 3 && w.startsWith(s))) put(w, 0.6);
    else if (maxTypos) {
      for (let d = 1; d <= maxTypos; d++) {
        if (editDistanceWithin(term, w, d)
          || (term.length >= 5 && w.length > term.length && editDistanceWithin(term, w.slice(0, term.length), d))) {
          put(w, d === 1 ? 0.45 : 0.3);
          break;
        }
      }
    }
  }
  return hits;
}

export function queryTerms(query: string): string[] {
  const all = words(query);
  const kept = all.filter(w => !STOP.has(w));
  return kept.length ? kept : all;
}

export interface SearchResult { product: Product; score: number }

export function search(products: Product[], query: string): SearchResult[] {
  const terms = queryTerms(query);
  if (!terms.length) return products.map(product => ({ product, score: 0 }));
  if (!index || index.length !== products.length || index[0]?.product !== products[0]) index = build(products);
  const expansions = terms.map(expand);
  const phrase = fold(query);

  const results: SearchResult[] = [];
  for (const item of index) {
    let score = 0;
    let matchedAll = true;
    for (let t = 0; t < terms.length; t++) {
      let best = 0;
      for (const [field, weight] of FIELDS) {
        for (const w of item.fields[field]) {
          const s = expansions[t].get(w);
          // Brands are proper nouns: "lipgloss" should not pull in the brand
          // GLOSS MODERNE by synonym, nor "dior" match "Dear" by typo.
          if (s && field === 'brand' && s < 0.7) continue;
          if (s && s * weight > best) best = s * weight;
        }
      }
      if (!best && terms[t].length >= 4 && item.compact.includes(terms[t])) best = 2;
      if (!best) { matchedAll = false; break; }
      score += best;
    }
    if (!matchedAll) continue;
    const name = fold(item.product.name);
    const brand = fold(item.product.brand);
    if (brand === phrase || name === phrase) score += 10;
    else if (`${brand} ${name}`.includes(phrase)) score += 5;
    results.push({ product: item.product, score });
  }
  return results;
}

// Brands, categories and subcategories whose name matches the query — offered
// as one-tap filters above the results.
export interface Suggestion { kind: 'brand' | 'category' | 'subcategory'; label: string; category?: string; count: number }

export function suggest(products: Product[], query: string): Suggestion[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const brands = new Map<string, number>();
  const subs = new Map<string, { category: string; count: number }>();
  for (const p of products) {
    brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1);
    const key = `${p.category}\u0000${p.subcategory}`;
    const s = subs.get(key) ?? { category: p.category, count: 0 };
    s.count++;
    subs.set(key, s);
  }
  const hit = (label: string) => {
    const f = fold(label);
    return f.startsWith(q) || f.split(' ').some(w => w.startsWith(q)) || (q.length >= 4 && f.includes(q));
  };
  const out: Suggestion[] = [];
  for (const [label, count] of brands) if (hit(label)) out.push({ kind: 'brand', label, count });
  for (const [key, { category, count }] of subs) {
    const label = key.split('\u0000')[1];
    if (label !== 'Other' && hit(label)) out.push({ kind: 'subcategory', label, category, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 6);
}

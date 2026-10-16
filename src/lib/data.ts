import productsJson from './products.json';
import { subcategoryFor } from './taxonomy';
import { consensusCount } from './consensus';
import retailPricesJson from './retail-prices.json';

export interface Product {
  id: string;
  slug: string;
  brand: string;
  name: string;
  price: number | null;
  image: string;
  topAward: string;
  awardCount: number;
  // Distinct editorial publications that awarded it (Korean consumer
  // platforms excluded) — see consensus.ts. Not displayed yet.
  consensusCount: number;
  category: string;
  subcategory: string;
  year: number;
  region: string;
  imageCutout?: boolean;
  imageOriginal?: string;
  hasPhoto: boolean;
  linkType: string;
  buyLink: string;
  awardsWon: string[];
  // Current shop price where the publication printed none (retail-prices.json).
  retail?: RetailPrice;
}

export interface RetailPrice { price: number; currency?: string; at: string | null; checked: string; url: string }
const retailPrices = retailPricesJson as Record<string, RetailPrice>;

export interface AwardProgram {
  id: string;
  name: string;
  edition: string;
  winnerCount: number;
  announcedDate: string;
  region: string;
  // The programme name exactly as it prefixes entries in awardsWon, where it
  // differs from the display name ("Cosmopolitan Readers Choice", no apostrophe).
  recordName?: string;
  // Newly added class: gets its own product grid on the homepage (Sascha,
  // 2026-09-27: "new additions need to be on site and mentioned on home page").
  justAdded?: boolean;
}

export interface PressArticle {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  productName: string;
  productSlug: string;
}

// Every product carries a subcategory from the browse taxonomy — the curated
// label where there is one, else inferred from the name (see taxonomy.ts).
// Pure: the same raw rows always give the same catalogue. Browse calls it
// directly on the bundled JSON (see static-catalogue.ts); the server getters
// below call it through loadProducts.
export function enrichProducts(raw: Product[]): Product[] {
  return raw.map(p => ({
    ...p,
    subcategory: subcategoryFor(p.category, p.subcategory, p.name),
    consensusCount: consensusCount(p.awardsWon ?? []),
    // Only while the card still points at the link the price was read from.
    // Korean products show Olive Young US's USD price even where the publication
    // printed one (Sascha, 2026-10-01); for everything else the publication's
    // price wins.
    retail: retailPrices[p.slug] && (!p.price || retailPrices[p.slug].at === 'Olive Young') ? retailPrices[p.slug] : undefined,
  }));
}

// The catalogue is read through this one getter so callers do not depend on
// where it comes from: Supabase `site_products` (filled by
// scripts/sync-to-site-products.mjs), with the bundled products.json as the
// fallback. A missing env var or a failed fetch must never break the site, so
// either one serves the bundled JSON — which is fixed at build time, so while
// the fallback is in use new data still requires a deploy.
// site_products stores every field twice: as an editable column and inside
// `data` (the raw products.json row the sync wrote). FIELD PRECEDENCE: a
// column wins over `data` only when it holds a value. A null or missing
// column never overwrites the `data` value, so a column left empty in the
// table editor cannot blank a field. Note that enrichProducts() then
// recomputes consensusCount and subcategory from the merged row, so editing
// those two columns has no effect; edit awards_won or subcategory's inputs.
const SITE_COLUMNS: Array<[string, keyof Product]> = [
  ['slug', 'slug'], ['id', 'id'], ['brand', 'brand'], ['name', 'name'],
  ['category', 'category'], ['subcategory', 'subcategory'], ['region', 'region'],
  ['price', 'price'], ['image', 'image'], ['image_cutout', 'imageCutout'],
  ['buy_link', 'buyLink'], ['top_award', 'topAward'], ['award_count', 'awardCount'],
  ['consensus_count', 'consensusCount'], ['awards_won', 'awardsWon'],
];
type SiteProductRow = Record<string, unknown> & { data: Product };

function columnsOnly(row: SiteProductRow): Partial<Product> {
  const out: Record<string, unknown> = {};
  for (const [col, field] of SITE_COLUMNS) {
    const v = row[col];
    if (v !== null && v !== undefined) out[field] = col === 'price' ? Number(v) : v;
  }
  return out as Partial<Product>;
}

async function readCatalogue(): Promise<Product[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[data] Supabase env missing — falling back to bundled JSON');
    return productsJson as Product[];
  }
  // Nothing below may propagate: a fetch that throws (a malformed header value,
  // DNS, network, timeout), a body that is not JSON, or any error in the
  // paging loop serves the bundled JSON. On 2026-10-16 a placeholder anon key
  // containing "→" made fetch() throw and failed the Vercel build outright.
  try {
    // PostgREST returns at most 1,000 rows per request, so the catalogue is read
    // in pages; a single request would silently drop everything past row 1,000.
    // Each page stays well under the 2 MB limit for Next's fetch cache.
    const PAGE = 1000;
    const rows: Product[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await fetch(
        `${url}/rest/v1/site_products?select=${SITE_COLUMNS.map(([col]) => col).join(',')},data&order=slug&limit=${PAGE}&offset=${offset}`,
        // No revalidate of its own: a fetch's revalidate overrides the page's when
        // it is shorter, so a 300 here made every page refresh every 5 minutes.
        // The fetch inherits each page's own `revalidate` instead (/ 1h, product
        // pages 1d), and the tag lets a route handler refresh it on demand.
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'force-cache', next: { tags: ['catalogue'] } },
      );
      if (!res.ok) {
        console.warn(`[data] catalogue fetch failed: ${res.status} — using bundled JSON`);
        return productsJson as Product[];
      }
      const page: SiteProductRow[] = await res.json();
      rows.push(...page.map(row => ({ ...row.data, ...columnsOnly(row) })));
      if (page.length < PAGE) break;
    }
    // An empty table (created but never synced) would render a site with no
    // products; serve the bundled JSON instead.
    if (!rows.length) {
      console.warn('[data] site_products is empty — using bundled JSON');
      return productsJson as Product[];
    }
    return rows;
  } catch (err) {
    console.warn('[data] catalogue load threw — using bundled JSON:', (err as Error)?.message ?? String(err));
    return productsJson as Product[];
  }
}

// Short-lived, so a revalidation can pick up a changed source once there is one.
let _cache: { at: number; value: Product[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getProducts(): Promise<Product[]> {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.value;
  const raw = await readCatalogue();
  const value = enrichProducts(raw);
  _cache = { at: now, value };
  return value;
}

// The grids feature only winners a reader can actually buy. A product with no
// working buy link keeps its page (search, sitemap, direct links) but stays off
// the homepage and browse grids until a link sitting finds one — Sascha,
// 2026-09-28: "whats the point of featuring them".
export async function getShoppable(): Promise<Product[]> {
  return (await getProducts()).filter(p => p.buyLink);
}

/**
 * Winner counts are COMPUTED, not stated.
 *
 * They used to be hand-written, which meant every deletion, merge or re-import
 * silently turned a programme header into a false claim: on 2026-10-12 seven of
 * seventeen were wrong, Hwahae by 199. On a site whose entire proposition is an
 * accurate record, a header reading "408 winners" above 209 products is the
 * worst kind of error — confident, prominent and invisible to us.
 *
 * `stated` is kept only as documentation of what the publication announced;
 * where it differs from what we hold, that gap is real and belongs in the award
 * file's _count_note, not painted over on the homepage.
 */
function winnersOnSite(products: Product[], prog: { name: string; edition: string; recordName?: string }): number {
  const rec = prog.recordName || prog.name;
  // Two shapes: "<pub> — <award> (<year>)" for US/UK programmes, and
  // "<pub> (<year>)" for the Korean ones, which publish no per-winner award.
  return products.filter(p => (p.awardsWon || []).some(w =>
    (w.startsWith(`${rec} — `) || w.startsWith(`${rec} (`)) && w.endsWith(`(${prog.edition})`)
  )).length;
}

const awardProgramsRaw: AwardProgram[] = [
  // Newest first. This list had drifted badly out of step with the record: it
  // showed 8 programmes while the database held 14 for 2026, so Cosmopolitan's
  // 342-winner Holy Grail class, Glamour's 248 and both Harper's Bazaar
  // programmes were live on product pages but invisible here. Counts below are
  // the award rows actually in the database, not a publication's headline claim
  // — see the Allure 319-vs-307 and Cosmo 151-vs-134 notes in data/awards.
  // Marie Claire merged its Skin & Hair and Makeup awards for 2026 and added
  // Nails, Body Care and Drugstore. 213 imported, and unusually the publication
  // prints a retailer URL for every one, so 211 of 213 arrived buyable. 212 held:
  // Zoryve Cream, a prescription medicine, was purged 2026-10-10 (see
  // data/purged/2026-10-10-estee-zoryve.json in the data repo).
  { id: '17', name: 'Marie Claire Beauty Awards', edition: '2026', winnerCount: 212, announcedDate: 'Oct 2026', region: 'US', recordName: 'Marie Claire Beauty Awards', justAdded: true },
  { id: '9', name: 'Harper\'s Bazaar UK Best of the Best', edition: '2026', winnerCount: 93, announcedDate: 'Sep 2026', region: 'UK', recordName: "Harper's Bazaar UK Best of the Best", justAdded: true },
  { id: '8', name: 'NewBeauty Readers\' Choice', edition: '2026', winnerCount: 104, announcedDate: '29 Sep 2026', region: 'US', recordName: 'NewBeauty Readers Choice', justAdded: true },
  { id: '6', name: 'Allure Best of Beauty', edition: '2026', winnerCount: 307, announcedDate: '15 Sep 2026', region: 'US', justAdded: true },
  { id: '7', name: 'Cosmopolitan Readers\' Choice', edition: '2026', winnerCount: 126, announcedDate: '2 Sep 2026', region: 'US', recordName: 'Cosmopolitan Readers Choice', justAdded: true },
  { id: '1', name: 'Allure Readers\' Choice', edition: '2026', winnerCount: 66, announcedDate: 'Jun 2026', region: 'US', recordName: 'Allure Readers Choice' },
  { id: '2', name: 'InStyle Best Beauty Buys', edition: '2026', winnerCount: 154, announcedDate: '20 May 2026', region: 'US' },
  // Cosmopolitan runs two programmes a year. This is the editor-judged Holy
  // Grail class; the reader-voted one is listed above. The record name stays
  // 'Cosmopolitan Beauty Awards', which is how it prefixes awardsWon.
  { id: '10', name: 'Cosmopolitan Holy Grail Beauty Awards', edition: '2026', winnerCount: 342, announcedDate: '11 May 2026', region: 'US', recordName: 'Cosmopolitan Beauty Awards' },
  { id: '11', name: 'Harper\'s Bazaar Skincare Awards', edition: '2026', winnerCount: 64, announcedDate: '11 May 2026', region: 'US', recordName: "Harper's Bazaar Skincare Awards" },
  // France, not US — the Prix d'Excellence is Marie Claire France's programme,
  // and the publications table has always said so.
  { id: '3', name: 'Marie Claire Prix d\'Excellence', edition: '2026', winnerCount: 19, announcedDate: 'May 2026', region: 'France' },
  { id: '5', name: 'Marie Claire Reader\'s Choice', edition: '2026', winnerCount: 57, announcedDate: '15 Apr 2026', region: 'US', justAdded: true },
  { id: '4', name: 'NewBeauty Annual Awards', edition: '2026', winnerCount: 357, announcedDate: '31 Mar 2026', region: 'US' },
  { id: '12', name: 'Glamour Beauty Awards', edition: '2026', winnerCount: 248, announcedDate: '18 Mar 2026', region: 'US' },
  // The second of Harper's Bazaar's two US programmes. The article publishes no
  // retailer links at all, so all 27 were linked by hand on 2026-10-01; 26 of
  // 27 now carry a packshot AND a verified link, which is what the grid needs.
  { id: '15', name: 'Harper\'s Bazaar Hair Awards', edition: '2026', winnerCount: 27, announcedDate: '11 Feb 2026', region: 'US', recordName: "Harper's Bazaar Hair Awards", justAdded: true },
  // ELLE's global programme — editors across ~50 ELLE editions vote, one winner
  // per category, 14th edition. Announced January 2026 and found on 2026-10-01
  // because every other Elle entry in the calendar pointed at October.
  //
  // Sourced from ELLE Sweden and ELLE Poland republishing the full
  // international list, cross-checked line by line, because the canonical site
  // is blocked by SNI filtering on this network and loads in no client here.
  // Sascha asked for it on the site on that basis. See the _sourcing_note in
  // data/awards/elle-international-beauty-awards-2026.json; re-verify against
  // the canonical page if it ever becomes reachable.
  //
  // 13 of the 20 now have both a packshot and a verified link and so appear on
  // the grid; the rest join as images land. Six brands (Aesop, Biotherm,
  // Lancôme, Kérastase, Dyson, Bioderma) bot-wall image harvesting even though
  // their links verified in a browser.
  { id: '16', name: 'ELLE International Beauty Awards', edition: '2026', winnerCount: 20, announcedDate: 'Jan 2026', region: 'International', recordName: 'ELLE International Beauty Awards', justAdded: true },
  { id: '13', name: 'Glowpick Awards', edition: '2026', winnerCount: 491, announcedDate: 'H1 2026', region: 'Korea' },
  { id: '14', name: 'Hwahae Beauty Awards', edition: '2026', winnerCount: 408, announcedDate: '2026', region: 'Korea' },
];

export async function getAwardPrograms(): Promise<AwardProgram[]> {
  const products = await getProducts();
  return awardProgramsRaw.map(p => ({
    ...p,
    winnerCount: winnersOnSite(products, p) || p.winnerCount,   // fall back only if nothing matches
  }));
}

export const pressArticles: PressArticle[] = [
  {
    id: '5',
    title: 'Three Editors Test the Viral Medicube PDRN Serum—and It’s 20% Off for Prime Day',
    source: 'Glamour',
    sourceUrl: 'https://www.glamour.com/story/medicube-pdrn-serum-review',
    productName: 'medicube PDRN Pink Peptide Serum',
    productSlug: 'medicube-pdrn-pink-peptide-serum',
  },
  {
    id: '3',
    title: 'The Reformulated SkinCeuticals C E Ferulic Is Even Better Than I Expected',
    source: 'Vogue',
    sourceUrl: 'https://www.vogue.com/article/skinceuticals-ce-ferulic-reformulation',
    productName: 'SkinCeuticals C E Ferulic',
    productSlug: 'skinceuticals-c-e-ferulic',
  },
  {
    id: '1',
    title: 'The Ordinary\'s Hyaluronic Acid Serum Packs 6 Benefits Into One Bottle',
    source: 'Vogue',
    sourceUrl: 'https://www.vogue.com/article/the-ordinary-hyaluronic-acid-serum',
    productName: 'The Ordinary Hyaluronic Acid 2% + B5 (with Ceramides)',
    productSlug: 'the-ordinary-hyaluronic-acid-2----b5--with-ceramides-',
  },
  {
    id: '4',
    title: 'Everyone\'s Favorite Vitamin C Serum Just Got a Major Upgrade',
    source: 'Allure',
    sourceUrl: 'https://www.allure.com/story/skinceuticals-c-e-ferulic-serum-reformulation-2026',
    productName: 'SkinCeuticals C E Ferulic',
    productSlug: 'skinceuticals-c-e-ferulic',
  },
];

/**
 * The publications strip under the hero, DERIVED from the catalogue.
 *
 * It was a hand-written list of nine Western titles while the site actually
 * held awards from twelve: Glowpick, Hwahae and Olive Young were missing, and
 * between them they account for over 700 products. "Cross-referenced against"
 * is a claim about the record, so it has to be read off the record — and a
 * hand-kept list silently understates it every time a programme is added.
 *
 * Programme names collapse to their parent title, so Allure Best of Beauty and
 * Allure Readers' Choice show once as "Allure".
 */
const PARENT_TITLE: Array<[RegExp, string]> = [
  [/^Allure/i, 'Allure'],
  [/^Vogue/i, 'Vogue'],
  [/^Harper's Bazaar/i, "Harper's Bazaar"],
  [/^ELLE|^Elle/i, 'Elle'],
  [/^Marie Claire/i, 'Marie Claire'],
  [/^Glamour/i, 'Glamour'],
  [/^InStyle/i, 'InStyle'],
  [/^Cosmopolitan/i, 'Cosmopolitan'],
  [/^NewBeauty/i, 'NewBeauty'],
  [/^Glowpick/i, 'Glowpick'],
  [/^Hwahae/i, 'Hwahae'],
  [/^Olive Young/i, 'Olive Young'],
];

export async function getPublicationTitles(): Promise<string[]> {
  const seen = new Set<string>();
  for (const p of await getProducts()) {
    for (const w of p.awardsWon || []) {
      const m = w.match(/^(.*?)\s+(?:—|\()/);
      if (!m) continue;
      const prog = m[1].trim();
      const hit = PARENT_TITLE.find(([re]) => re.test(prog));
      seen.add(hit ? hit[1] : prog);
    }
  }
  // keep the curated order, then anything new the map has not been taught
  const ordered = PARENT_TITLE.map(([, title]) => title).filter(t => seen.has(t));
  const extra = [...seen].filter(t => !ordered.includes(t)).sort();
  return [...ordered, ...extra];
}

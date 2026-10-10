import productsJson from './products.json';
import { subcategoryFor } from './taxonomy';
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
export const products2026: Product[] = (productsJson as Product[]).map(p => ({
  ...p,
  subcategory: subcategoryFor(p.category, p.subcategory, p.name),
  // Only while the card still points at the link the price was read from.
  // Korean products show Olive Young US's USD price even where the publication
  // printed one (Sascha, 2026-10-01); for everything else the publication's
  // price wins.
  retail: retailPrices[p.slug] && (!p.price || retailPrices[p.slug].at === 'Olive Young') ? retailPrices[p.slug] : undefined,
}));

// The price a shopper sees: what the publication printed, else the current
// shop price. `price` itself stays the publication's — the sale page compares
// against it.
export function shownPrice(p: Product): number | null {
  if (p.retail?.at === 'Olive Young') return p.retail.price;
  return p.price ?? p.retail?.price ?? null;
}

const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' };

export function formatPrice(n: number, currency = 'USD'): string {
  return `${SYMBOL[currency] ?? `${currency} `}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

// Display string for a card: the publication's price, else the shop price in
// the shop's own currency (a UK listing stays in pounds — converting would
// show a price no shop charges).
export function priceLabel(p: Product): string | null {
  if (p.retail?.at === 'Olive Young') return formatPrice(p.retail.price, p.retail.currency);
  if (p.price) return formatPrice(p.price);
  if (p.retail) return formatPrice(p.retail.price, p.retail.currency);
  return null;
}

// The grids feature only winners a reader can actually buy. A product with no
// working buy link keeps its page (search, sitemap, direct links) but stays off
// the homepage and browse grids until a link sitting finds one — Sascha,
// 2026-09-28: "whats the point of featuring them".
export const shoppable: Product[] = products2026.filter(p => p.buyLink);

export const awardPrograms: AwardProgram[] = [
  // Newest first. This list had drifted badly out of step with the record: it
  // showed 8 programmes while the database held 14 for 2026, so Cosmopolitan's
  // 342-winner Holy Grail class, Glamour's 248 and both Harper's Bazaar
  // programmes were live on product pages but invisible here. Counts below are
  // the award rows actually in the database, not a publication's headline claim
  // — see the Allure 319-vs-307 and Cosmo 151-vs-134 notes in data/awards.
  // Marie Claire merged its Skin & Hair and Makeup awards for 2026 and added
  // Nails, Body Care and Drugstore. 213 winners, and unusually the publication
  // prints a retailer URL for every one, so 211 of 213 arrived buyable.
  { id: '17', name: 'Marie Claire Beauty Awards', edition: '2026', winnerCount: 213, announcedDate: 'Oct 2026', region: 'US', recordName: 'Marie Claire Beauty Awards', justAdded: true },
  { id: '9', name: 'Harper\'s Bazaar UK Best of the Best', edition: '2026', winnerCount: 93, announcedDate: 'Sep 2026', region: 'UK', recordName: "Harper's Bazaar UK Best of the Best", justAdded: true },
  { id: '8', name: 'NewBeauty Readers\' Choice', edition: '2026', winnerCount: 104, announcedDate: '29 Sep 2026', region: 'US', recordName: 'NewBeauty Readers Choice', justAdded: true },
  { id: '6', name: 'Allure Best of Beauty', edition: '2026', winnerCount: 307, announcedDate: '15 Sep 2026', region: 'US', justAdded: true },
  { id: '7', name: 'Cosmopolitan Readers\' Choice', edition: '2026', winnerCount: 126, announcedDate: '2 Sep 2026', region: 'US', recordName: 'Cosmopolitan Readers Choice', justAdded: true },
  { id: '1', name: 'Allure Readers\' Choice', edition: '2026', winnerCount: 66, announcedDate: 'Jun 2026', region: 'US' },
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

export const pressArticles: PressArticle[] = [
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

export const publications = [
  'Allure', 'Vogue', 'Harper\'s Bazaar', 'Elle',
  'Marie Claire', 'Glamour', 'InStyle', 'Cosmopolitan', 'NewBeauty'
];

// ---- Saved products: shared interface and localStorage helpers ----

export interface SavedProduct {
  id: string;
  slug: string;
  brand: string;
  name: string;
  price: number | null;
  image: string;
  topAward: string | null;
  awardCount: number;
  savedAt: string; // ISO string
}

const SAVED_KEY = 'vettbeauty-saved';

// Safe localStorage access (handles SSR)
function getStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

function setStorage(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_KEY, value);
  } catch {
    // Quota exceeded or private mode
  }
}

function notifyUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vettbeauty-saved-updated'));
  }
}

export function getSaved(): SavedProduct[] {
  const raw = getStorage();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function isSaved(slug: string): boolean {
  return getSaved().some((p) => p.slug === slug);
}

export function toggleSave(product: Omit<SavedProduct, 'savedAt'>): boolean {
  const saved = getSaved();
  const existingIndex = saved.findIndex((p) => p.slug === product.slug);

  if (existingIndex >= 0) {
    saved.splice(existingIndex, 1);
    setStorage(JSON.stringify(saved));
    notifyUpdate();
    return false;
  } else {
    const newProduct: SavedProduct = {
      ...product,
      savedAt: new Date().toISOString(),
    };
    setStorage(JSON.stringify([...saved, newProduct]));
    notifyUpdate();
    return true;
  }
}

export function removeSaved(slug: string): void {
  const saved = getSaved().filter((p) => p.slug !== slug);
  setStorage(JSON.stringify(saved));
  notifyUpdate();
}

export function getSavedCount(): number {
  return getSaved().length;
}

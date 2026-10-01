import productsJson from './products.json';
import { subcategoryFor } from './taxonomy';

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
}

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
}));

// The grids feature only winners a reader can actually buy. A product with no
// working buy link keeps its page (search, sitemap, direct links) but stays off
// the homepage and browse grids until a link sitting finds one — Sascha,
// 2026-09-28: "whats the point of featuring them".
export const shoppable: Product[] = products2026.filter(p => p.buyLink);

export const awardPrograms: AwardProgram[] = [
  { id: '8', name: 'NewBeauty Readers\' Choice', edition: '2026', winnerCount: 104, announcedDate: '29 Sep 2026', region: 'US', recordName: 'NewBeauty Readers Choice', justAdded: true },
  { id: '6', name: 'Allure Best of Beauty', edition: '2026', winnerCount: 307, announcedDate: '15 Sep 2026', region: 'US', justAdded: true },
  { id: '7', name: 'Cosmopolitan Readers\' Choice', edition: '2026', winnerCount: 126, announcedDate: '2 Sep 2026', region: 'US', recordName: 'Cosmopolitan Readers Choice', justAdded: true },
  { id: '5', name: 'Marie Claire Reader\'s Choice', edition: '2026', winnerCount: 57, announcedDate: '15 Apr 2026', region: 'US', justAdded: true },
  { id: '1', name: 'Allure Readers\' Choice', edition: '2026', winnerCount: 66, announcedDate: 'Jun 2026', region: 'US' },
  { id: '2', name: 'InStyle Best Beauty Buys', edition: '2026', winnerCount: 154, announcedDate: '20 May 2026', region: 'US' },
  { id: '3', name: 'Marie Claire Prix d\'Excellence', edition: '2026', winnerCount: 19, announcedDate: 'May 2026', region: 'US' },
  { id: '4', name: 'NewBeauty Annual Awards', edition: '2026', winnerCount: 357, announcedDate: '31 Mar 2026', region: 'US' },
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

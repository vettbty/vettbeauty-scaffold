import productsJson from './products.json';

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
}

export interface PressArticle {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  productName: string;
  productSlug: string;
}

export const products2026: Product[] = productsJson as Product[];

export const awardPrograms: AwardProgram[] = [
  { id: '1', name: 'Allure Readers\' Choice', edition: '2026', winnerCount: 66, announcedDate: 'Jun 2026', region: 'US' },
  { id: '2', name: 'InStyle Best Beauty Buys', edition: '2026', winnerCount: 154, announcedDate: '20 May 2026', region: 'US' },
  { id: '3', name: 'Marie Claire Prix d\'Excellence', edition: '2026', winnerCount: 19, announcedDate: 'May 2026', region: 'US' },
  { id: '4', name: 'NewBeauty Annual Awards', edition: '2026', winnerCount: 357, announcedDate: '31 Mar 2026', region: 'US' },
];

export const pressArticles: PressArticle[] = [
  {
    id: '1',
    title: 'The Ordinary\'s Hyaluronic Acid Serum Packs 6 Benefits Into One Bottle',
    source: 'Vogue',
    sourceUrl: 'https://www.vogue.com/article/the-ordinary-hyaluronic-acid-serum-review',
    productName: 'The Ordinary Hyaluronic Acid 2% + B5 (with Ceramides)',
    productSlug: 'the-ordinary-hyaluronic-acid',
  },
  {
    id: '2',
    title: 'Oribe Just Recalled a Popular Shampoo for Potential Contamination',
    source: 'Allure',
    sourceUrl: 'https://www.allure.com/story/oribe-shampoo-recall',
    productName: 'Oribe Serene Scalp Densifying Shampoo',
    productSlug: 'oribe-serene-scalp-shampoo',
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

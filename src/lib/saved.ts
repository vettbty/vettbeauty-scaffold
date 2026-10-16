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

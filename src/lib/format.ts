import type { Product } from './data';

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

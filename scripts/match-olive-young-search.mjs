/**
 * Matches Olive Young US search results to Korean products and records the
 * USD price Olive Young lists (Sascha, 2026-10-01: Korean products show the
 * Olive Young US price, whatever the buy link).
 *
 *   node scripts/match-olive-young-search.mjs <queries.json> <results.json>
 *   node scripts/match-olive-young-search.mjs <queries.json> <results.json> --write
 *
 * <queries.json>: [[slug, query], ...]. <results.json>: { query: { total,
 * items: [{ id, name, brand, price, list, inStock }] } } as read from
 * us.oliveyoung.com/search.data in a browser tab (the site answers scripts with
 * 403). `price` is the current selling price (sale price when on offer).
 *
 * A result counts only when its title names our product: same token overlap
 * rule as harvest-brand-copy.mjs (≥0.8 both ways once brand and size words are
 * stripped), not a set / mini / refill unless ours is, and a clear winner. Where
 * the same product is listed in several sizes, the full size wins (the larger
 * ml/g figure). Borderline pairs go to a review file instead of the site.
 */
import fs from 'node:fs';

const [qFile, rFile] = process.argv.slice(2);
const WRITE = process.argv.includes('--write');
const OUT = './src/lib/retail-prices.json';
const queries = JSON.parse(fs.readFileSync(qFile, 'utf8'));
const results = JSON.parse(fs.readFileSync(rFile, 'utf8'));
const products = new Map(JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8')).map(p => [p.slug, p]));
const store = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[™®'’]/g, '').replace(/[^a-z0-9.]+/g, ' ').trim();
const STOP = new Set(['the', 'and', 'for', 'with', 'of', 'in', 'a', 'new', 'best', 'ea', 'x', 'oz', 'fl', 'ml', 'g', 'pcs', 'sheets', 'pads', 'count']);
const toks = (s, brand) => {
  const b = new Set(fold(brand).split(' '));
  return fold(s).replace(/\b\d+(\.\d+)?\s?(ml|g|oz|fl|ea|pcs|sheets?|pads?|count|mg)\b/g, ' ')
    .split(' ').filter(w => w && w.length > 1 && !STOP.has(w) && !b.has(w) && !/^\d+(\.\d+)?$/.test(w));
};
const SET = /\b(set|duo|trio|kit|bundle|mini|refill|travel|special|edition|1\+1|2-?pack|twin|value|x ?[2-9]\b|\(\d+ea\))/i;
const sizeOf = (name) => {
  const m = fold(name).match(/(\d+(?:\.\d+)?)\s?(ml|g)\b/);
  return m ? Number(m[1]) : 0;
};

const accepted = [], review = [], none = [];
for (const [slug, q] of queries) {
  const p = products.get(slug);
  const raw = results[q];
  const res = Array.isArray(raw) ? raw : raw?.items;
  if (!p || !Array.isArray(res)) continue;
  const ours = toks(p.name, p.brand);
  if (!ours.length) continue;
  const bkey = (b) => fold(b).replace(/[^a-z0-9]/g, '');
  const brandHit = (r) => r.brand
    ? (bkey(r.brand).includes(bkey(p.brand).slice(0, 5)) || bkey(p.brand).includes(bkey(r.brand).slice(0, 5)))
    : fold(r.name).includes(fold(p.brand).split(' ')[0]);
  const scored = res.filter(r => r.price > 0 && brandHit(r) && (!SET.test(r.name) || SET.test(p.name)))
    .map(r => {
      const theirs = toks(r.name.replace(/^BEST/, ''), p.brand);
      const A = new Set(ours), B = new Set(theirs);
      const fwd = ours.filter(w => B.has(w)).length / ours.length;
      const rev = theirs.length ? theirs.filter(w => A.has(w)).length / theirs.length : 0;
      return { ...r, fwd, rev, s: Math.min(fwd, rev) };
    })
    .sort((a, b) => b.s - a.s || sizeOf(b.name) - sizeOf(a.name));
  const top = scored[0];
  if (!top || top.fwd < 0.6) { none.push(slug); continue; }
  // Same title in several sizes counts as one product; anything else close
  // behind the winner makes it ambiguous.
  const base = (n) => toks(n, p.brand).join(' ');
  const rivals = scored.filter(r => r !== top && r.s >= top.s - 0.1 && base(r.name) !== base(top.name));
  const row = { slug, ours: `${p.brand} ${p.name}`, theirs: top.name, id: top.id, price: top.price, list: top.list ?? null, inStock: top.inStock ?? null, fwd: +top.fwd.toFixed(2), rev: +top.rev.toFixed(2) };
  if (top.fwd >= 0.8 && top.rev >= 0.8 && !rivals.length) accepted.push(row);
  else review.push({ ...row, rivals: rivals.slice(0, 2).map(r => r.name) });
}

if (WRITE) {
  for (const r of accepted) {
    store[r.slug] = { price: r.price, ...(r.list && r.list !== r.price ? { list: r.list } : {}), currency: 'USD', at: 'Olive Young', checked: today,
      url: products.get(r.slug).buyLink, via: 'olive-young-search', oy: `https://us.oliveyoung.com/products/${r.id}` };
  }
  fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(store).sort()), null, 1) + '\n');
}
fs.writeFileSync('../outputs/olive-young-price-review.json', JSON.stringify({ review, notOnOliveYoung: none }, null, 1));
console.log(`${accepted.length} matched${WRITE ? ' and written' : ''} · ${review.length} to review · ${none.length} not on Olive Young US`);
for (const r of accepted.slice(0, 25)) console.log(`  ${r.price.toString().padStart(6)}  ${r.ours.slice(0, 55).padEnd(56)} = ${r.theirs.slice(0, 70)}`);

/**
 * Builds src/lib/retail-prices.json: the current shop price for products whose
 * awarding publication printed none, keyed by slug.
 *
 *   node scripts/sync-retail-prices.mjs
 *
 * WHY. `price` in products.json is the price the publication printed — the
 * sale page compares against it — so it stays empty when the publication gave
 * none. That left 1,585 buyable products showing no price at all while their
 * buy button led to a page with one (Sascha, 2026-10-01: "medik 8 has no price
 * and when you click link it takes you to product site with a price"). This is
 * a separate store, shown only where `price` is empty, labelled with the shop
 * and the date it was read.
 *
 * Sources, keyed by the product's buy link (never by name):
 *   1. ../src/lib/retail-prices.json — prices read from each product's own
 *      verified link (keyed by DB id; joined via ../src/lib/exact-links.json)
 *   2. ../outputs/shopmy-card-prices.json — the price on the ShopMy card
 *   3. entries already in this file from fetch-retail-prices.mjs / browser
 *      passes (kept unless a source above is newer)
 */
import fs from 'node:fs';

const OUT = './src/lib/retail-prices.json';
const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
const links = JSON.parse(fs.readFileSync('../src/lib/exact-links.json', 'utf8')).links;
const retail = JSON.parse(fs.readFileSync('../src/lib/retail-prices.json', 'utf8')).prices;
const cards = JSON.parse(fs.readFileSync('../outputs/shopmy-card-prices.json', 'utf8')).prices;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const idByUrl = new Map();
for (const [id, l] of Object.entries(links)) if (l.url) idByUrl.set(l.url, id);

const out = {};
let fromRetail = 0, fromCard = 0, kept = 0;
for (const p of products) {
  if (!p.buyLink) continue;
  // Olive Young US prices stand even over a publication price — Korean
  // products show Olive Young's USD price (Sascha, 2026-10-01). Everything else
  // only gets a shop price where the publication printed none.
  if (p.price) { if (prev[p.slug]?.at === 'Olive Young') out[p.slug] = prev[p.slug]; continue; }
  const id = idByUrl.get(p.buyLink);
  const cands = [];
  if (id && retail[id]?.price > 0) {
    const r = retail[id];
    cands.push({ price: r.price, at: cards[id]?.via ?? links[id]?.via ?? r.retailer, checked: r.checked, src: 'retail' });
  }
  if (id && cards[id]?.price > 0) cands.push({ price: cards[id].price, at: cards[id].via, checked: cards[id].seen, src: 'card' });
  if (prev[p.slug]?.price > 0) cands.push({ ...prev[p.slug], src: 'prev' });
  // An Olive Young price is the rule for Korean products, not just the newest.
  if (prev[p.slug]?.at === 'Olive Young') { out[p.slug] = prev[p.slug]; kept++; continue; }
  if (!cands.length) continue;
  const best = cands.sort((a, b) => String(b.checked).localeCompare(String(a.checked)))[0];
  const { src, ...entry } = best;
  out[p.slug] = { ...entry, at: best.at ?? null, url: p.buyLink };
  if (best.src === 'retail') fromRetail++; else if (best.src === 'card') fromCard++; else kept++;
}
fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 1) + '\n');
const missing = products.filter(p => p.buyLink && !p.price && !out[p.slug]);
console.log(`${Object.keys(out).length} retail prices (${fromRetail} verified-link, ${fromCard} ShopMy card, ${kept} fetched earlier) · ${missing.length} buyable products still without any price`);

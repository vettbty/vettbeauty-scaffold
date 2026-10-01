/**
 * Merges prices read in a browser tab (Amazon, Olive Young US — both refuse
 * scripted requests) into src/lib/retail-prices.json.
 *
 *   node scripts/ingest-browser-prices.mjs <results.json> "<shop name>" <url-prefix>
 *
 * <results.json> maps the id in the product's buy link (ASIN, Olive Young
 * UA-number) to what the page showed: { state, price, currency?, name? }.
 * <url-prefix> rebuilds the buy link from the id ("https://www.amazon.com/dp/").
 * Only `live` pages with a price are kept; everything else is listed so the
 * dead buy buttons can be fixed.
 */
import fs from 'node:fs';

const [file, shop, prefix] = process.argv.slice(2);
const OUT = './src/lib/retail-prices.json';
const results = JSON.parse(fs.readFileSync(file, 'utf8'));
const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
const store = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const idOf = (url) => url.startsWith(prefix) ? url.slice(prefix.length).split(/[?/#]/)[0] : null;
let added = 0;
const notLive = [];
for (const p of products) {
  // Olive Young US prices apply even over a publication price: Korean
  // products show Olive Young's USD price (Sascha, 2026-10-01).
  if (!p.buyLink || (p.price && shop !== 'Olive Young')) continue;
  const id = idOf(p.buyLink);
  const r = id && results[id];
  if (!r) continue;
  if (r.state === 'live' && r.price > 0) {
    store[p.slug] = { price: r.price, currency: r.currency ?? 'USD', at: shop, checked: today, url: p.buyLink, via: 'browser' };
    added++;
  } else notLive.push(`${r.state}\t${p.slug}\t${p.buyLink}`);
}
fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(store).sort()), null, 1) + '\n');
const report = `../outputs/buy-links-not-live-${shop.toLowerCase().replace(/\W+/g, '-')}-${today}.tsv`;
fs.writeFileSync(report, notLive.sort().join('\n') + '\n');
console.log(`${added} ${shop} prices added · ${notLive.length} not live (${report})`);

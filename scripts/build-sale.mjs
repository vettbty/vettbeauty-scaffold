// Joins the price-watch feed (deals-src.json, copied from the main repo) with
// the site catalogue so sale cards get slugs, cutout images and award badges.
import fs from 'fs';
const deals = JSON.parse(fs.readFileSync('./src/lib/deals-src.json', 'utf-8'));
const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const bySig = new Map(products.map(p => [norm(p.brand + ' ' + p.name), p]));
const items = deals.items.map(d => {
  const p = bySig.get(norm(d.brand + ' ' + d.product));
  return {
    brand: d.brand, product: d.product, retailer: d.retailer,
    was: d.was, now: d.now, percentOff: d.percentOff, url: d.url,
    size: d.size ?? null,
    slug: p?.slug ?? null, image: p?.image ?? null,
    imageCutout: p?.imageCutout ?? false, topAward: p?.topAward ?? null,
  };
}).sort((a, b) => b.percentOff - a.percentOff);
fs.writeFileSync('./src/lib/sale.json', JSON.stringify({ generated: deals.generated, items }, null, 1));
console.log(`sale.json: ${items.length} deals, ${items.filter(i => i.image).length} with catalogue images`);

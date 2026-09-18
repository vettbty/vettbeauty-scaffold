// Joins the price-watch feed (deals-src.json, copied from the main repo) with
// the site catalogue so sale cards get slugs, cutout images and award badges.
//
// The join also carries the fields the sale page filters on — category,
// subcategory, awardCount, awardsWon. They cost nothing here (we already hold
// the catalogue row) and the page cannot recover them on its own.
import fs from 'fs';

const deals = JSON.parse(fs.readFileSync('./src/lib/deals-src.json', 'utf-8'));
const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'));

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const bySig = new Map(products.map(p => [norm(p.brand + ' ' + p.name), p]));

// The price checker writes retailer names in whatever case the scraper saw
// ("ulta" and "Ulta" both occur), which splits one retailer into two buckets
// the moment anything groups by it. Canonicalise on the way in.
const RETAILERS = { amazon: 'Amazon', ulta: 'Ulta', dermstore: 'Dermstore', sephora: 'Sephora' };
const retailerName = (r) => {
  if (!r) return null;
  const key = r.trim().toLowerCase();
  return RETAILERS[key] ?? key.replace(/\b[a-z]/g, c => c.toUpperCase());
};

const unmatched = [];
const items = deals.items.map(d => {
  const p = bySig.get(norm(d.brand + ' ' + d.product));
  if (!p) unmatched.push(`${d.brand} ${d.product}`);
  return {
    brand: d.brand, product: d.product, retailer: retailerName(d.retailer),
    was: d.was, now: d.now, percentOff: d.percentOff, url: d.url,
    size: d.size ?? null,
    slug: p?.slug ?? null, image: p?.image ?? null,
    imageCutout: p?.imageCutout ?? false, topAward: p?.topAward ?? null,
    category: p?.category ?? null, subcategory: p?.subcategory ?? null,
    awardCount: p?.awardCount ?? 0, awardsWon: p?.awardsWon ?? [],
  };
}).sort((a, b) => b.percentOff - a.percentOff);

fs.writeFileSync('./src/lib/sale.json', JSON.stringify({ generated: deals.generated, items }, null, 1));

const retailers = [...new Set(items.map(i => i.retailer))].sort().join(', ');
console.log(`sale.json: ${items.length} deals, ${items.filter(i => i.image).length} with catalogue images`);
console.log(`  retailers: ${retailers}`);
console.log(`  categories: ${[...new Set(items.map(i => i.category).filter(Boolean))].sort().join(', ')}`);
if (unmatched.length) {
  // A deal with no catalogue row renders without an image, award or product
  // link. Usually it matched a products.json row that has not been committed.
  console.log(`  ${unmatched.length} deal(s) matched NO catalogue row:`);
  unmatched.forEach(u => console.log(`    - ${u}`));
}

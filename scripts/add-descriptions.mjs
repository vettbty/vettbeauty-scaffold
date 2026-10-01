/**
 * Merges a batch of written descriptions into src/lib/descriptions.json.
 *
 *   node scripts/add-descriptions.mjs <batch.json>
 *
 * A batch is { slug: { text, star: [{ name, does }] } }. The source URL is
 * taken from ../outputs/brand-copy-raw.json, never typed, so every published
 * description points at the brand page it was written from. A slug with no
 * harvested brand page is refused.
 */
import fs from 'node:fs';
const FILE = './src/lib/descriptions.json';
const raw = JSON.parse(fs.readFileSync('../outputs/brand-copy-raw.json', 'utf8'));
const products = new Set(JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8')).map(p => p.slug));
const batch = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
let added = 0;
for (const [slug, d] of Object.entries(batch)) {
  const src = raw[slug]?.url;
  if (!products.has(slug)) { console.error(`refused ${slug}: not in products.json`); continue; }
  if (!src) { console.error(`refused ${slug}: no harvested brand page`); continue; }
  if (!d.text || d.text.length < 40) { console.error(`refused ${slug}: text too short`); continue; }
  out[slug] = { text: d.text.trim(), star: d.star ?? [], source: src, written: today };
  added++;
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(FILE, JSON.stringify(sorted, null, 1) + '\n');
console.log(`${added} added · ${Object.keys(sorted).length} total`);

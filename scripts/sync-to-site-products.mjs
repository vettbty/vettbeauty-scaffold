/**
 * Upserts src/lib/products.json into Supabase `site_products` by hand.
 *
 *   node scripts/sync-to-site-products.mjs
 *
 * convert-csv.js already does this at the end of every regenerate; this is for
 * re-sending the current file without regenerating. The work, the env it
 * needs and the no-delete rule all live in scripts/lib/site-products.mjs.
 */
import fs from 'node:fs';
import { upsertSiteProducts } from './lib/site-products.mjs';

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
try {
  await upsertSiteProducts(products);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

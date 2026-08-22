// Pulls real image URLs from the master Supabase catalogue and writes
// src/lib/db-images.json keyed "brand||name" (name = sourced English name
// where one exists, else the recorded product name — matching how the
// workbook, and therefore products.csv, prints the Product column).
import fs from 'fs';

const envFile = fs.readFileSync('../.env.local', 'utf-8');
const env = {};
for (const l of envFile.split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const englishNames = JSON.parse(fs.readFileSync('../src/lib/english-names.json', 'utf-8')).names || {};

async function page(table, select) {
  let all = [], from = 0;
  for (;;) {
    const res = await fetch(`${BASE}/rest/v1/${table}?select=${select}&offset=${from}&limit=1000`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    all = all.concat(data);
    if (data.length < 1000) return all;
    from += 1000;
  }
}

const prods = await page('products', 'id,brand,product_name,image_url');
const map = {};
let withImage = 0;
for (const p of prods) {
  if (!p.image_url) continue;
  withImage++;
  const en = englishNames[p.id]?.english;
  const name = en || p.product_name;
  map[`${p.brand}||${name}`] = p.image_url;
}
fs.writeFileSync('./src/lib/db-images.json', JSON.stringify(map, null, 1));
console.log(`db products: ${prods.length}, with image: ${withImage}, keys written: ${Object.keys(map).length}`);

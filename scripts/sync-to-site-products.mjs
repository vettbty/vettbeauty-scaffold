/**
 * Upserts src/lib/products.json into Supabase `site_products`, the table the
 * site reads its catalogue from (see readCatalogue() in src/lib/data.ts).
 *
 *   node scripts/sync-to-site-products.mjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, read from the
 * environment or from this repo's .env.local (gitignored). Never from the data
 * repo's: the site's table and credentials belong to this repo.
 *
 * NO DELETE STEP, on purpose. Rows in the table whose slug has left the JSON
 * stay until that list has been reviewed; the script only reports them. The
 * master `products` table is never touched.
 */
import fs from 'node:fs';
import { consensusCount } from '../src/lib/consensus.ts';

const env = { ...process.env };
for (const f of ['.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY || /PASTE_/.test(URL_ + KEY)) { console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local (placeholders not yet replaced?)'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const TABLE = `${URL_}/rest/v1/site_products`;

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
const rows = products.map(p => ({
  id: p.id,
  slug: p.slug,
  brand: p.brand,
  name: p.name,
  category: p.category ?? null,
  subcategory: p.subcategory ?? null,
  region: p.region ?? null,
  price: p.price ?? null,
  image: p.image ?? null,
  image_cutout: p.imageCutout ?? null,
  buy_link: p.buyLink || null,
  top_award: p.topAward ?? null,
  award_count: p.awardCount ?? null,
  consensus_count: consensusCount(p.awardsWon ?? []),
  awards_won: p.awardsWon ?? [],
  data: p,                       // the raw row; the site enriches it at read time
  updated_at: new Date().toISOString(),
}));

// Every slug in the table, paged: PostgREST caps a response at 1,000 rows.
async function tableSlugs() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${TABLE}?select=slug&order=slug`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`read failed: ${r.status} ${await r.text()}`);
    const page = await r.json();
    out.push(...page.map(x => x.slug));
    if (page.length < 1000) return out;
  }
}

let upserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500);
  const r = await fetch(`${TABLE}?on_conflict=slug&select=slug`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(batch),
  });
  if (!r.ok) { console.error(`batch at ${i} failed: ${r.status} ${await r.text()}`); process.exit(1); }
  upserted += (await r.json()).length;
}

const inTable = await tableSlugs();
const tableSet = new Set(inTable), jsonSet = new Set(rows.map(r => r.slug));
const missing = rows.filter(r => !tableSet.has(r.slug)).map(r => r.slug);
const stale = inTable.filter(s => !jsonSet.has(s));
console.log(`sent ${rows.length} / upserted ${upserted} / total rows in table ${inTable.length} / slugs missing from table ${missing.length}`);
if (missing.length) console.log('missing:', missing.slice(0, 20).join(', '));
console.log(`rows in table no longer in the JSON (NOT deleted, for review): ${stale.length}`);
if (stale.length) console.log(stale.slice(0, 50).join('\n'));

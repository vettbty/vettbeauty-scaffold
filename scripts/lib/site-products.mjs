/**
 * The one implementation of "put the built catalogue into Supabase
 * site_products". Used by scripts/convert-csv.js (at the end of every
 * regenerate) and scripts/sync-to-site-products.mjs (by hand).
 *
 *   import { upsertSiteProducts } from './lib/site-products.mjs';
 *   await upsertSiteProducts(products);   // the final products.json rows
 *
 * Upserts on slug in batches of 500. NO DELETE STEP: slugs in the table that
 * have left products.json are reported, never removed. After a successful run
 * it asks the live site to refresh (POST /api/revalidate) when REVALIDATE_SECRET
 * is set; without it the site picks the change up on its normal revalidate
 * times (/ 1h, product pages 1d).
 *
 * Env, from the shell or either .env.local (this repo's first, then the data
 * repo's): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * REVALIDATE_SECRET, and optionally SITE_URL (default https://vettbeauty.com).
 *
 * Never writes the master `products` table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consensusCount } from '../../src/lib/consensus.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BATCH = 500;

function loadEnv() {
  const env = { ...process.env };
  for (const f of [path.join(ROOT, '.env.local'), path.join(ROOT, '../.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const toRow = (p, now) => ({
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
  updated_at: now,
});

export async function upsertSiteProducts(products, { log = console.log } = {}) {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || /PASTE_/.test(url + key)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local)');
  }
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const TABLE = `${url}/rest/v1/site_products`;
  const now = new Date().toISOString();
  const rows = products.map(p => toRow(p, now));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const r = await fetch(`${TABLE}?on_conflict=slug&select=slug`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows.slice(i, i + BATCH)),
    });
    if (!r.ok) throw new Error(`site_products batch at ${i} failed: ${r.status} ${await r.text()}`);
    upserted += (await r.json()).length;
  }

  // Every slug in the table, paged: PostgREST caps a response at 1,000 rows.
  const inTable = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${TABLE}?select=slug&order=slug`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`site_products read failed: ${r.status} ${await r.text()}`);
    const page = await r.json();
    inTable.push(...page.map(x => x.slug));
    if (page.length < 1000) break;
  }
  const tableSet = new Set(inTable), jsonSet = new Set(rows.map(r => r.slug));
  const missing = rows.filter(r => !tableSet.has(r.slug)).map(r => r.slug);
  const stale = inTable.filter(s => !jsonSet.has(s));

  log(`site_products: sent ${rows.length} / upserted ${upserted} / total rows in table ${inTable.length} / slugs missing from table ${missing.length}`);
  if (missing.length) log('  missing: ' + missing.slice(0, 20).join(', '));
  log(`site_products: rows no longer in products.json (NOT deleted, for review): ${stale.length}`);
  if (stale.length) log(stale.slice(0, 50).map(s => '  ' + s).join('\n'));

  const refreshed = await requestRefresh(env, log);
  return { sent: rows.length, upserted, total: inTable.length, missing, stale, refreshed };
}

// Ask the live site to drop its cached catalogue now rather than at the next
// revalidate. A failure here never fails the run: the data is already in.
async function requestRefresh(env, log) {
  const secret = env.REVALIDATE_SECRET;
  if (!secret) {
    log('  ! REVALIDATE_SECRET not set — the site refreshes on its normal revalidate times');
    return false;
  }
  const site = env.SITE_URL || 'https://vettbeauty.com';
  try {
    const r = await fetch(`${site}/api/revalidate`, { method: 'POST', headers: { 'x-revalidate-secret': secret } });
    if (!r.ok) { log(`  ! refresh request to ${site} failed: ${r.status} — normal revalidate times apply`); return false; }
    log(`  refresh requested: ${site} ${JSON.stringify(await r.json())}`);
    return true;
  } catch (e) {
    log(`  ! refresh request to ${site} threw: ${e.message} — normal revalidate times apply`);
    return false;
  }
}

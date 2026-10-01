/**
 * Collects what each brand says about its own product — description and
 * ingredients — from the brand's own website, as raw material for the
 * descriptions we write in our own words (src/lib/descriptions.json).
 *
 *   node scripts/harvest-brand-copy.mjs                 # 2026 winners not yet harvested
 *   node scripts/harvest-brand-copy.mjs --slugs a,b,c   # just these
 *   node scripts/harvest-brand-copy.mjs --retry-misses  # re-try earlier misses too
 *
 * Writes ../outputs/brand-copy-raw.json (outside the site; nothing here is
 * published). Brand copy is the brand's own text — we read it for facts, we do
 * not reproduce it (Sascha, 2026-09-30: "our own words").
 *
 * Finding the page, in order:
 *   1. a product page already verified for this product (brand-store image
 *      matches, the 08-15 brand-assets pull)
 *   2. the brand's Shopify predictive search (/search/suggest.json), matched on
 *      the product's own title with the same two-way token overlap as
 *      search-brand-store.mjs — a store search always returns *something*; only
 *      a title that names our product counts
 * The brand's site comes from ../src/lib/brand-sites.json (1,005 brands, each
 * confirmed to resolve). Non-Shopify brands fall back to JSON-LD on a known
 * page; the rest are left as misses for a browser pass.
 */
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const OUT = '../outputs/brand-copy-raw.json';
const arg = (k) => { const i = process.argv.indexOf(k); return i === -1 ? null : process.argv[i + 1]; };

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
const sites = JSON.parse(fs.readFileSync('../src/lib/brand-sites.json', 'utf8')).sites;
const raw = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

// Pages already verified as this exact product.
const knownPage = {};
try {
  for (const [slug, c] of Object.entries(JSON.parse(fs.readFileSync('./src/lib/brand-search-candidates.json', 'utf8'))))
    if (c.from && c.score >= 0.8) knownPage[slug] = c.from;
} catch {}
try {
  const assets = JSON.parse(fs.readFileSync('../outputs/brand-assets-2026-08-15.json', 'utf8')).products;
  const bySig = new Map(products.map(p => [`${p.brand}|${p.name}`.toLowerCase(), p.slug]));
  for (const a of assets) {
    const slug = bySig.get(`${a.brand}|${a.product}`.toLowerCase());
    if (slug && a.product_page && !knownPage[slug]) knownPage[slug] = a.product_page;
  }
} catch {}

const brandKey = (b) => b.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const STOP = new Set(['the', 'and', 'for', 'with', 'set', 'kit', 'new', 'size', 'full', 'oz', 'ml', 'fl', 'pack', 'of', 'in', 'a', 'de', 'x']);
const toks = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w.length > 2 && !STOP.has(w));
function score(ourName, theirTitle, brand) {
  const brandToks = new Set(toks(brand));
  const a = toks(ourName).filter(w => !brandToks.has(w));
  const b = toks(theirTitle).filter(w => !brandToks.has(w));
  if (!a.length || !b.length) return 0;
  const inB = new Set(b), inA = new Set(a);
  return Math.max(a.filter(w => inB.has(w)).length / a.length, b.filter(w => inA.has(w)).length / b.length);
}
const NOT_THE_PRODUCT = /\b(swatch|sample|tester|refill|replacement|bundle|gift\s*set|travel\s*size|mini|trial|card|e-?gift|duo|trio|kit)\b/i;

async function get(url, json = false) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// Ingredient text on a product page: an "Ingredients" heading/tab followed by
// an INCI-looking list (long, comma-separated, mostly capitalised words), and
// any "key ingredients" block the brand writes itself.
function ingredientsFrom(text) {
  const out = {};
  const key = text.match(/(?:key|star|hero|active|power)\s+ingredients?\s*:?\s*\n?([\s\S]{20,900}?)(?:\n(?:how to use|directions|ingredients|full ingredient|benefits|results|why|what)\b|$)/i);
  if (key) out.keyIngredientsText = key[1].trim();
  const inci = text.match(/(?:full\s+)?ingredients?(?:\s+list)?\s*:?\s*\n?\s*((?:water|aqua|eau|[A-Z][A-Za-z0-9\-\/\(\) ]{2,40})(?:\s*\(?[^,\n]{0,40}\)?)?(?:\s*,\s*[^,\n]{2,70}){6,})/i);
  if (inci) out.inci = inci[1].trim().slice(0, 3000);
  return out;
}

async function fromShopifyProduct(pageUrl) {
  const url = pageUrl.split('?')[0].replace(/\/$/, '');
  const pj = await get(url + '.js', true);
  const desc = htmlToText(pj.description);
  let pageText = '';
  try { pageText = htmlToText(await get(url)); } catch {}
  return { url, theirTitle: pj.title, description: desc, ...ingredientsFrom(desc + '\n' + pageText) };
}

async function fromJsonLd(pageUrl) {
  const html = await get(pageUrl);
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const b of blocks) {
    let j; try { j = JSON.parse(b); } catch { continue; }
    const items = [j, ...(Array.isArray(j) ? j : []), ...(j['@graph'] ?? [])];
    const prod = items.find(x => x && (x['@type'] === 'Product' || (Array.isArray(x['@type']) && x['@type'].includes('Product'))));
    if (prod?.description) {
      const text = htmlToText(html);
      return { url: pageUrl, theirTitle: prod.name, description: htmlToText(prod.description), ...ingredientsFrom(text) };
    }
  }
  const text = htmlToText(html);
  const meta = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']+)/i);
  return { url: pageUrl, theirTitle: null, description: meta ? htmlToText(meta[1]) : '', ...ingredientsFrom(text) };
}

async function harvest(p) {
  const known = knownPage[p.slug];
  if (known) {
    try { return { via: 'known-page', ...(await fromShopifyProduct(known)) }; }
    catch { try { return { via: 'known-page-ld', ...(await fromJsonLd(known)) }; } catch {} }
  }
  const site = sites[brandKey(p.brand)];
  if (!site) return { miss: 'no brand site on file' };
  const origin = new URL(site).origin;
  let j;
  try {
    j = await get(`${origin}/search/suggest.json?q=${encodeURIComponent(p.name)}&resources%5Btype%5D=product&resources%5Blimit%5D=6`, true);
  } catch (e) { return { miss: `store search unavailable (${e.message})`, site: origin }; }
  const cands = (j?.resources?.results?.products ?? [])
    .filter(c => !NOT_THE_PRODUCT.test(c.title) || NOT_THE_PRODUCT.test(p.name))
    .map(c => ({ c, s: score(p.name, c.title, p.brand) }))
    .sort((a, b) => b.s - a.s);
  if (!cands.length) return { miss: 'store search: no products', site: origin };
  // Two titles can both score 1 ("Effortless Self-Adhesive 2-Pack" and
  // "...Lashes" for our "Effortless Self-Adhesive 2-Pack"); the one that is
  // our name exactly wins outright.
  const same = (t) => toks(t).join(' ') === toks(p.name).join(' ');
  const exact = cands.find(x => same(x.c.title));
  if (exact) cands.splice(cands.indexOf(exact), 1), cands.unshift({ ...exact, s: 1.01 });
  const [best, second] = cands;
  if (best.s < 0.75 || (second && second.s >= best.s && second.c.title !== best.c.title))
    return { miss: 'no clear title match', site: origin, candidates: cands.slice(0, 3).map(x => `${x.c.title} (${x.s.toFixed(2)})`) };
  const url = new URL(best.c.url, origin).href;
  try { return { via: 'store-search', score: best.s, ...(await fromShopifyProduct(url)) }; }
  catch (e) { return { miss: `product fetch failed (${e.message})`, site: origin }; }
}

let pool = products.filter(p => p.awardsWon.some(a => /\(2026\)/.test(a)));
const only = arg('--slugs');
if (only) { const s = new Set(only.split(',')); pool = products.filter(p => s.has(p.slug)); }
else pool = pool.filter(p => !raw[p.slug] || (process.argv.includes('--retry-misses') && raw[p.slug].miss));

// Group by brand: one brand's store is asked one product at a time; up to
// eight stores at once.
const byBrand = new Map();
for (const p of pool) { const k = brandKey(p.brand); if (!byBrand.has(k)) byBrand.set(k, []); byBrand.get(k).push(p); }
const queues = [...byBrand.values()];
let done = 0, hit = 0;
const save = () => fs.writeFileSync(OUT, JSON.stringify(raw, null, 1) + '\n');
async function worker() {
  while (queues.length) {
    const q = queues.shift();
    for (const p of q) {
      let r;
      try { r = await harvest(p); } catch (e) { r = { miss: `error ${e.message}` }; }
      raw[p.slug] = { brand: p.brand, name: p.name, harvested: new Date().toISOString().slice(0, 10), ...r };
      done++; if (!r.miss && r.description) hit++;
      if (done % 25 === 0) { save(); console.log(`${done}/${pool.length} · ${hit} with brand copy`); }
      await new Promise(res => setTimeout(res, 400));
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
save();
const misses = {};
for (const p of pool) { const m = raw[p.slug].miss?.replace(/\(.*\)/, '').trim(); if (m) misses[m] = (misses[m] ?? 0) + 1; }
console.log(`\n${done} products · ${hit} with brand copy`, misses);

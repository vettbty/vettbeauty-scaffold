/**
 * Last resort: find a packshot by image search, for products whose retailer is
 * behind a bot wall or whose buy link is only a search page.
 *
 *   node scripts/image-search-fallback.mjs --targets <file.json>
 *   node scripts/image-search-fallback.mjs --targets <file.json> --apply
 *
 * Writes src/lib/image-search-candidates.json for review; --apply is separate,
 * so nothing reaches the site unread.
 *
 * WHY THIS IS LAST. Every other route starts from a link we verified points at
 * this product, so the picture it returns is this product by construction. A
 * search engine gives no such guarantee — it will happily return the same line
 * in a different size, a predecessor formula, or a rival's lookalike. What it
 * does give is reach: Sephora, Olive Young, Saks and Amazon all refuse a plain
 * fetch, and 36 of these products have no link to a product page at all, only a
 * search URL.
 *
 * So the guards do the work instead of the source:
 *
 *   brand in the URL. A result is only considered when the brand's name is in
 *     the image's own host or path. A packshot of a Kérastase oil lives at a
 *     URL that says kerastase somewhere; a lookalike from another brand does
 *     not. This is crude and it throws away good results, which is the right
 *     trade when the failure it prevents is a wrong product on a real page.
 *   no marketplace junk. Marketplace and reseller hosts carry relabelled,
 *     counterfeit and mis-titled listings, so they are refused outright.
 *   the packshot test. Same border rule as the cutout: a product on a plain
 *     backdrop, nothing else.
 *
 * And then every accepted image is still reviewed by eye before it is applied.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const APPLY = process.argv.includes('--apply');
const tIdx = process.argv.indexOf('--targets');
if (tIdx === -1) { console.error('pass --targets <file.json>'); process.exit(1); }
const targets = JSON.parse(fs.readFileSync(process.argv[tIdx + 1], 'utf8'));
const OUT = './src/lib/image-search-candidates.json';
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

// Resellers, marketplaces and image farms: relabelled and mis-titled listings.
const JUNK = /(ebay|aliexpress|alibaba|dhgate|etsy|poshmark|mercari|walmart\.com\/.*seller|pinimg|lookaside|fbcdn|shopee|lazada|wish\.com|joom|temu|redbubble|amazon\.[a-z.]+\/images\/I\/[^/]*_AC_)/i;

const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w.length > 2);

async function bingImages(q) {
  const u = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) return [];
  const html = await r.text();
  const urls = [...html.matchAll(/&quot;murl&quot;:&quot;(https?:[^&]+?)&quot;/g)]
    .map(m => m[1].replace(/\\\//g, '/'));
  return [...new Set(urls)];
}

/** Does the brand's name appear in the image URL itself? */
function brandInUrl(url, brand) {
  const hay = url.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const words = toks(brand).filter(w => !['beauty','cosmetics','paris','london','new','york','the','and','company','skin','skincare','hair','york'].includes(w));
  if (!words.length) return false;
  return words.some(w => hay.includes(w));
}

async function isPackshot(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  let md; try { md = await sharp(buf).metadata(); } catch { return null; }
  if (!md.width || Math.min(md.width, md.height) < 500) return null;
  const ratio = md.width / md.height;
  if (ratio < 0.6 || ratio > 1.7) return null;
  const { data, info } = await sharp(buf).resize(400, 400, { fit: 'inside' })
    .flatten({ background: '#fff' }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const idx = (x, y) => (y * w + x) * ch;
  const cols = [[], [], []];
  const push = (i) => { for (let c = 0; c < 3; c++) cols[c].push(data[i + c]); };
  for (let x = 0; x < w; x++) { push(idx(x, 0)); push(idx(x, h - 1)); }
  for (let y = 0; y < h; y++) { push(idx(0, y)); push(idx(w - 1, y)); }
  const bg = cols.map(a => { a.sort((p, q) => p - q); return a[a.length >> 1]; });
  let tot = 0, near = 0;
  const nb = (i) => Math.abs(data[i] - bg[0]) <= 12 && Math.abs(data[i+1] - bg[1]) <= 12 && Math.abs(data[i+2] - bg[2]) <= 12;
  for (let x = 0; x < w; x++) for (const y of [0, h-1]) { tot++; if (nb(idx(x, y))) near++; }
  for (let y = 0; y < h; y++) for (const x of [0, w-1]) { tot++; if (nb(idx(x, y))) near++; }
  const bgLum = 0.299*bg[0] + 0.587*bg[1] + 0.114*bg[2];
  if (near / tot < 0.92 || bgLum < 200) return null;
  return `${md.width}x${md.height}`;
}

let found = 0, noBrand = 0, noPack = 0, noResults = 0;
for (const t of targets) {
  if (out[t.slug]) continue;
  const q = `${t.brand} ${t.name}`.replace(/\s+/g, ' ').trim();
  try {
    const urls = await bingImages(q);
    if (!urls.length) { noResults++; continue; }
    const usable = urls.filter(u => !JUNK.test(u) && brandInUrl(u, t.brand));
    if (!usable.length) { noBrand++; continue; }
    let picked = null;
    for (const u of usable.slice(0, 8)) {
      const size = await isPackshot(u).catch(() => null);
      if (size) { picked = { url: u, size }; break; }
    }
    if (!picked) { noPack++; continue; }
    out[t.slug] = { url: picked.url, from: 'image-search', query: q, size: picked.size,
                    host: new URL(picked.url).hostname.replace(/^www\./, ''), ourName: q };
    found++;
    console.log(`ok  ${picked.size.padEnd(9)} ${out[t.slug].host.slice(0,24).padEnd(24)} ${q.slice(0,42)}`);
  } catch (e) { noResults++; }
  await new Promise(r => setTimeout(r, 900));   // pace the search engine
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`\nfound ${found} · brand not in any URL ${noBrand} · no packshot ${noPack} · no results ${noResults}`);

if (!APPLY) {
  console.log('review src/lib/image-search-candidates.json, then re-run with --apply');
} else {
  const RES = './src/lib/resolved-new-images.json';
  const resolved = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, 'utf8')) : {};
  const cutouts = JSON.parse(fs.readFileSync('./src/lib/cutouts.json', 'utf8'));
  const levelled = JSON.parse(fs.readFileSync('./src/lib/levelled.json', 'utf8'));
  const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
  const bySlug = new Map(products.map(p => [p.slug, p]));
  let applied = 0;
  for (const [slug, v] of Object.entries(out)) {
    if (v.rejected) continue;
    const p = bySlug.get(slug);
    if (!p) continue;
    resolved[slug] = { url: v.url, from: v.host };
    p.image = v.url;
    p.imageSource = 'image-search';
    p.imageResolvedFrom = v.host;
    delete p.imageOriginal; delete p.imageCutout; delete p.imageLevelled;
    delete cutouts[slug]; delete levelled[slug];
    applied++;
  }
  fs.writeFileSync(RES, JSON.stringify(resolved, null, 1) + '\n');
  fs.writeFileSync('./src/lib/cutouts.json', JSON.stringify(cutouts));
  fs.writeFileSync('./src/lib/levelled.json', JSON.stringify(levelled));
  fs.writeFileSync('./src/lib/products.json', JSON.stringify(products, null, 2) + '\n');
  console.log(`applied ${applied}; now run cutout-images.mjs, whiten-backdrops.mjs, apply-image-pointers.mjs`);
}

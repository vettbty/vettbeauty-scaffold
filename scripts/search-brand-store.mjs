/**
 * Finds a product page — and its packshot — by searching the brand's own store.
 *
 *   node scripts/search-brand-store.mjs --targets <file.json>
 *   node scripts/search-brand-store.mjs --targets <file.json> --apply
 *
 * Writes src/lib/brand-search-candidates.json for review; --apply is a separate
 * step so nothing lands on the site unread.
 *
 * WHY. A large part of the image gap is not a photography problem, it is a link
 * problem: the buy-link waterfall fell back to the brand's homepage, so there is
 * no product page to take a photograph from. But the brand is known and the
 * product name is known, and most of these stores are Shopify — whose
 * predictive-search endpoint answers without the bot protection that blocks the
 * storefront HTML, and answers with the product's own title.
 *
 * That title is the whole safety mechanism. Searching a store for "Cuticle
 * Serum" will always return something; what makes a result usable is that the
 * thing it returns is called what our product is called. Matching is on token
 * overlap against our own name, a clear winner is required over the runner-up,
 * and every accepted pair is written out with both titles so the match can be
 * read back rather than trusted.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const APPLY = process.argv.includes('--apply');
const tIdx = process.argv.indexOf('--targets');
if (tIdx === -1) { console.error('pass --targets <file.json>'); process.exit(1); }
const targets = JSON.parse(fs.readFileSync(process.argv[tIdx + 1], 'utf8'));
const OUT = './src/lib/brand-search-candidates.json';

const STOP = new Set(['the','and','for','with','set','kit','new','size','full','oz','ml','fl','pack','of','in','a','de','x']);
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
  .filter(w => w.length > 2 && !STOP.has(w));

/* A store's own title usually drops the brand ("INSTAFACIAL INFUSION", not
   "Dr. Diamond's Metacine InstaFacial Infusion") and sometimes adds a shade or
   a size. So compare both ways and take the better: our words inside theirs
   catches the added shade, theirs inside ours catches the dropped brand.
   One-directional scoring rejected a pile of correct matches. */
function score(ourName, theirTitle, brand) {
  const brandToks = new Set(toks(brand));
  const a = toks(ourName).filter(w => !brandToks.has(w));
  const b = toks(theirTitle).filter(w => !brandToks.has(w));
  if (!a.length || !b.length) return 0;
  const inB = new Set(b), inA = new Set(a);
  const fwd = a.filter(w => inB.has(w)).length / a.length;
  const rev = b.filter(w => inA.has(w)).length / b.length;
  return Math.max(fwd, rev);
}

/* Words that mean "this is a different thing from the product": a swatch card,
   a refill cartridge, a sample. Scoring alone cannot see these — "Color Purity
   Swatch Book" contains every word of "Color Purity" and scores perfectly. */
const NOT_THE_PRODUCT = /\b(swatch|sample|tester|refill|recambio|replacement|bundle|gift\s*set|travel\s*size|mini|trial|card|book|brochure|voucher|e-?gift)\b/i;

async function isPackshot(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  let md; try { md = await sharp(buf).metadata(); } catch { return false; }
  if (!md.width || Math.min(md.width, md.height) < 400) return false;
  const ratio = md.width / md.height;
  if (ratio < 0.55 || ratio > 1.8) return false;
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
  return near / tot >= 0.90 && bgLum >= 200;
}

const MIN_SCORE = 0.6, MIN_MARGIN = 0.15;
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
let found = 0, weak = 0, none = 0, noshop = 0;

for (const t of targets) {
  if (out[t.slug]) continue;
  let origin; try { origin = new URL(t.buyLink).origin; } catch { continue; }
  if (/amazon|sephora|oliveyoung|linksynergy|shopmy|nordstrom/i.test(origin)) continue;  // not Shopify stores
  const q = encodeURIComponent(t.name);
  try {
    const r = await fetch(`${origin}/search/suggest.json?q=${q}&resources%5Btype%5D=product&resources%5Blimit%5D=6`,
      { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { noshop++; continue; }
    const j = await r.json();
    const prods = j?.resources?.results?.products || [];
    if (!prods.length) { none++; continue; }
    const ranked = prods
      .filter(p => !(NOT_THE_PRODUCT.test(p.title) && !NOT_THE_PRODUCT.test(t.name)))
      .map(p => ({ p, s: score(t.name, p.title, t.brand) }))
      .sort((a, b) => b.s - a.s);
    if (!ranked.length) { weak++; continue; }
    const best = ranked[0], second = ranked[1];
    if (best.s < MIN_SCORE || (second && best.s - second.s < MIN_MARGIN && second.s >= MIN_SCORE)) { weak++; continue; }

    // pull the full image list off the product and take the first real packshot
    const purl = new URL(best.p.url, origin).href.split('?')[0];
    let pick = null;
    try {
      const pr = await fetch(purl + '.js', { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (pr.ok) {
        const pj = await pr.json();
        const prod = pj.product || pj;
        const imgs = [];
        if (prod.featured_image) imgs.push(prod.featured_image);
        for (const im of (prod.images || [])) imgs.push(typeof im === 'string' ? im : im.src);
        const clean = [...new Set(imgs.filter(Boolean).map(u => u.startsWith('//') ? 'https:' + u : u))].slice(0, 8);
        for (const c of clean) if (await isPackshot(c).catch(() => false)) { pick = c; break; }
      }
    } catch { /* fall through */ }
    if (!pick) { none++; continue; }
    out[t.slug] = { url: pick, from: purl, ourName: t.brand + ' ' + t.name, theirTitle: best.p.title, score: +best.s.toFixed(2) };
    found++;
    console.log(`ok  ${best.s.toFixed(2)}  ${t.name.slice(0,34).padEnd(34)} | ${best.p.title.slice(0,34)}`);
  } catch (e) { noshop++; }
  await new Promise(r => setTimeout(r, 400));
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`\nfound ${found} · weak match ${weak} · no packshot ${none} · store did not answer ${noshop}`);

if (!APPLY) {
  console.log('review src/lib/brand-search-candidates.json, then re-run with --apply');
} else {
  /* Applying means promoting reviewed candidates into the same store the
     retailer-page resolver writes to, so one reconciler points everything. */
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
    resolved[slug] = { url: v.url, from: v.from };
    p.image = v.url;
    p.imageSource = 'brand-store';
    p.imageResolvedFrom = v.from;
    delete p.imageOriginal; delete p.imageCutout; delete p.imageLevelled;
    delete cutouts[slug]; delete levelled[slug];   // let both passes have a go
    applied++;
  }
  fs.writeFileSync(RES, JSON.stringify(resolved, null, 1) + '\n');
  fs.writeFileSync('./src/lib/cutouts.json', JSON.stringify(cutouts));
  fs.writeFileSync('./src/lib/levelled.json', JSON.stringify(levelled));
  fs.writeFileSync('./src/lib/products.json', JSON.stringify(products, null, 2) + '\n');
  console.log(`applied ${applied}; now run cutout-images.mjs, whiten-backdrops.mjs, apply-image-pointers.mjs`);
}

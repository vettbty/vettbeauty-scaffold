/**
 * Finds a replacement packshot for products whose image cannot be used.
 *
 *   node scripts/resolve-new-images.mjs --targets <file.json>
 *   node scripts/resolve-new-images.mjs --targets <file.json> --dry
 *
 * Target file: [{ "slug": "...", "buyLink": "..." }, ...]
 * Writes src/lib/resolved-new-images.json: { slug: { url, from, why } }
 *
 * WHY. After keying and backdrop-lifting, what is left is images that are not
 * packshots at all — lifestyle crops, collages, a model's hand — plus products
 * carrying no image. Neither treatment can help those; they need a different
 * photograph. Each of them already has a verified buy link, and the merchant
 * behind that link publishes the packshot we want.
 *
 * TWO GUARDS, because the failure mode here is putting the WRONG image on a
 * product, which is worse than having none:
 *
 *   the link must be a product page. Where the buy-link waterfall fell back to
 *   a brand's homepage, og:image is the brand's own banner — a hero shot, a
 *   storefront photo, a seasonal campaign. Those look like real images and are
 *   not this product. Root-path and search URLs are refused outright.
 *
 *   the image must behave like a packshot. Rather than guess from dimensions,
 *   put the candidate through the same border test the cutout uses: a product
 *   on a plain backdrop passes, a banner or lifestyle crop does not. An image
 *   we could not key or lift is an image we would only have to replace again.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const DRY = process.argv.includes('--dry');
const tIdx = process.argv.indexOf('--targets');
if (tIdx === -1) { console.error('pass --targets <file.json>'); process.exit(1); }
const targets = JSON.parse(fs.readFileSync(process.argv[tIdx + 1], 'utf8'));

const OUT = './src/lib/resolved-new-images.json';
const resolved = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const MIN_SIDE = 400;
const BORDER_TOL = 12, BORDER_FRAC = 0.90;

/** Is this URL a specific product, or did the waterfall land on a homepage? */
function isProductPage(u) {
  let url; try { url = new URL(u); } catch { return false; }
  const path = url.pathname.replace(/\/+$/, '');
  if (!path || path === '') return false;                       // bare homepage
  if (/\/(search|catalogsearch|display\/search|getSearchMain)/i.test(path)) return false;
  if (/[?&]query=/i.test(url.search) && !/\/(product|products|dp|p)\//i.test(path)) return false;
  if (/\/(product|products|dp|gp\/product|p|item|shop)\//i.test(path)) return true;
  return path.split('/').filter(Boolean).length >= 2;           // e.g. /skincare/serum-name
}

function candidatesFrom(html, finalUrl) {
  const cands = [];
  for (const re of [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/ig,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/ig,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/ig,
  ]) for (const m of html.matchAll(re)) cands.push(m[1]);
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.image) { const i = n.image; (Array.isArray(i) ? i : [i]).forEach(v => {
          if (typeof v === 'string') cands.push(v); else if (v && v.url) cands.push(v.url); }); }
        Object.values(n).forEach(walk);
      };
      walk(JSON.parse(m[1].trim()));
    } catch { /* not JSON */ }
  }
  for (const m of html.matchAll(/"(?:hiRes|large)":"(https:[^"]+?)"/g)) cands.push(m[1].replace(/\\u002F/g, '/'));
  const seen = new Set();
  return cands
    .map(u => { try { return new URL(String(u).replace(/&amp;/g, '&'), finalUrl).href; } catch { return null; } })
    .filter(u => u && /^https?:/.test(u))
    .filter(u => !/sprite|logo|placeholder|icon|badge|favicon|og-default|social[-_]?shar|banner|storefront/i.test(u))
    .filter(u => { if (seen.has(u)) return false; seen.add(u); return true; });
}

/** Does this actually look like a packshot: a product on a plain backdrop? */
async function looksLikePackshot(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) return { ok: false, why: 'HTTP ' + res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  let meta; try { meta = await sharp(buf).metadata(); } catch { return { ok: false, why: 'not an image' }; }
  if (!meta.width || !meta.height) return { ok: false, why: 'not an image' };
  if (Math.min(meta.width, meta.height) < MIN_SIDE) return { ok: false, why: `too small ${meta.width}x${meta.height}` };
  const ratio = meta.width / meta.height;
  if (ratio < 0.55 || ratio > 1.8) return { ok: false, why: `banner shape ${meta.width}x${meta.height}` };

  const { data, info } = await sharp(buf).resize(400, 400, { fit: 'inside' })
    .flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const idx = (x, y) => (y * w + x) * ch;
  const cols = [[], [], []];
  const push = (i) => { for (let c = 0; c < 3; c++) cols[c].push(data[i + c]); };
  for (let x = 0; x < w; x++) { push(idx(x, 0)); push(idx(x, h - 1)); }
  for (let y = 0; y < h; y++) { push(idx(0, y)); push(idx(w - 1, y)); }
  const bg = cols.map(a => { a.sort((p, q) => p - q); return a[a.length >> 1]; });
  let border = 0, plain = 0;
  const near = (i) => Math.abs(data[i] - bg[0]) <= BORDER_TOL
                   && Math.abs(data[i+1] - bg[1]) <= BORDER_TOL
                   && Math.abs(data[i+2] - bg[2]) <= BORDER_TOL;
  for (let x = 0; x < w; x++) for (const y of [0, h-1]) { border++; if (near(idx(x, y))) plain++; }
  for (let y = 0; y < h; y++) for (const x of [0, w-1]) { border++; if (near(idx(x, y))) plain++; }
  if (plain / border < BORDER_FRAC) return { ok: false, why: 'backdrop not plain' };
  const bgLum = 0.299*bg[0] + 0.587*bg[1] + 0.114*bg[2];
  if (bgLum < 200) return { ok: false, why: 'backdrop dark' };
  return { ok: true, size: `${meta.width}x${meta.height}` };
}

let found = 0, noPage = 0, noCand = 0, rejected = 0, failed = 0;
const reasons = {};
const note = (r) => { reasons[r] = (reasons[r] || 0) + 1; };

const todo = targets.filter(t => t.buyLink && resolved[t.slug] === undefined);
console.log(`${todo.length} to resolve${DRY ? ' (dry run)' : ''}`);

const CONC = 6;
let done = 0;
async function worker(list) {
  for (const t of list) {
    try {
      const res = await fetch(t.buyLink, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
      const finalUrl = res.url || t.buyLink;
      if (!res.ok) { failed++; note('page ' + res.status); continue; }
      if (!isProductPage(finalUrl)) { noPage++; note('link is not a product page'); continue; }
      const cands = candidatesFrom(await res.text(), finalUrl);
      if (!cands.length) { noCand++; note('no image on page'); continue; }
      let picked = null;
      for (const c of cands.slice(0, 6)) {
        const v = await looksLikePackshot(c).catch(() => ({ ok: false, why: 'error' }));
        if (v.ok) { picked = { url: c, from: finalUrl, size: v.size }; break; }
      }
      if (!picked) { rejected++; note('no candidate looked like a packshot'); continue; }
      if (!DRY) resolved[t.slug] = picked;
      found++; note('resolved');
    } catch (e) { failed++; note('fetch failed'); }
    if (++done % 25 === 0) {
      console.log(`  ${done}/${todo.length} found=${found}`);
      if (!DRY) fs.writeFileSync(OUT, JSON.stringify(resolved, null, 1) + '\n');
    }
  }
}
await Promise.all(Array.from({ length: CONC }, (_, i) => worker(todo.filter((_, j) => j % CONC === i))));
if (!DRY) fs.writeFileSync(OUT, JSON.stringify(resolved, null, 1) + '\n');

console.log(`\nresolved ${found} · no product page ${noPage} · no candidates ${noCand} · rejected ${rejected} · failed ${failed}`);
for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${r}`);

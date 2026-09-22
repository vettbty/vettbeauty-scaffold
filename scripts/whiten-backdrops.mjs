/**
 * For packshots that will not key, lift a plain light backdrop to pure white
 * so the tile can blend it away instead of drawing a box around the product.
 *
 *   node scripts/whiten-backdrops.mjs          # do the ones not yet done
 *   node scripts/whiten-backdrops.mjs --dry    # report only
 *   node scripts/whiten-backdrops.mjs --only slug-a,slug-b
 *
 * WHY. `.product-tile img` multiplies against the tile's near-white blush, so a
 * WHITE backdrop merges into the card and the product appears to float. A grey
 * or faintly tinted one does not: it stays a box. Cutting it out is the better
 * answer when it works, but plenty of shots will not key — a white jar on a
 * light grey sweep has barely ten levels between product and backdrop, and
 * every attempt either eats the jar or leaves a slab (Sascha, 2026-09-21:
 * "fatboy image is looking bad bad", which was exactly that jar).
 *
 * There is a third option that risks nothing. Keying has to decide, per pixel,
 * product or backdrop — and that is the decision it gets wrong. Scaling does
 * not decide anything: multiply every pixel by the gain that takes the backdrop
 * to 255 and the backdrop goes white while the product stays itself, a few per
 * cent brighter. The tile then blends the backdrop away on its own. No pixel is
 * ever removed, so there is nothing to eat and no slab to leave.
 *
 * Per channel, so a warm or cool sweep is neutralised rather than left tinted.
 * Only for backdrops that are already light: the gain is capped, because past
 * about a quarter the product's own highlights start to clip.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DRY = process.argv.includes('--dry');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx === -1 ? [] : (process.argv[onlyIdx + 1] || '').split(',').filter(Boolean);

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'));
const outDir = './public/levelled';
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = './src/lib/levelled.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : {};

const MAX = 1600;
const BORDER_PLAIN_FRAC = 0.95;  // share of the border that must be one colour
const BORDER_TOL = 12;
const BORDER_SPREAD = 24;        // p5..p95 luminance range of a flat sweep
const BG_MIN_LUM = 200;          // only lift backdrops that are already light
const MAX_GAIN = 1.25;           // beyond this the product's highlights clip

async function whiten(slug, url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const src = sharp(Buffer.from(await res.arrayBuffer()))
    .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' });
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const idx = (x, y) => (y * w + x) * ch;

  const cols = [[], [], []], edgeLum = [];
  const sample = (i) => {
    for (let c = 0; c < 3; c++) cols[c].push(data[i + c]);
    edgeLum.push(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]);
  };
  for (let x = 0; x < w; x++) { sample(idx(x, 0)); sample(idx(x, h-1)); }
  for (let y = 0; y < h; y++) { sample(idx(0, y)); sample(idx(w-1, y)); }
  const bg = cols.map(a => { a.sort((p, q) => p - q); return a[a.length >> 1]; });
  const bgLum = 0.299*bg[0] + 0.587*bg[1] + 0.114*bg[2];

  let border = 0, plain = 0;
  for (let i = 0; i < edgeLum.length; i++) border++;
  const nearBg = (i) => Math.abs(data[i] - bg[0]) <= BORDER_TOL
                     && Math.abs(data[i+1] - bg[1]) <= BORDER_TOL
                     && Math.abs(data[i+2] - bg[2]) <= BORDER_TOL;
  for (let x = 0; x < w; x++) for (const y of [0, h-1]) if (nearBg(idx(x, y))) plain++;
  for (let y = 0; y < h; y++) for (const x of [0, w-1]) if (nearBg(idx(x, y))) plain++;
  if (plain / border < BORDER_PLAIN_FRAC) return { skipped: 'border not one colour' };

  edgeLum.sort((a, b) => a - b);
  const spread = edgeLum[Math.floor(edgeLum.length * 0.95)] - edgeLum[Math.floor(edgeLum.length * 0.05)];
  if (spread > BORDER_SPREAD) return { skipped: 'backdrop is a gradient' };
  if (bgLum < BG_MIN_LUM) return { skipped: 'backdrop too dark to lift' };
  if (bgLum >= 250 && Math.max(...bg) - Math.min(...bg) <= 4) return { skipped: 'already white' };

  const gain = bg.map(v => Math.min(MAX_GAIN, 255 / Math.max(1, v)));
  if (Math.max(...gain) >= MAX_GAIN) return { skipped: 'would need too much gain' };

  const out = Buffer.alloc(w * h * 3);
  for (let p = 0; p < w * h; p++) {
    for (let c = 0; c < 3; c++) out[p*3 + c] = Math.min(255, Math.round(data[p*ch + c] * gain[c]));
  }
  const tmp = path.join(outDir, `.${slug}.tmp.webp`);
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 88 }).toFile(tmp);
  fs.renameSync(tmp, path.join(outDir, slug + '.webp'));
  return { ok: true, bg, gain: gain.map(g => +g.toFixed(3)) };
}

/* Only products still showing a remote photo: anything already keyed is better
   off as it is, and anything without an image has nothing to lift. */
const targets = products.filter(p => p.image && !p.image.startsWith('/')
  && (ONLY.length ? ONLY.includes(p.slug) : manifest[p.slug] === undefined));
console.log(`${targets.length} to lift${DRY ? ' (dry run)' : ''}`);

let ok = 0, skip = 0, fail = 0, done = 0;
const reasons = {};
const CONC = 8;
async function worker(list) {
  for (const p of list) {
    try {
      const r = await whiten(p.slug, p.image);
      if (r.ok) { if (!DRY) manifest[p.slug] = true; ok++; }
      else { if (!DRY) manifest[p.slug] = false; skip++; reasons[r.skipped] = (reasons[r.skipped] || 0) + 1; }
    } catch (e) { fail++; reasons['fetch failed'] = (reasons['fetch failed'] || 0) + 1; }
    if (++done % 100 === 0) {
      console.log(`  ${done}/${targets.length} ok=${ok} skip=${skip} fail=${fail}`);
      if (!DRY) fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    }
  }
}
await Promise.all(Array.from({ length: CONC }, (_, i) => worker(targets.filter((_, j) => j % CONC === i))));
if (!DRY) fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`\nlifted ${ok} · left alone ${skip} · failed ${fail}`);
for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${r}`);

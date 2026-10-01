/**
 * Swaps damaged cutouts for their original photo on a white backdrop.
 *
 *   node scripts/replace-bitten-cutouts.mjs slugs.json [--cache dir] [--dry]
 *
 * WHY. Keying a white product on a white backdrop cuts away the white parts
 * along with the backdrop: jar lids, pump heads, the pale side of a bottle. On
 * the blush tile those bites show as pink patches (Sascha, 2026-09-30: "all
 * have splotchy gaps in image"). Every cutout keeps its source photo in
 * products.imageOriginal; the photo has nothing missing, and the tile's
 * multiply blend makes a white backdrop disappear on its own.
 *
 * slugs.json is a list of slugs judged bitten by comparing each cutout with
 * its original (only where the two lined up — a cutout made from a different
 * photo is not swapped, since the original may show another variant).
 *
 * For each slug: take the original, lift a plain light backdrop to white (same
 * per-channel gain as whiten-backdrops.mjs), save to public/levelled, set
 * cutouts.json false and levelled.json true. A backdrop that is not plain and
 * light is left alone and reported: that cutout stays. Run trim-images.mjs and
 * apply-image-pointers.mjs afterwards.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const DRY = process.argv.includes('--dry');
const cacheIdx = process.argv.indexOf('--cache');
const CACHE = cacheIdx === -1 ? null : process.argv[cacheIdx + 1];
const slugs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
const bySlug = new Map(products.map(p => [p.slug, p]));
const CP = './src/lib/cutouts.json', LP = './src/lib/levelled.json';
const cutouts = JSON.parse(fs.readFileSync(CP, 'utf8'));
const levelled = JSON.parse(fs.readFileSync(LP, 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const MAX = 1600, PLAIN = 0.9, TOL = 14, MIN_LUM = 200, MAX_GAIN = 1.25;

async function original(p) {
  if (CACHE && fs.existsSync(`${CACHE}/${p.slug}`)) return fs.readFileSync(`${CACHE}/${p.slug}`);
  const res = await fetch(p.imageOriginal, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

const tally = {};
const bump = (k) => { tally[k] = (tally[k] || 0) + 1; };
const kept = [];

for (const slug of slugs) {
  const p = bySlug.get(slug);
  if (!p?.imageOriginal || p.imageOriginal.startsWith('/')) { bump('no original'); kept.push(slug); continue; }
  let buf;
  try { buf = await original(p); } catch { bump('fetch failed'); kept.push(slug); continue; }

  const { data, info } = await sharp(buf).resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const bg = [0, 1, 2].map(c => { const a = border.map(i => data[i * ch + c]).sort((a, b) => a - b); return a[a.length >> 1]; });
  const plain = border.filter(i => [0, 1, 2].every(c => Math.abs(data[i * ch + c] - bg[c]) <= TOL)).length / border.length;
  const lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
  if (plain < PLAIN) { bump('backdrop not plain'); kept.push(slug); continue; }
  if (lum < MIN_LUM) { bump('backdrop too dark'); kept.push(slug); continue; }
  const gain = bg.map(v => 255 / Math.max(1, v));
  if (Math.max(...gain) > MAX_GAIN) { bump('needs too much gain'); kept.push(slug); continue; }

  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.min(255, Math.round(data[i * ch + c] * gain[c]));
  if (!DRY) {
    await sharp(out, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 88 }).toFile(`./public/levelled/${slug}.webp`);
    cutouts[slug] = false;
    levelled[slug] = true;
  }
  bump('replaced');
}

if (!DRY) {
  fs.writeFileSync(CP, JSON.stringify(cutouts));
  fs.writeFileSync(LP, JSON.stringify(levelled));
}
console.log(DRY ? '(dry run)' : '', tally);
if (kept.length) console.log('kept as cutouts:', kept.join(', '));

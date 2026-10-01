/**
 * Trims product photos to the product, so every tile sizes them the same way.
 *
 *   node scripts/trim-images.mjs            # trim levelled + self-host remote
 *   node scripts/trim-images.mjs --dry      # report only
 *
 * Cutouts are already cropped to their alpha edge, so they fill their tile's
 * padding box exactly. Photos were not: a levelled shot's product filled a
 * median 85% of its frame (as little as 58%), and hotlinked publication photos
 * varied more, so the same tile drew them visibly smaller than the cutout
 * beside them (Sascha, 2026-09-30: "you need to resize all products").
 *
 * - public/levelled/*.webp: cropped in place to the non-white bounding box.
 * - Remote images: fetched, and if all four corners are white (a plain
 *   packshot, not a lifestyle photo) cropped and saved to public/levelled,
 *   with levelled.json[slug] = true so apply-image-pointers picks them up.
 *   whiten-backdrops marks a slug false when its backdrop cannot be lifted;
 *   cropping changes no pixel, so a white-cornered shot is safe to trim anyway.
 *
 * Idempotent: a frame that is already tight is left alone.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const DRY = process.argv.includes('--dry');
const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
const LP = './src/lib/levelled.json';
const levelled = JSON.parse(fs.readFileSync(LP, 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const WHITE = 244;   // a channel above this counts as backdrop
const TIGHT = 0.97;  // already fills 97% of its long side: leave it
const MARGIN = 0.01; // keep 1% so antialiased edges are not shaved

async function contentBox(buf) {
  const { data, info } = await sharp(buf).flatten({ background: '#ffffff' })
    .raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const ink = (x, y) => {
    const k = (y * W + x) * C;
    return data[k] <= WHITE || data[k + 1] <= WHITE || data[k + 2] <= WHITE;
  };
  const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].every(([x, y]) => !ink(x, y));
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  // Stride 2 is plenty for a bounding box and halves the work on 2000px files.
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (ink(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const m = Math.round(Math.max(W, H) * MARGIN);
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(W - 1, x1 + m + 1); y1 = Math.min(H - 1, y1 + m + 1);
  const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  const fill = Math.max(box.width / W, box.height / H);
  return { W, H, box, corners, fill };
}

async function trimTo(buf, file) {
  const c = await contentBox(buf);
  if (!c) return 'blank';
  if (c.fill >= TIGHT) return 'tight';
  if (!DRY) {
    const out = await sharp(buf).flatten({ background: '#ffffff' }).extract(c.box)
      .webp({ quality: 88 }).toBuffer();
    fs.writeFileSync(file, out);
  }
  return `trimmed ${c.fill.toFixed(2)}`;
}

const tally = {};
const bump = (k) => { tally[k] = (tally[k] || 0) + 1; };

// 1. Levelled photos, in place.
for (const p of products) {
  if (!p.image?.startsWith('/levelled/')) continue;
  const f = `./public${p.image}`;
  if (!fs.existsSync(f)) { bump('levelled missing'); continue; }
  const r = await trimTo(fs.readFileSync(f), f);
  bump('levelled ' + r.split(' ')[0]);
}

// 2. Hotlinked photos: self-host the plain-backdrop ones, trimmed.
const remote = products.filter(p => p.image && !p.image.startsWith('/'));
let i = 0;
async function worker() {
  while (i < remote.length) {
    const p = remote[i++];
    try {
      const res = await fetch(p.image, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) { bump(`remote http ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const c = await contentBox(buf);
      if (!c) { bump('remote blank'); continue; }
      if (!c.corners) { bump('remote not plain backdrop'); continue; }
      const f = `./public/levelled/${p.slug}.webp`;
      if (!DRY) {
        const img = c.fill >= TIGHT ? sharp(buf).flatten({ background: '#ffffff' })
                                    : sharp(buf).flatten({ background: '#ffffff' }).extract(c.box);
        fs.writeFileSync(f, await img.webp({ quality: 88 }).toBuffer());
        levelled[p.slug] = true;
      }
      bump('remote self-hosted');
    } catch (e) { bump('remote error'); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

if (!DRY) fs.writeFileSync(LP, JSON.stringify(levelled));
console.log(DRY ? '(dry run)' : '', tally);

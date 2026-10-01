/**
 * Flags cutouts the fill ate a bite out of.
 *
 *   node scripts/check-cutout-bites.mjs            # report
 *   node scripts/check-cutout-bites.mjs --fix      # also drop them back to the photo
 *
 * cutout-images.mjs now refuses to write one of these, but that only protects
 * what it cuts: images cut by an earlier version, or by hand, are not checked
 * by anything. This is the standing sweep — run it after any image work.
 *
 * WHAT IT LOOKS FOR. A clean packshot's transparency is all OUTSIDE the
 * product. Flood the transparent region inwards from the frame edge and
 * anything it cannot reach is enclosed by product: a bite.
 *
 * Measured on a 300px copy, which is the whole trick — at full resolution a
 * bite is almost always still joined to the outside by the one-pixel channel
 * the fill came in through, so nothing reads as enclosed and the check finds
 * nothing. Shrinking closes that channel while leaving real openings open, so
 * a bitten tube is caught while a cushion compact, an LED mask or an open
 * lunch box is not. The 5% floor is where that separation actually sits:
 * below it the hits are overwhelmingly products that are legitimately
 * concave, so a tighter threshold would throw away good cutouts.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const FIX = process.argv.includes('--fix');
const FLOOR = 0.05;

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'));
const live = products.filter(p => p.image && p.image.startsWith('/cutouts/'));

async function enclosedFraction(file) {
  const { data, info } = await sharp(file).resize(300, 300, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info, N = w * h;
  const clear = new Uint8Array(N);
  for (let p = 0; p < N; p++) clear[p] = data[p*ch + 3] < 24 ? 1 : 0;
  const outside = new Uint8Array(N), q = [];
  const seed = (p) => { if (clear[p] && !outside[p]) { outside[p] = 1; q.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h-1)*w + x); }
  for (let y = 0; y < h; y++) { seed(y*w); seed(y*w + w-1); }
  while (q.length) {
    const p = q.pop(), x = p % w, y = (p / w) | 0;
    if (x > 0) seed(p-1); if (x < w-1) seed(p+1);
    if (y > 0) seed(p-w); if (y < h-1) seed(p+w);
  }
  let product = 0, hole = 0;
  for (let p = 0; p < N; p++) { if (!clear[p]) product++; else if (!outside[p]) hole++; }
  return product ? hole / product : 0;
}

const hits = [];
const CONC = 10;
let done = 0;
await Promise.all(Array.from({ length: CONC }, (_, k) => (async () => {
  for (let i = k; i < live.length; i += CONC) {
    const p = live[i];
    try {
      const v = await enclosedFraction('./public' + p.image);
      if (v > FLOOR) hits.push({ slug: p.slug, pct: +(v*100).toFixed(1) });
    } catch { /* unreadable file is the image checker's problem, not this one */ }
    if (++done % 500 === 0) console.error(`  ${done}/${live.length}`);
  }
})()));

hits.sort((a, b) => b.pct - a.pct);
console.log(`${hits.length} of ${live.length} cutouts have a bite over ${FLOOR*100}%`);
for (const h of hits) console.log(`  ${String(h.pct).padStart(5)}%  ${h.slug}`);

if (FIX && hits.length) {
  const manifest = JSON.parse(fs.readFileSync('./src/lib/cutouts.json', 'utf-8'));
  for (const h of hits) {
    manifest[h.slug] = false;
    try { fs.unlinkSync(`./public/cutouts/${h.slug}.webp`); } catch { /* already gone */ }
  }
  fs.writeFileSync('./src/lib/cutouts.json', JSON.stringify(manifest));
  console.log(`\ndropped ${hits.length}; now run apply-image-pointers.mjs, then whiten-backdrops.mjs`);
}
process.exitCode = hits.length ? 1 : 0;

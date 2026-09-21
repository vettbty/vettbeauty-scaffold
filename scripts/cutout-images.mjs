// True background removal for packshots: edge-connected flood fill that takes
// the backdrop AND the photograph's own cast shadow with it.
//
//   node scripts/cutout-images.mjs            # cut anything not yet attempted
//   node scripts/cutout-images.mjs --recut    # redo every slug from source
//   node scripts/cutout-images.mjs --only slug-a,slug-b
//
// WHY THE SHADOW MATTERS. Keying out only the white backdrop looks perfect on
// a white page and wrong everywhere else. The studio shadow under a packshot
// is light grey, so a white-only fill leaves it behind as an opaque blob, and
// the moment the tile behind it stopped being white — the warm gradient the
// cards use — every one of those blobs turned into a pale splotch sitting
// under the product (Sascha, 2026-09-21: "images on website they still look
// splotchy and bad"). The old fixed 242 threshold also sat well inside the
// range a *shaded white product body* occupies, so white tubes and boxes came
// back with bites eaten out of them. Both failures are the same bug: one
// brightness number cannot tell backdrop from product.
//
// Three signals separate them instead, and the fill needs all three:
//
//   brightness  the backdrop and its shadow are light; FLOOR stops the fill
//               before it reaches anything genuinely dark.
//   chroma      a backdrop and a cast shadow are neutral. A pale pink jar or
//               a frosted mint cap is not. This is what keeps coloured-but-
//               light products whole.
//   gradient    a cast shadow is a smooth ramp, so the fill flows down it; a
//               product outline is a step edge, so the fill stops dead at it.
//
// Integrity rule, unchanged: a cutout that ate the product is worse than no
// cutout. Anything that shatters, or that reaches the middle of the frame,
// is abandoned and the plain photo is used instead. Images whose borders are
// not white are skipped entirely, as before.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'));
const outDir = './public/cutouts';
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = './src/lib/cutouts.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : {};

const RECUT = process.argv.includes('--recut');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx === -1 ? [] : (process.argv[onlyIdx + 1] || '').split(',').filter(Boolean);

const MAX = 2000, BORDER_WHITE_FRAC = 0.85;
const FLOOR = 215;   // never key out anything darker than this
const GRAD = 42;     // Sobel magnitude a product outline exceeds and a shadow does not
const CHROMA = 10;   // backdrop and shadow are neutral; products are not
const STRICT = 4;    // conservative fill: the backdrop colour and nothing else

/** Flood from every border pixel through anything `ok` accepts. */
function flood(w, h, ok) {
  const N = w * h;
  const alpha = Buffer.alloc(N, 255);
  const visited = new Uint8Array(N);
  const q = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) q.push(y * w + x);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) q.push(y * w + x);
  while (q.length) {
    const p = q.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    if (!ok(p)) continue;
    alpha[p] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) q.push(p - 1); if (x < w - 1) q.push(p + 1);
    if (y > 0) q.push(p - w); if (y < h - 1) q.push(p + w);
  }
  return alpha;
}

/** Connected opaque regions, largest first. */
function silhouette(alpha, w, h, thr = 8) {
  const N = w * h, opaque = (p) => alpha[p] > thr;
  const seen = new Uint8Array(N);
  const sizes = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (seen[s0] || !opaque(s0)) continue;
    let n = 0; const st = [s0]; seen[s0] = 1;
    while (st.length) {
      const p = st.pop(); n++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && !seen[p-1] && opaque(p-1)) { seen[p-1] = 1; st.push(p-1); }
      if (x < w-1 && !seen[p+1] && opaque(p+1)) { seen[p+1] = 1; st.push(p+1); }
      if (y > 0 && !seen[p-w] && opaque(p-w)) { seen[p-w] = 1; st.push(p-w); }
      if (y < h-1 && !seen[p+w] && opaque(p+w)) { seen[p+w] = 1; st.push(p+w); }
    }
    sizes.push(n);
  }
  sizes.sort((a, b) => b - a);
  return { sizes, kept: sizes.reduce((a, b) => a + b, 0) };
}

async function cutout(slug, url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const img = sharp(buf).resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const N = w * h;
  const idx = (x, y) => (y * w + x) * ch;

  const lum = new Float32Array(N), chroma = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const r = data[p*ch], g = data[p*ch+1], b = data[p*ch+2];
    lum[p] = 0.299*r + 0.587*g + 0.114*b;
    chroma[p] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  const grad = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y*w + x;
    const gx = -lum[p-w-1] - 2*lum[p-1] - lum[p+w-1] + lum[p-w+1] + 2*lum[p+1] + lum[p+w+1];
    const gy = -lum[p-w-1] - 2*lum[p-w] - lum[p-w+1] + lum[p+w-1] + 2*lum[p+w] + lum[p+w+1];
    grad[p] = Math.hypot(gx, gy);
  }

  // border whiteness check — only white-backdrop packshots are cut out
  let border = 0, white = 0;
  const isWhite = (i) => data[i] >= 242 && data[i+1] >= 242 && data[i+2] >= 242;
  for (let x = 0; x < w; x++) for (const y of [0, h-1]) { border++; if (isWhite(idx(x, y))) white++; }
  for (let y = 0; y < h; y++) for (const x of [0, w-1]) { border++; if (isWhite(idx(x, y))) white++; }
  if (white / border < BORDER_WHITE_FRAC) return { skipped: 'border not white' };

  // The backdrop's actual colour, rather than an assumption about it.
  const cols = [[], [], []];
  const push = (i) => { for (let c = 0; c < 3; c++) cols[c].push(data[i + c]); };
  for (let x = 0; x < w; x++) { push(idx(x, 0)); push(idx(x, h-1)); }
  for (let y = 0; y < h; y++) { push(idx(0, y)); push(idx(w-1, y)); }
  const bg = cols.map(a => { a.sort((p, q) => p - q); return a[a.length >> 1]; });

  const cons = flood(w, h, p =>
    Math.abs(data[p*ch] - bg[0]) <= STRICT &&
    Math.abs(data[p*ch+1] - bg[1]) <= STRICT &&
    Math.abs(data[p*ch+2] - bg[2]) <= STRICT);
  const aggr = flood(w, h, p => lum[p] >= FLOOR && chroma[p] <= CHROMA && grad[p] <= GRAD);

  const sCons = silhouette(cons, w, h), sAggr = silhouette(aggr, w, h);
  /* If the shadow-keying fill kept far less than the conservative one, it did
     not merely take the shadow — it broke through a pale, smooth product (a
     frosted jar, a translucent cap) and ate it. Fall back to the conservative
     cut, which is never wrong, only less clean: it keeps the shadow, which is
     the problem we started with, but for a handful of images rather than all
     of them. */
  let alpha = aggr, mode = 'shadow-keyed';
  if (!sCons.kept || sAggr.kept / sCons.kept < 0.62) { alpha = cons; mode = 'conservative'; }

  /* The gradient gate leaves the outline itself un-keyed — being the edge, its
     gradient is high by definition. Fade that rind by how close each pixel
     still is to the backdrop, so the product meets the tile softly instead of
     carrying a hard white hairline. */
  const soft = Buffer.from(alpha);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y*w + x;
    if (alpha[p] !== 255) continue;
    if (!(alpha[p-1] === 0 || alpha[p+1] === 0 || alpha[p-w] === 0 || alpha[p+w] === 0)) continue;
    soft[p] = Math.round(255 * Math.max(0, Math.min(1, (255 - lum[p]) / (255 - FLOOR))));
  }

  // INTEGRITY CHECKS — either symptom means the fill escaped into the product.
  const s = silhouette(soft, w, h);
  if (!s.kept) return { skipped: 'fill removed everything' };
  if (s.sizes.length >= 6 && s.sizes[0] / s.kept < 0.75) return { skipped: `shattered into ${s.sizes.length} fragments` };
  let cTot = 0, cGone = 0;
  for (let y = Math.floor(h*0.4); y < Math.ceil(h*0.6); y++)
    for (let x = Math.floor(w*0.4); x < Math.ceil(w*0.6); x++) { cTot++; if (soft[y*w + x] <= 8) cGone++; }
  if (cTot && cGone / cTot > 0.5) return { skipped: 'fill reached the centre of the frame' };

  const rgba = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) {
    rgba[p*4] = data[p*ch]; rgba[p*4+1] = data[p*ch+1]; rgba[p*4+2] = data[p*ch+2]; rgba[p*4+3] = soft[p];
  }
  /* Written to a temp file and moved into place only once sharp has produced
     the whole thing. A --recut re-runs slugs that already ship a cutout, and a
     half-written webp over a good one would be a worse outcome than the bad
     cutout it replaces. */
  const tmp = path.join(outDir, `.${slug}.tmp.webp`);
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .webp({ quality: 82 })
    .toFile(tmp);
  fs.renameSync(tmp, path.join(outDir, slug + '.webp'));
  return { ok: true, mode };
}

let ok = 0, skip = 0, fail = 0, done = 0;
const modes = {};
/* Source the packshot from imageOriginal when present. `image` is rewritten to
   the local /cutouts/... path once a cutout succeeds, so filtering on it made
   an already-cut product permanently un-recuttable — there was no way to redo
   a bad cutout without hand-editing products.json. Clearing a slug from
   cutouts.json is now enough to have it re-made, and --recut redoes the lot. */
const sourceOf = (p) => (p.imageOriginal && !p.imageOriginal.startsWith('/')) ? p.imageOriginal
                      : (p.image && !p.image.startsWith('/')) ? p.image : null;
const targets = products.filter(p => sourceOf(p)
  && (ONLY.length ? ONLY.includes(p.slug) : (RECUT || manifest[p.slug] === undefined)));
console.log(`targets: ${targets.length}${RECUT ? ' (recut)' : ''}`);

const CONC = 8;
async function worker(list) {
  for (const p of list) {
    try {
      const r = await cutout(p.slug, sourceOf(p));
      if (r.ok) { manifest[p.slug] = true; ok++; modes[r.mode] = (modes[r.mode] || 0) + 1; }
      else { manifest[p.slug] = false; skip++; modes[r.skipped] = (modes[r.skipped] || 0) + 1; }
    } catch (e) {
      /* A source that will not fetch is not evidence the existing cutout is
         bad, so on a --recut we leave whatever is already on disk alone and
         keep its manifest entry rather than demoting a working image. */
      fail++;
      if (manifest[p.slug] === undefined) manifest[p.slug] = false;
    }
    if (++done % 100 === 0) {
      console.log(`${done}/${targets.length} ok=${ok} skip=${skip} fail=${fail}`);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    }
  }
}
const chunks = Array.from({ length: CONC }, (_, i) => targets.filter((_, j) => j % CONC === i));
await Promise.all(chunks.map(worker));
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`\nDONE ok=${ok} skip=${skip} fail=${fail} of ${targets.length}`);
for (const [k, n] of Object.entries(modes).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);

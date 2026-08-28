// True background removal for packshots: edge-connected near-white flood fill.
// Integrity rule: only white CONNECTED TO THE BORDER becomes transparent —
// interior whites (labels, caps, highlights) are untouched. Images whose
// borders are not white are skipped entirely (kept as plain photos).
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'));
const outDir = './public/cutouts';
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = './src/lib/cutouts.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : {};

const MAX = 800, NEAR = 242, BORDER_WHITE_FRAC = 0.85;

async function cutout(slug, url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const img = sharp(buf).resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const isWhite = (i) => data[i] >= NEAR && data[i+1] >= NEAR && data[i+2] >= NEAR;

  // border whiteness check
  let border = 0, white = 0;
  const idx = (x, y) => (y * w + x) * ch;
  for (let x = 0; x < w; x++) { for (const y of [0, h-1]) { border++; if (isWhite(idx(x,y))) white++; } }
  for (let y = 0; y < h; y++) { for (const x of [0, w-1]) { border++; if (isWhite(idx(x,y))) white++; } }
  if (white / border < BORDER_WHITE_FRAC) return { skipped: 'border not white' };

  // BFS flood fill from border white pixels
  const alpha = Buffer.alloc(w * h, 255);
  const visited = new Uint8Array(w * h);
  const q = [];
  for (let x = 0; x < w; x++) for (const y of [0, h-1]) if (isWhite(idx(x,y))) q.push(y*w+x);
  for (let y = 0; y < h; y++) for (const x of [0, w-1]) if (isWhite(idx(x,y))) q.push(y*w+x);
  while (q.length) {
    const p = q.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    if (!isWhite(p * ch)) continue;
    alpha[p] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) q.push(p-1); if (x < w-1) q.push(p+1);
    if (y > 0) q.push(p-w); if (y < h-1) q.push(p+w);
  }
  /* INTEGRITY CHECK — the rule this file claims at the top, now enforced.
     "Only white connected to the border becomes transparent, interior whites
     are untouched" is only true when the product has a hard edge against the
     background. A white tube on a white backdrop does not: its outline is
     anti-aliased, so at NEAR=242 the fill walks straight through the edge and
     eats the product body, leaving the dark text and labels floating on
     nothing. That happened to 44 packshots — Cell Fusion C kept 26% of itself,
     Round Lab shattered into 127 pieces — and they shipped looking like holes
     punched out of the product.
     Two symptoms, both cheap to measure, either of which means the fill
     escaped: the product broke into many disconnected fragments, or the fill
     reached the middle of the frame, where a background has no business being.
     A failed cutout is not worth having: we return `skipped` and the plain
     photo is used, exactly as for a non-white border. */
  {
    const opaque = (p) => alpha[p] !== 0;
    // 1. fragmentation
    const seen = new Uint8Array(w * h);
    const sizes = [];
    for (let s0 = 0; s0 < w * h; s0++) {
      if (seen[s0] || !opaque(s0)) continue;
      let n = 0; const st = [s0]; seen[s0] = 1;
      while (st.length) {
        const p2 = st.pop(); n++;
        const x2 = p2 % w, y2 = (p2 / w) | 0;
        if (x2 > 0 && !seen[p2-1] && opaque(p2-1)) { seen[p2-1] = 1; st.push(p2-1); }
        if (x2 < w-1 && !seen[p2+1] && opaque(p2+1)) { seen[p2+1] = 1; st.push(p2+1); }
        if (y2 > 0 && !seen[p2-w] && opaque(p2-w)) { seen[p2-w] = 1; st.push(p2-w); }
        if (y2 < h-1 && !seen[p2+w] && opaque(p2+w)) { seen[p2+w] = 1; st.push(p2+w); }
      }
      sizes.push(n);
    }
    sizes.sort((a, b) => b - a);
    const kept = sizes.reduce((a, b) => a + b, 0);
    if (!kept) return { skipped: 'fill removed everything' };
    if (sizes.length >= 6 && sizes[0] / kept < 0.75) {
      return { skipped: `shattered into ${sizes.length} fragments` };
    }
    // 2. did the fill reach the middle?
    let cTot = 0, cGone = 0;
    for (let y2 = Math.floor(h * 0.4); y2 < Math.ceil(h * 0.6); y2++)
      for (let x2 = Math.floor(w * 0.4); x2 < Math.ceil(w * 0.6); x2++) {
        cTot++; if (!opaque(y2 * w + x2)) cGone++;
      }
    if (cTot && cGone / cTot > 0.5) {
      return { skipped: 'fill reached the centre of the frame' };
    }
  }

  // soft 1px edge: pixels adjacent to transparency get partial alpha
  const soft = Buffer.from(alpha);
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
    const p = y*w+x;
    if (alpha[p] === 255 && (alpha[p-1]===0||alpha[p+1]===0||alpha[p-w]===0||alpha[p+w]===0)) soft[p] = 140;
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w*h; p++) {
    rgba[p*4] = data[p*ch]; rgba[p*4+1] = data[p*ch+1]; rgba[p*4+2] = data[p*ch+2]; rgba[p*4+3] = soft[p];
  }
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .webp({ quality: 82 })
    .toFile(path.join(outDir, slug + '.webp'));
  return { ok: true };
}

let ok = 0, skip = 0, fail = 0, done = 0;
/* Source the packshot from imageOriginal when present. `image` is rewritten to
   the local /cutouts/... path once a cutout succeeds, so filtering on it made
   an already-cut product permanently un-recuttable — there was no way to redo
   a bad cutout without hand-editing products.json. Clearing a slug from
   cutouts.json is now enough to have it re-made. */
const sourceOf = (p) => (p.imageOriginal && !p.imageOriginal.startsWith('/')) ? p.imageOriginal
                      : (p.image && !p.image.startsWith('/')) ? p.image : null;
const targets = products.filter(p => sourceOf(p) && manifest[p.slug] === undefined);
console.log('targets:', targets.length);
const CONC = 8;
async function worker(list) {
  for (const p of list) {
    try {
      const r = await cutout(p.slug, sourceOf(p));
      if (r.ok) { manifest[p.slug] = true; ok++; }
      else { manifest[p.slug] = false; skip++; }
    } catch (e) { manifest[p.slug] = false; fail++; }
    if (++done % 100 === 0) {
      console.log(`${done}/${targets.length} ok=${ok} skip=${skip} fail=${fail}`);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    }
  }
}
const chunks = Array.from({ length: CONC }, (_, i) => targets.filter((_, j) => j % CONC === i));
await Promise.all(chunks.map(worker));
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`DONE ok=${ok} skip=${skip} fail=${fail} of ${targets.length}`);

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
const targets = products.filter(p => p.image && !p.image.startsWith('/') && manifest[p.slug] === undefined);
console.log('targets:', targets.length);
const CONC = 8;
async function worker(list) {
  for (const p of list) {
    try {
      const r = await cutout(p.slug, p.image);
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

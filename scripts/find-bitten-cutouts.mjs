/**
 * Finds cutouts whose keying cut away part of the product.
 *
 *   node scripts/find-bitten-cutouts.mjs --cache dir [--only-new done.json] > report.json
 *
 * Keying a white product on a white backdrop removes the white parts with the
 * backdrop (lids, pumps, pale sides). The bites open onto the outside, so alpha
 * hole checks miss them. This aligns each cutout with its own imageOriginal
 * (best colour match over scale and offset), fills the product's silhouette
 * from both, and reports the share of that silhouette missing from the cutout.
 *
 * Reading the result (calibrated 2026-09-30 on 2,756 cutouts):
 *   bite >= 0.08 and err <= 40  -> bitten; scripts/replace-bitten-cutouts.mjs
 *   bite >= 0.08 and err  > 40  -> cutout came from a different photo; the
 *                                  score means nothing, view it by eye
 *   bite <  0.08                -> whole
 */
import fs from 'node:fs';
import sharp from 'sharp';

const arg = (k) => { const i = process.argv.indexOf(k); return i === -1 ? null : process.argv[i + 1]; };
const CACHE = arg('--cache') || './.cache/originals';
const DONE = arg('--only-new') ? new Set(JSON.parse(fs.readFileSync(arg('--only-new'), 'utf8'))) : null;
fs.mkdirSync(CACHE, { recursive: true });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const N = 256;

const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'))
  .filter(p => p.imageCutout && p.imageOriginal && !p.imageOriginal.startsWith('/') && !(DONE && DONE.has(p.slug)));

async function original(p) {
  const f = `${CACHE}/${p.slug}`;
  if (fs.existsSync(f)) return f;
  const res = await fetch(p.imageOriginal, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
  if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('HTTP ' + res.status);
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  return f;
}

function dilate(a, W, H, r) {
  let cur = a;
  for (let k = 0; k < r; k++) {
    const n = cur.slice();
    for (let i = 0; i < W * H; i++) {
      if (cur[i]) continue;
      const x = i % W;
      if ((x > 0 && cur[i - 1]) || (x < W - 1 && cur[i + 1]) || (i >= W && cur[i - W]) || (i < W * H - W && cur[i + W])) n[i] = 1;
    }
    cur = n;
  }
  return cur;
}
// Close by r, fill everything not reachable from the frame, open back by r.
function silhouette(m, W, H, r) {
  const d = dilate(m, W, H, r), out = new Uint8Array(W * H), st = [];
  const s = (i) => { if (!d[i] && !out[i]) { out[i] = 1; st.push(i); } };
  for (let x = 0; x < W; x++) { s(x); s((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { s(y * W); s(y * W + W - 1); }
  while (st.length) { const i = st.pop(), x = i % W; if (x > 0) s(i - 1); if (x < W - 1) s(i + 1); if (i >= W) s(i - W); if (i < W * H - W) s(i + W); }
  const grown = dilate(out, W, H, r);
  const f = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = grown[i] ? 0 : 1;
  return f;
}

async function score(p) {
  const o = await sharp(await original(p)).flatten({ background: '#fff' }).resize(N, N, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = o.info.width, H = o.info.height, od = o.data;
  const edge = [[], [], []];
  const push = (i) => { for (let c = 0; c < 3; c++) edge[c].push(od[i * 3 + c]); };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  const bg = edge.map(a => { a.sort((x, y) => x - y); return a[a.length >> 1]; });
  const M = new Uint8Array(W * H);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < W * H; i++) {
    let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(od[i * 3 + c] - bg[c]));
    if (d > 8) { M[i] = 1; const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { slug: p.slug, err: 'blank original' };

  const file = `./public${p.image}`;
  const meta = await sharp(file).metadata();
  const s0 = Math.min((x1 - x0 + 1) / meta.width, (y1 - y0 + 1) / meta.height);
  let best = null;
  for (const sf of [0.9, 0.94, 0.97, 1, 1.03, 1.06, 1.1]) {
    const cw = Math.max(2, Math.round(meta.width * s0 * sf)), ch = Math.max(2, Math.round(meta.height * s0 * sf));
    const c = await sharp(file).resize(cw, ch, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    const samp = [];
    for (let i = 0; i < cw * ch; i += Math.max(1, Math.floor(cw * ch / 500))) if (c[i * 4 + 3] > 250) samp.push(i);
    const cx = Math.round((x0 + x1) / 2 - cw / 2), cy = Math.round((y0 + y1) / 2 - ch / 2);
    for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
      let e = 0;
      for (const i of samp) {
        const X = i % cw + cx + dx, Y = (i - i % cw) / cw + cy + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) { e += 255; continue; }
        const k = (Y * W + X) * 3;
        e += Math.abs(od[k] - c[i * 4]) + Math.abs(od[k + 1] - c[i * 4 + 1]) + Math.abs(od[k + 2] - c[i * 4 + 2]);
      }
      const sc = e / Math.max(1, samp.length);
      if (!best || sc < best.sc) best = { sc, cw, ch, ox: cx + dx, oy: cy + dy, c };
    }
  }
  const A = new Uint8Array(W * H);
  for (let y = 0; y < best.ch; y++) for (let x = 0; x < best.cw; x++) {
    const gx = x + best.ox, gy = y + best.oy;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
    if (best.c[(y * best.cw + x) * 4 + 3] > 128) A[gy * W + gx] = 1;
  }
  const U = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) U[i] = M[i] | A[i];
  const F = silhouette(U, W, H, 3);
  let fa = 0, bit = 0;
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i - x) / W;
    if (x < best.ox || y < best.oy || x >= best.ox + best.cw || y >= best.oy + best.ch) continue;
    if (F[i]) { fa++; if (!A[i]) bit++; }
  }
  return { slug: p.slug, err: +best.sc.toFixed(1), bite: +(bit / Math.max(1, fa)).toFixed(3) };
}

const out = [];
let i = 0;
async function worker() {
  while (i < products.length) {
    const p = products[i++];
    try { out.push(await score(p)); } catch (e) { out.push({ slug: p.slug, err: String(e.message || e).slice(0, 60) }); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
process.stdout.write(JSON.stringify(out));
const bitten = out.filter(r => r.bite >= 0.08 && r.err <= 40).length;
const unsure = out.filter(r => r.bite >= 0.08 && r.err > 40).length;
console.error(`${out.length} cutouts: ${bitten} bitten, ${unsure} need an eye (different source photo), ${out.filter(r => typeof r.bite !== 'number').length} unscored`);

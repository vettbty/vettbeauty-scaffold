#!/usr/bin/env node
/**
 * Grounds packshot cutouts with a soft contact shadow.
 *
 *   node scripts/ground-cutouts.mjs            # ground everything not yet done
 *   node scripts/ground-cutouts.mjs --dry      # report only
 *   node scripts/ground-cutouts.mjs --only slug-a,slug-b
 *
 * WHY. A cutout keyed onto pure transparency has no weight — nothing says
 * where the surface is, so a grid of them reads as renders rather than
 * photographs, however good the original photography was (Sascha, 2026-08-29:
 * "too cgi"). An audit of 40 images found the products themselves are almost
 * all real photographs; barely 5% are CGI. The synthetic feel is the keying,
 * not the source. A contact shadow is the whole fix: the object gains a base
 * and stops floating.
 *
 * ONLY a contact shadow, deliberately. A cast shadow behind the object was
 * tried and rejected: on a dark product it reads as a grey halo rather than a
 * shadow, it implies a light direction the photographs do not share, and it
 * muddies the award seal — which, now that images are sourced from the awarding
 * publication first, most images carry. The seal is the last thing worth
 * degrading.
 *
 * SHAPE GUARD. An ellipse under an object whose base is not flat and roughly
 * horizontal reads as a smudge, not a shadow. Objects that fail the test are
 * left alone; a few ungrounded products among grounded ones is far less
 * noticeable than a shadow stuck on at the wrong angle.
 *
 * The cutout's own pixels and alpha are never modified — the shadow is
 * composited beneath. Re-runnable: src/lib/grounded.json records what has been
 * done so a second run cannot double-darken. To redo one, delete its key.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = './public/cutouts';
const MANIFEST = './src/lib/grounded.json';
const DRY = process.argv.includes('--dry');
/* indexOf returns -1 when the flag is absent, and argv[-1 + 1] is argv[0] —
   the node binary path, which is truthy. Read the flag only when it is there. */
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx === -1 ? [] : (process.argv[onlyIdx + 1] || '').split(',').filter(Boolean);

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')) : {};

/** Is the object's base flat enough to sit on a surface? */
function baseProfile(alpha, w, h) {
  const bottomOf = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++)
    for (let y = h - 1; y >= 0; y--)
      if (alpha[y * w + x] > 40) { bottomOf[x] = y; break; }
  const cols = [];
  for (let x = 0; x < w; x++) if (bottomOf[x] >= 0) cols.push({ x, y: bottomOf[x] });
  if (cols.length < 8) return null;
  const maxY = Math.max(...cols.map(c => c.y));
  // columns whose lowest opaque pixel sits within 3% of the very bottom
  const tol = Math.max(2, Math.round(h * 0.03));
  const onFloor = cols.filter(c => c.y >= maxY - tol);
  const flatness = onFloor.length / cols.length;
  const xs = onFloor.map(c => c.x);
  return {
    flatness,
    baseY: maxY,
    baseLeft: Math.min(...xs),
    baseRight: Math.max(...xs),
    objLeft: Math.min(...cols.map(c => c.x)),
    objRight: Math.max(...cols.map(c => c.x)),
  };
}

async function ground(file) {
  const src = path.join(DIR, file);
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = data[p * ch + 3];

  const prof = baseProfile(alpha, w, h);
  if (!prof) return { skipped: 'no object' };
  // A flat base means a decent share of the silhouette's columns reach the floor.
  if (prof.flatness < 0.16) return { skipped: `base not flat (${(prof.flatness * 100).toFixed(0)}%)` };
  const baseW = prof.baseRight - prof.baseLeft;
  const objW = prof.objRight - prof.objLeft;
  if (baseW < objW * 0.18) return { skipped: 'base too narrow' };

  // Shadow follows the CONTACT width, not the widest point — a bottle with a
  // wide shoulder and a narrow foot should cast from the foot.
  let sw = Math.max(12, Math.round(baseW * 1.12));
  const sh = Math.max(7, Math.round(h * 0.035));
  const blur = Math.max(4, Math.round(sh * 0.62));
  /* Padding is clamped to the frame as well as the ellipse. A tall narrow
     product — a lip pencil, a mascara — has a large sh (derived from height)
     and therefore a large blur, and 2*pad alone could exceed the width of its
     own tightly-trimmed frame. */
  const pad = Math.max(2, Math.min(blur * 3, Math.floor((w - 10) / 2)));
  /* The blurred ellipse is drawn on its own canvas of sw + 2*pad, and sharp
     refuses to composite anything wider than the base image. A wide-footed
     product in a tightly trimmed frame overflows easily — it was 1,250 of
     1,921 files before this clamp. Shrink the ellipse rather than the padding:
     the padding is what stops the blur being cut off at its own edge. */
  sw = Math.min(sw, Math.max(8, w - pad * 2 - 2));
  const ell = Buffer.from(
    `<svg width="${sw + pad * 2}" height="${sh + pad * 2}">` +
    `<ellipse cx="${sw / 2 + pad}" cy="${sh / 2 + pad}" rx="${sw / 2}" ry="${sh / 2}" ` +
    `fill="rgba(58,38,30,0.34)"/></svg>`);
  const shadow = await sharp(ell).blur(blur).png().toBuffer();

  const cx = Math.round((prof.baseLeft + prof.baseRight) / 2);
  const shadowW = sw + pad * 2, shadowH = sh + pad * 2;
  const left = Math.max(0, Math.min(w - shadowW, cx - Math.round(sw / 2) - pad));
  const top = Math.max(0, prof.baseY - Math.round(sh / 2) - pad + Math.round(sh * 0.35));

  // Canvas grows only if the shadow would be clipped at the bottom.
  const overflow = Math.max(0, (top + shadowH) - h);
  const canvasH = h + overflow;

  const out = await sharp({ create: { width: w, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: shadow, left, top },
      { input: await sharp(src).png().toBuffer(), left: 0, top: 0 },
    ])
    .webp({ quality: 86 })
    .toBuffer();
  if (!DRY) fs.writeFileSync(src, out);
  return { ok: true, flatness: prof.flatness };
}

const files = fs.readdirSync(DIR).filter(f => /\.webp$/i.test(f))
  .filter(f => (ONLY.length ? ONLY.includes(f.replace(/\.webp$/, '')) : manifest[f.replace(/\.webp$/, '')] === undefined));
console.log(`${files.length} to ground${DRY ? ' (dry run)' : ''}`);

let ok = 0, skip = 0, fail = 0;
const reasons = {};
for (const f of files) {
  const slug = f.replace(/\.webp$/, '');
  try {
    const r = await ground(f);
    if (r.ok) { ok++; if (!DRY) manifest[slug] = true; }
    else { skip++; reasons[r.skipped] = (reasons[r.skipped] || 0) + 1; if (!DRY) manifest[slug] = false; }
  } catch (e) { fail++; console.log(`  ✖ ${slug}: ${e.message.slice(0, 60)}`); }
  if ((ok + skip + fail) % 300 === 0) console.log(`  ${ok + skip + fail}/${files.length}`);
}
if (!DRY) fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
console.log(`\ngrounded ${ok} · left alone ${skip} · failed ${fail}`);
for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${r}`);

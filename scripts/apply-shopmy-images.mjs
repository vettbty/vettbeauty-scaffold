/**
 * Swaps in ShopMy packshots for products that have no image, or whose image
 * cannot be cut out.
 *
 *   node scripts/apply-shopmy-images.mjs --stage      # point candidates at ShopMy
 *   node scripts/cutout-images.mjs                    # cut the staged ones
 *   node scripts/apply-shopmy-images.mjs --finalize   # keep the wins, undo the rest
 *
 * WHY SHOPMY. A large part of the catalogue renders as a plain photo, which on
 * the warm gradient tile is a white or grey rectangle sitting in the middle of
 * the card — the packshots around it have no box, so the ones that do look
 * broken. Most of those photos come from a publication or retailer page and
 * were never shot for keying: coloured backdrops, lifestyle crops, collage
 * frames. ShopMy carries the merchant's own packshot for the same product, on
 * white, which is what the cutout pipeline wants (Sascha, 2026-09-21:
 * "whatever images you can get from shopmy the better").
 *
 * WHAT IT WILL NOT TOUCH. Anything already carrying a successful cutout, and
 * anything whose current image comes from a publication CDN — those carry the
 * award seal, and the seal is wanted. Eligibility is re-checked here rather
 * than trusted from the candidate file, because other sittings are improving
 * the same images.
 *
 * WHY THREE STEPS. The cutout itself belongs to cutout-images.mjs; staging
 * hands it the ShopMy source and clears the manifest entry so it picks the slug
 * up, and finalize keeps only the ones that actually cut. A ShopMy photo that
 * will not cut out is no better than the rectangle it replaced, so for a
 * product that already had an image, finalize puts the original back.
 *
 * The join is free: each product's buyLink already contains the ShopMy short
 * id, and that same id is in the pin's image filename.
 */
import fs from 'node:fs';

const MODE = process.argv.includes('--finalize') ? 'finalize'
           : process.argv.includes('--stage') ? 'stage' : null;
if (!MODE) { console.error('pass --stage or --finalize'); process.exit(1); }

const P = './src/lib/products.json';
const STAGED = './src/lib/.shopmy-staged.json';
const products = JSON.parse(fs.readFileSync(P, 'utf8'));
const manifest = JSON.parse(fs.readFileSync('./src/lib/cutouts.json', 'utf8'));
const bySlug = new Map(products.map(p => [p.slug, p]));

// Publication CDNs host the award-seal version of a shot. Never replace one.
const PUBLICATION = /allure|vogue|harpersbazaar|elle|marieclaire|glamour|instyle|cosmopolitan|newbeauty|byrdie|refinery|conde|sanity\.io|hearst|futurecdn/i;

if (MODE === 'stage') {
  const candidates = JSON.parse(fs.readFileSync('./src/lib/shopmy-images.json', 'utf8'));
  const staged = {};
  const reasons = {};
  const note = (r) => { reasons[r] = (reasons[r] || 0) + 1; };

  for (const [slug, cand] of Object.entries(candidates)) {
    const p = bySlug.get(slug);
    if (!p) { note('no such product'); continue; }
    if (p.image && p.image.startsWith('/cutouts/')) { note('already a cutout'); continue; }
    let host = '';
    if (p.image) { try { host = new URL(p.image).hostname; } catch { /* not a URL */ } }
    if (PUBLICATION.test(host)) { note('publication image — may carry the seal'); continue; }

    staged[slug] = { was: p.image || null, url: cand.url };
    p.image = cand.url;
    p.imageOriginal = cand.url;
    delete p.imageCutout;
    delete manifest[slug];          // so cutout-images.mjs picks it up
    note('staged');
  }

  fs.writeFileSync(P, JSON.stringify(products, null, 2) + '\n');
  fs.writeFileSync('./src/lib/cutouts.json', JSON.stringify(manifest));
  fs.writeFileSync(STAGED, JSON.stringify(staged, null, 1) + '\n');
  console.log(`staged ${Object.keys(staged).length}`);
  for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${r}`);
  console.log('\nnow run: node scripts/cutout-images.mjs');
}

if (MODE === 'finalize') {
  const staged = JSON.parse(fs.readFileSync(STAGED, 'utf8'));
  let kept = 0, reverted = 0, keptPhoto = 0;
  for (const [slug, s] of Object.entries(staged)) {
    const p = bySlug.get(slug);
    if (!p) continue;
    if (manifest[slug] === true && fs.existsSync(`./public/cutouts/${slug}.webp`)) {
      p.image = `/cutouts/${slug}.webp`;
      p.imageOriginal = s.url;
      p.imageCutout = true;
      p.imageSource = 'shopmy';
      kept++;
    } else if (!s.was) {
      // Had nothing before: a plain ShopMy photo still beats the placeholder.
      p.image = s.url;
      p.imageSource = 'shopmy';
      delete p.imageOriginal;
      keptPhoto++;
    } else {
      p.image = s.was;
      delete p.imageOriginal;
      delete p.imageSource;
      reverted++;
    }
  }
  fs.writeFileSync(P, JSON.stringify(products, null, 2) + '\n');
  fs.unlinkSync(STAGED);
  console.log(`cut out ${kept} · kept as photo (was imageless) ${keptPhoto} · reverted ${reverted}`);
}

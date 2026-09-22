/**
 * Points every product at the best image we hold for it.
 *
 *   node scripts/apply-image-pointers.mjs
 *   node scripts/apply-image-pointers.mjs --dry
 *
 * Run this after anything that rebuilds products.json. convert-csv.js applies
 * cutouts.json on its own, but it knows nothing about the other two stores, so
 * a regenerate silently drops them: 244 lifted backdrops reverted to their raw
 * photos that way, with the files still sitting in public/levelled. This is the
 * one place that reconciles all three, and it is idempotent — running it twice
 * changes nothing.
 *
 * Order of preference, best first:
 *
 *   public/cutouts    a keyed packshot: alpha, no backdrop at all.
 *   public/levelled   the backdrop lifted to white so the tile blends it away.
 *   resolved source   a replacement photo found on the product's own retailer
 *                     page, for products whose original could not be used.
 *   whatever it has   unchanged.
 *
 * imageCutout drives the tile's CSS: cutouts render with a drop shadow and no
 * blending, everything else multiplies against the tile. A levelled image is
 * deliberately NOT a cutout — the blend is the whole point of lifting it.
 */
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');
const P = './src/lib/products.json';
const products = JSON.parse(fs.readFileSync(P, 'utf8'));
const read = (f) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
const cutouts = read('./src/lib/cutouts.json');
const levelled = read('./src/lib/levelled.json');
const resolved = read('./src/lib/resolved-new-images.json');

let keyed = 0, lifted = 0, swapped = 0, untouched = 0;
for (const p of products) {
  // A replacement source comes first: it is the image the other two act on.
  const swap = resolved[p.slug];
  if (swap) {
    // Stamp the provenance whether or not the swap is needed this run: a
    // regenerate drops these fields, and where the image came from is the
    // thing worth keeping.
    p.imageSource = 'retailer-page';
    p.imageResolvedFrom = swap.from;
    if (p.image !== swap.url && !String(p.image || '').startsWith('/')) { p.image = swap.url; swapped++; }
  }
  const remote = (p.imageOriginal && !p.imageOriginal.startsWith('/')) ? p.imageOriginal
               : (swap ? swap.url : null)
               || (p.image && !p.image.startsWith('/') ? p.image : null);

  if (cutouts[p.slug] === true && fs.existsSync(`./public/cutouts/${p.slug}.webp`)) {
    if (remote) p.imageOriginal = remote;
    p.image = `/cutouts/${p.slug}.webp`;
    p.imageCutout = true;
    delete p.imageLevelled;
    keyed++;
  } else if (levelled[p.slug] === true && fs.existsSync(`./public/levelled/${p.slug}.webp`)) {
    if (remote) p.imageOriginal = remote;
    p.image = `/levelled/${p.slug}.webp`;
    p.imageLevelled = true;
    delete p.imageCutout;
    lifted++;
  } else {
    if (p.image && p.image.startsWith('/')) {
      // points at a file we no longer have: fall back to the photo
      const local = `./public${p.image}`;
      if (!fs.existsSync(local) && remote) {
        p.image = remote;
        delete p.imageCutout; delete p.imageLevelled; delete p.imageOriginal;
      }
    }
    untouched++;
  }
}

if (!DRY) fs.writeFileSync(P, JSON.stringify(products, null, 2) + '\n');
console.log(`keyed ${keyed} · lifted ${lifted} · source swapped ${swapped} · left as-is ${untouched}`);

let missing = 0;
for (const p of products) if (p.image && p.image.startsWith('/') && !fs.existsSync(`./public${p.image}`)) missing++;
console.log(missing ? `WARNING: ${missing} products point at a missing file` : 'every local image resolves');

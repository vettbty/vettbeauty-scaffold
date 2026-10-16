const fs = require('fs');
const { execSync } = require('child_process');

const csv = fs.readFileSync('./products.csv', 'utf-8');
const lines = csv.split('\n').filter(l => l.trim());
const headers = lines[0].split(',').map(h => h.replace(/^﻿/, '').trim());

const rows = lines.slice(1).map(line => {
  const obj = {};
  let inQuotes = false;
  let current = '';
  let colIndex = 0;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      obj[headers[colIndex]] = current.trim();
      current = '';
      colIndex++;
    } else {
      current += char;
    }
  }
  obj[headers[colIndex]] = current.trim();
  return obj;
});

const seenSlugs = new Map();
const products = rows.map((row, i) => {
  const awards = (row['Awards won'] || '').split('  |  ').filter(Boolean);
  const brand = row['Brand'] || '';
  const name = row['Product'] || '';

  return {
    id: `prod-${i}`,
    slug: (() => {
      // 6 catalogue rows share a brand+name slug; a repeat would collide as a route.
      let slug = `${brand}-${name}`.toLowerCase().replace(/[^\w-]/g, '-').substring(0, 80);
      const n = seenSlugs.get(slug) || 0;
      seenSlugs.set(slug, n + 1);
      return n > 0 ? `${slug}-${n + 1}` : slug;
    })(),
    brand,
    name,
    price: row['Price'] && row['Price'] !== 'US' ? parseFloat(row['Price']) : null,
    image: '', // filled from db-images.json / resolved-images.json below
    // Never invent an award. `parseInt('0') || 1` used to turn a zero-award row
    // into "1 award", and `awards[0] || 'Award Winner'` gave it a placeholder
    // name — together they rendered as "1 award from 0 publications" on 616
    // live pages. The awards list is the single source of truth for both.
    topAward: awards[0] || '',
    awardCount: awards.length,
    category: row['Category'] || 'Other',
    subcategory: row['Subcategory'] || '',
    year: 2026,
    region: row['Regions'] || 'US',
    hasPhoto: row['Has photo']?.toLowerCase() === 'yes',
    linkType: row['Link type'] || 'exact',
    buyLink: row['Buy link'] || '',
    awardsWon: awards,
  };
});

// Merge real catalogue images pulled from the master DB (brand||name keyed)
const dbImagesPath = './src/lib/db-images.json';
if (fs.existsSync(dbImagesPath)) {
  const dbImages = JSON.parse(fs.readFileSync(dbImagesPath, 'utf-8'));
  for (const product of products) {
    const hit = dbImages[`${product.brand}||${product.name}`];
    if (hit && !product.image) product.image = hit;
  }
}

// Merge any previously resolved images
const resolvedPath = './src/lib/resolved-images.json';
if (fs.existsSync(resolvedPath)) {
  const resolved = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
  for (const product of products) {
    if (resolved[product.slug] && !product.image) {
      product.image = resolved[product.slug].image;
      product.imageResolvedFrom = resolved[product.slug].source;
    }
  }
}

// Swap in locally cut-out packshots (public/cutouts) where the pipeline
// produced one; keep the hotlink as imageOriginal for reference/og use.
if (fs.existsSync('./src/lib/cutouts.json')) {
  const cutouts = JSON.parse(fs.readFileSync('./src/lib/cutouts.json', 'utf-8'));
  for (const product of products) {
    if (cutouts[product.slug] === true && product.image && !product.image.startsWith('/')) {
      product.imageOriginal = product.image;
      product.image = `/cutouts/${product.slug}.webp`;
      product.imageCutout = true;
    }
  }
}

// Apply ruled catalogue corrections (merges + field patches) — see data-overrides.json
if (fs.existsSync('./src/lib/data-overrides.json')) {
  const ov = JSON.parse(fs.readFileSync('./src/lib/data-overrides.json', 'utf-8'));
  for (const drop of ov.drops || []) {
    const i = products.findIndex(p => p.slug === drop.slug);
    if (i !== -1) products.splice(i, 1);
  }
  for (const m of ov.merges || []) {
    const di = products.findIndex(p => p.slug === m.drop);
    const ti = products.findIndex(p => p.slug === m.into);
    if (di !== -1 && ti !== -1) {
      const dup = products[di], keep = products[ti];
      keep.awardsWon = [...keep.awardsWon, ...dup.awardsWon.filter(a => !keep.awardsWon.includes(a))];
      keep.awardCount = keep.awardsWon.length;
      if (!keep.image && dup.image) { keep.image = dup.image; if (dup.imageResolvedFrom) keep.imageResolvedFrom = dup.imageResolvedFrom; }
      products.splice(di, 1);
    }
  }
  for (const [slug, fields] of Object.entries(ov.set || {})) {
    const p = products.find(x => x.slug === slug);
    if (p) for (const [k, v] of Object.entries(fields)) { if (!k.startsWith('_')) p[k] = v; }
  }
}

fs.writeFileSync('./src/lib/products.json', JSON.stringify(products, null, 2));
console.log(`Converted ${products.length} products`);

/* There are three image stores, and the block above re-applies only one of
   them. The other two — the lifted backdrops in levelled.json, and the
   replacement sources in resolved-new-images.json — were being dropped on
   every regenerate, which silently put 246 products back to the raw photo the
   lift exists to fix and erased all of the imageSource provenance with it.
   Nothing was lost when that happened, because the stores themselves are on
   disk; only the pointers into them were. So reconcile all three here rather
   than leaving it to be noticed. The reconciler is idempotent and it is the
   same one run by hand after a cutout or lift pass. */
try {
  execSync('node scripts/apply-image-pointers.mjs', { stdio: 'inherit' });
} catch (e) {
  console.error('\n  ! apply-image-pointers.mjs failed — products.json now points only at cutouts.');
  console.error('    The lifted backdrops and resolved sources are still on disk; re-run it before deploying.');
  process.exitCode = 1;
}

/* Last of all: put the finished catalogue into Supabase site_products, which
   the live site reads (readCatalogue in src/lib/data.ts), so a regenerate
   reaches the site without a separate sync or a deploy. products.json is
   still written above and stays the build-time fallback.

   It runs LAST, and reads products.json back from disk, because
   apply-image-pointers.mjs rewrites that file after it is first written:
   upserting earlier would upload the version without the corrected image
   pointers. If the reconciler failed, nothing is uploaded. */
if (process.exitCode) {
  console.error('\n  ! site_products NOT updated: fix the image pointers and re-run.');
} else {
  import('./lib/site-products.mjs')
    .then(({ upsertSiteProducts }) =>
      upsertSiteProducts(JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'))))
    .catch(e => {
      console.error(`\n  ! site_products NOT updated: ${e.message}`);
      console.error('    products.json is written; re-send it with node scripts/sync-to-site-products.mjs');
      process.exitCode = 1;
    });
}

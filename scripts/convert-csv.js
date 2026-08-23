const fs = require('fs');

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
    topAward: awards[0] || 'Award Winner',
    awardCount: parseInt(row['Total awards']) || 1,
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

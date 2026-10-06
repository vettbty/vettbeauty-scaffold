/**
 * Searches the K-beauty fallback shops (DODOSKIN, Holiholic, YesStyle,
 * StyleKorean) for products with no price, using the shared adapters.
 * Sascha, 2026-10-06: Korean products not on Olive Young US resolve at these
 * four shops; a product found at none of them comes off the site.
 *
 *   node scripts/sweep-kbeauty-shops.mjs <in.json> <out.json>
 *
 * <in.json>: [{ slug, brand, name }]. Writes every candidate with token
 * coverage both ways; adjudication is by hand.
 */
import fs from 'node:fs';
import { ADAPTERS, queriesFor } from '../../scripts/lib/shop-adapters.mjs';

const [inFile, outFile] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const done = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const toks = (s, brand) => { const b = new Set(fold(brand).split(' ')); return fold(s).split(' ').filter(w => w.length > 1 && !b.has(w) && !/^\d+(ml|g|oz)?$/.test(w)); };

for (const r of rows) {
  if (done[r.slug]) continue;
  const ours = toks(r.name.replace(/\[.*?\]/g, ' '), r.brand);
  const cands = [];
  for (const shop of ADAPTERS) {
    for (const q of queriesFor(r.brand, r.name).slice(0, 3)) {
      let res; try { res = await shop.search(q); } catch (e) { res = { error: String(e), candidates: [] }; }
      for (const c of res.candidates || []) {
        const theirs = toks(c.title, r.brand);
        const fwd = ours.length ? ours.filter(w => theirs.includes(w)).length / ours.length : 0;
        const rev = theirs.length ? theirs.filter(w => ours.includes(w)).length / theirs.length : 0;
        if (fwd >= 0.6 && !cands.some(x => x.url === c.url)) cands.push({ shop: c.shop, url: c.url, title: c.title, vendor: c.vendor, price: c.price, available: c.available, fwd: +fwd.toFixed(2), rev: +rev.toFixed(2) });
      }
      if (cands.some(c => c.shop === shop.name && c.fwd >= 0.8)) break;
    }
  }
  done[r.slug] = { brand: r.brand, name: r.name, cands: cands.sort((a, b) => b.fwd + b.rev - a.fwd - a.rev).slice(0, 6) };
  fs.writeFileSync(outFile, JSON.stringify(done, null, 1));
  console.log(`${cands.length ? 'HIT ' : '    '} ${r.brand} | ${r.name}  (${cands.length})`);
}

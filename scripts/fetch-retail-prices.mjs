/**
 * Reads the current price off each buyable product's own buy link, for
 * products with no publication price and no price on file yet.
 *
 *   node scripts/fetch-retail-prices.mjs              # every shop except Amazon
 *   node scripts/fetch-retail-prices.mjs --host spacenk.com
 *
 * Amazon and Olive Young US are skipped: Amazon walls scripted requests after
 * ~40 pages a day and us.oliveyoung.com answers 403 to all of them, so both are
 * read from a browser tab instead (see the 2026-10-01 session).
 *
 * The price must come from the product page the card links to — JSON-LD
 * Product offers, Shopify's product JSON, or the page's price meta tags. Only
 * USD, GBP and EUR are kept; a KRW price would have to be converted, and a
 * converted figure is not a price any shop charges. Results merge into
 * src/lib/retail-prices.json; run sync-retail-prices.mjs afterwards is not
 * needed (it keeps these entries).
 */
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const OUT = './src/lib/retail-prices.json';
const arg = (k) => { const i = process.argv.indexOf(k); return i === -1 ? null : process.argv[i + 1]; };
const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf8'));
const store = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const KEEP = new Set(['USD']); // US dollars only — Sascha, 2026-10-10

const SHOP = {
  'us.oliveyoung.com': 'Olive Young', 'www.spacenk.com': 'Space NK', 'www.harrods.com': 'Harrods',
  'www.lookfantastic.com': 'LOOKFANTASTIC', 'www.cultbeauty.co.uk': 'Cult Beauty', 'www.ulta.com': 'Ulta',
  'www.sephora.co.uk': 'Sephora UK', 'www.sephora.com': 'Sephora', 'www.target.com': 'Target', 'www.boots.com': 'Boots',
  'www.selfridges.com': 'Selfridges', 'www.dermstore.com': 'Dermstore', 'dermstore.com': 'Dermstore', 'www.nordstrom.com': 'Nordstrom',
  'www.iherb.com': 'iHerb', 'www.stylevana.com': 'Stylevana', 'www.libertylondon.com': 'Liberty', 'www.lush.com': 'Lush',
  'www.marksandspencer.com': 'M&S', 'www.wconcept.com': 'W Concept',
};
const shopName = (host, brand) => SHOP[host] ?? null;

async function get(url) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/json', 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(20000) });
  return { ok: r.ok, status: r.status, url: r.url, text: await r.text() };
}

function fromJsonLd(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const stack = [j];
    while (stack.length) {
      const x = stack.pop();
      if (!x || typeof x !== 'object') continue;
      if (Array.isArray(x)) { stack.push(...x); continue; }
      if (x['@graph']) stack.push(x['@graph']);
      const t = [].concat(x['@type'] ?? []);
      if (t.includes('Product') || t.includes('ProductGroup')) {
        const offers = [].concat(x.offers ?? [], ...(x.hasVariant ?? []).map(v => v.offers ?? []));
        for (const o of offers.flatMap(o => [o, ...[].concat(o?.offers ?? [])])) {
          const price = Number(o?.price ?? o?.lowPrice ?? o?.priceSpecification?.price);
          const cur = o?.priceCurrency ?? o?.priceSpecification?.priceCurrency;
          if (price > 0 && cur) return { price, currency: String(cur).toUpperCase(), how: 'json-ld' };
        }
      }
    }
  }
  return null;
}
function fromMeta(html) {
  const amt = html.match(/<meta[^>]+(?:property|name)=["'](?:og|product):price:amount["'][^>]+content=["']([\d.,]+)/i)?.[1];
  const cur = html.match(/<meta[^>]+(?:property|name)=["'](?:og|product):price:currency["'][^>]+content=["']([A-Z]{3})/i)?.[1];
  if (amt && cur) return { price: Number(amt.replace(/,/g, '')), currency: cur, how: 'meta' };
  return null;
}
async function fromShopify(url) {
  const u = new URL(url);
  if (!/\/products\//.test(u.pathname)) return null;
  try {
    const r = await fetch(`${u.origin}${u.pathname.replace(/\/$/, '')}.js`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const j = await r.json();
    const v = (j.variants ?? []).find(v => String(v.id) === u.searchParams.get('variant')) ?? j.variants?.[0];
    const cents = v?.price ?? j.price;
    if (!(cents > 0)) return null;
    // Shopify's .js answers in the store's currency; read it from the page.
    const page = await get(url);
    const cur = page.text.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/)?.[1]
      ?? page.text.match(/"currencyCode":"([A-Z]{3})"/)?.[1] ?? page.text.match(/property="og:price:currency" content="([A-Z]{3})"/)?.[1];
    return cur ? { price: cents / 100, currency: cur, how: 'shopify' } : null;
  } catch { return null; }
}

const host = arg('--host');
const todo = products.filter(p => p.buyLink && !p.price && !store[p.slug]
  && !/amazon\.|amzn\.to|us\.oliveyoung\.com/.test(p.buyLink) && (!host || p.buyLink.includes(host)));
console.log(`${todo.length} products to price`);
const byHost = new Map();
for (const p of todo) { const h = new URL(p.buyLink).hostname; (byHost.get(h) ?? byHost.set(h, []).get(h)).push(p); }
const queues = [...byHost.values()];
const tally = { priced: 0, blocked: 0, noPrice: 0, otherCurrency: 0 };
const notes = [];
async function worker() {
  while (queues.length) {
    for (const p of queues.shift()) {
      try {
        const page = await get(p.buyLink);
        const finalHost = new URL(page.url).hostname;
        if (!page.ok || page.text.length < 5000 || /captcha|access denied|are you a robot|just a moment/i.test(page.text.slice(0, 4000))) {
          tally.blocked++; notes.push(`blocked ${page.status} ${finalHost} ${p.slug}`);
        } else {
          const hit = fromJsonLd(page.text) ?? fromMeta(page.text) ?? await fromShopify(page.url);
          if (!hit) { tally.noPrice++; notes.push(`no price ${finalHost} ${p.slug}`); }
          else if (!KEEP.has(hit.currency)) { tally.otherCurrency++; notes.push(`${hit.currency} ${finalHost} ${p.slug}`); }
          // Sanity: a zero/placeholder price, a won figure tagged as dollars
          // (LaLaChuu "USD 8000"), or a UK/EU site claiming USD are all wrong
          // more often than right — leave them for a person to read.
          else if (!(hit.price > 0) || (hit.currency === 'USD' && hit.price > 1500)
            || (hit.currency === 'USD' && /\.(uk|de|fr|it|es)$|\.co\.uk$/.test(finalHost))) {
            tally.noPrice++; notes.push(`implausible ${hit.currency} ${hit.price} ${finalHost} ${p.slug}`);
          }
          else {
            store[p.slug] = { price: hit.price, currency: hit.currency, at: shopName(finalHost) ?? finalHost.replace(/^www\./, ''), checked: today, url: p.buyLink, via: hit.how };
            tally.priced++;
          }
        }
      } catch (e) { tally.blocked++; notes.push(`error ${e.message} ${p.slug}`); }
      await new Promise(r => setTimeout(r, 1200));
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(store).sort()), null, 1) + '\n');
fs.writeFileSync('../outputs/retail-price-fetch-notes.txt', notes.sort().join('\n') + '\n');
console.log(tally);

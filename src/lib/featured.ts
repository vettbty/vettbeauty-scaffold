/**
 * "Top of the Record" rotation.
 *
 * Eight editorial winners a day, walking the whole pool in a stable scattered
 * order, so no product repeats until every one has been featured. At eight a
 * day the cycle is roughly 315 days.
 *
 * Korean consumer rankings are excluded by construction: they contribute
 * nothing to consensus_count, so `consensus_count >= 1` means "named by at
 * least one US, UK, France or International editorial programme".
 *
 * The order is md5(slug): Supabase's generated `sort_key` column, or the same
 * md5 computed here when Supabase cannot be read. Both paths give the same
 * window for the same day, and nothing in this file may throw — a failure
 * serves the local window, never a broken homepage build.
 */
import { createHash } from "node:crypto";
import { enrichProducts, getProducts, type Product } from "./data";
import { CONSUMER_PLATFORMS, publicationOf } from "./consensus";

export const SLOTS = 8;
const FILTER = "consensus_count=gte.1";

// Wellness awards cover more than beauty: these won real awards and
// stay in the record, but are kept out of the homepage rotation only.
// Clothing, footwear, bags, electronics, appliances, household goods and
// fitness equipment (Sascha, 2026-10-18). Borderline items — the Canopy
// diffuser, the humidifier, the Slip pillowcase, the shower filter, the
// SleepMask and the massager — were kept in.
const EXCLUDED = new Set<string>([
  // clothing and footwear
  "alo-airlift-leggings",
  "quince-power-up-high-rise-training-leggings",
  "dsg-by-dick-s-sporting-goods-momentum-t-back-sports-bra",
  "elastique-le-monde-bra",
  "bombas-all-sport-ankle-socks",
  "hoka-clifton-10-running-shoes",
  "salomon-aero-glide-4-grvl-running-shoes",
  // bags
  "calpak-fit-gym-duffel",
  // electronics
  "apple-watch-series-11",
  "bose-quietcomfort-ultra-earbuds-2nd-gen",
  "loftie-smart-alarm-clock",
  // appliances
  "dyson-purifier-hot-cool-hp2",
  "dyson-v15s-detect-submarine-stick-vacuum",
  "nutribullet-flex-portable-blender",
  "aquatru-under-sink-water-purifier",
  // household goods
  "bentgo-modern-lunch-box",
  "b-box-insulated-flip-top-water-bottle-34-oz-",
  "laundry-sauce-laundry-pods-in-himalayan-cashmere",
  "boll---branch-signature-comforter-set",
  "quince-european-piped-linen-sheet-set",
  // fitness equipment
  "bala-bangles-wearable-weights",
  "stakt-the-stakt-mat",
  "currentbody-leg-recovery-compression-boots",
  "currentbody-wellness-infrared-sauna-blanket",
]);
// Applied to BOTH the count and the window request (and the local fallback),
// so the offset arithmetic stays consistent: if they disagreed the walk would skip.
const NOT_IN = `&slug=not.in.(${[...EXCLUDED].join(",")})`;

/** Day number since the epoch. Identical for everyone for the whole of a day. */
export const dayNumber = (now: number = Date.now()): number =>
  Math.floor(now / 86_400_000);

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

async function poolSize(url: string, headers: Record<string, string>) {
  const res = await fetch(`${url}/rest/v1/site_products?select=slug&${FILTER}${NOT_IN}`, {
    method: "HEAD",
    headers: { ...headers, Prefer: "count=exact" },
    next: { revalidate: 3600, tags: ["catalogue"] },
  });
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

async function slice(
  url: string,
  headers: Record<string, string>,
  offset: number,
  limit: number,
): Promise<Product[]> {
  const res = await fetch(
    `${url}/rest/v1/site_products?select=data&${FILTER}${NOT_IN}` +
      `&order=sort_key&limit=${limit}&offset=${offset}`,
    { headers, next: { revalidate: 3600, tags: ["catalogue"] } },
  );
  if (!res.ok) return [];
  // `data` is the raw products.json row; enrich it so tiles get consensusCount
  // and the retail price exactly as everywhere else on the site.
  return enrichProducts(((await res.json()) as { data: Product }[]).map((row) => row.data));
}

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** The same window computed from the local catalogue, in the same md5 order. */
async function localWindow(day: number, why: string): Promise<{ items: Product[]; total: number }> {
  console.warn(`[featured] ${why} — using the local window`);
  const pool = (await getProducts())
    .filter((p) => p.consensusCount >= 1 && !EXCLUDED.has(p.slug))
    .map((p) => [md5(p.slug), p] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, p]) => p);
  const total = pool.length;
  if (!total) return { items: [], total: 0 };
  const offset = (day * SLOTS) % total;
  const items = pool.slice(offset, offset + SLOTS);
  if (items.length < SLOTS) items.push(...pool.slice(0, SLOTS - items.length));
  return { items, total };
}

/**
 * The window for a given day. Wraps past the end of the pool, so the cycle is
 * continuous and every product is reached exactly once per pass.
 */
export async function getFeatureWindow(
  day: number,
): Promise<{ items: Product[]; total: number }> {
  const db = supabase();
  if (!db) return localWindow(day, 'Supabase env missing');
  try {
    const { url, headers } = db;
    const total = await poolSize(url, headers);
    if (!total) return localWindow(day, 'pool count unavailable');

    const offset = (day * SLOTS) % total;
    const items = await slice(url, headers, offset, SLOTS);

    if (items.length < SLOTS) {
      items.push(...(await slice(url, headers, 0, SLOTS - items.length)));
    }
    return items.length === SLOTS ? { items, total } : localWindow(day, `read ${items.length} of ${SLOTS} items`);
  } catch (err) {
    return localWindow(day, `read threw: ${(err as Error)?.message ?? String(err)}`);
  }
}

/**
 * The label a tile shows on this row: the FIRST editorial award, never
 * topAward, which can be a Korean ranking. Mirrors the existing markup, which
 * shows the programme name only — everything before the em dash.
 */
export function editorialLabel(product: Product): string {
  const first = (product.awardsWon ?? []).find((label) => {
    const pub = publicationOf(label);
    return pub !== null && !(CONSUMER_PLATFORMS as readonly string[]).includes(pub);
  });
  return (first ?? product.topAward ?? "").split(" — ")[0];
}

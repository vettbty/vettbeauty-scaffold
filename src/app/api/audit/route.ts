import { NextResponse } from "next/server";

/* The record audit. Vercel Cron calls it hourly (shallow) and once a day at
   06:00 UTC with ?deep=1 (see vercel.json); each run writes one row to
   audit_runs, which /status reads. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Six route fetches plus, on a deep run, the drift scan and 20 link checks.
export const maxDuration = 60;

type Check = { name: string; ok: boolean; detail: string };

const SITE = process.env.SITE_URL ?? "https://www.vettbeauty.com";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SAMPLE = 20;

async function db(path: string, init?: RequestInit) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res;
}

/** Count rows without pulling them: HEAD + Prefer: count=exact. */
async function countRows(table: string, filter = "") {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=id${filter}`, {
    method: "HEAD",
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
  });
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

async function route(name: string, path: string, expect = 200): Promise<Check> {
  try {
    const res = await fetch(`${SITE}${path}`, { redirect: "follow" });
    return { name, ok: res.status === expect, detail: `${path} → ${res.status}` };
  } catch (err) {
    return { name, ok: false, detail: `${path} threw: ${(err as Error).message}` };
  }
}

/* A retailer answering a server's HEAD with 403, 405 or 429 is a bot wall or a
   method it does not serve, not a dead product page: of 25 links stamped dead
   that way, 24 were live in a browser. So retry once with GET, and count only
   404/410 (gone) and network failures as broken; still-walled links are
   reported, not failed. */
const WALLED = new Set([401, 403, 405, 429, 999]);
async function linkStatus(url: string): Promise<number | "unreachable"> {
  try {
    let r = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (WALLED.has(r.status)) r = await fetch(url, { method: "GET", redirect: "follow" });
    return r.status;
  } catch {
    return "unreachable";
  }
}

export async function GET(req: Request) {
  // Fail closed: without a secret this endpoint would let anyone write audit
  // rows and fire outbound requests. Vercel Cron sends Authorization: Bearer.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  if (!URL_ || !KEY) {
    return NextResponse.json({ error: "Supabase service env missing" }, { status: 500 });
  }

  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const checks: Check[] = [];

  // Routes
  checks.push(await route("home", "/"));
  checks.push(await route("browse", "/browse"));
  checks.push(await route("sale", "/sale"));
  checks.push(await route("about", "/about"));
  checks.push(await route("api/version", "/api/version"));
  checks.push(await route("revalidate rejects GET", "/api/revalidate", 405));

  // Row counts
  const products = await countRows("site_products");
  const awards = await countRows("awards");
  checks.push({
    name: "catalogue row count",
    ok: products > 0,
    detail: `${products} products · ${awards} awards`,
  });

  // A product with no photograph renders the brand tile. Failing, not a
  // warning: with no alert webhook a red line on /status is the signal, and it
  // clears itself once they are replaced. image can be null or "", so both.
  const noImage = await countRows("site_products", "&or=(image.is.null,image.eq.)");
  checks.push({
    name: "products without a photograph",
    ok: noImage === 0,
    detail: noImage === 0 ? "all have one" : `${noImage} without a photograph`,
  });

  // Deep checks, once a day
  if (deep) {
    const drifted: string[] = [];
    const { consensusCount } = await import("@/lib/consensus");
    for (let from = 0; ; from += 1000) {
      const res = await db("site_products?select=slug,consensus_count,awards_won&order=slug", {
        headers: { Range: `${from}-${from + 999}` },
      });
      const page = (await res.json()) as {
        slug: string;
        consensus_count: number | null;
        awards_won: string[] | null;
      }[];
      for (const row of page) {
        const expected = consensusCount(row.awards_won ?? []);
        if (row.consensus_count !== expected) {
          drifted.push(`${row.slug} (${row.consensus_count} vs ${expected})`);
        }
      }
      if (page.length < 1000) break;
    }
    checks.push({
      name: "score drift",
      ok: drifted.length === 0,
      detail: drifted.length ? `${drifted.length} differ: ${drifted.slice(0, 5).join(", ")}` : "all match",
    });

    // A rotating sample of 20, so the whole catalogue is covered over time.
    // Fetched by offset: PostgREST caps a response at 1,000 rows, so reading a
    // range and slicing it would only ever sample the first 1,000 products.
    const linked = await countRows("site_products", "&buy_link=not.is.null");
    const offset = (Math.floor(Date.now() / 86_400_000) * SAMPLE) % Math.max(linked, 1);
    const res = await db(
      `site_products?select=slug,buy_link&buy_link=not.is.null&order=slug&limit=${SAMPLE}&offset=${offset}`,
    );
    const batch = (await res.json()) as { slug: string; buy_link: string }[];
    const broken: string[] = [];
    const walled: string[] = [];
    for (const p of batch) {
      const status = await linkStatus(p.buy_link);
      if (status === "unreachable" || status === 404 || status === 410 || status >= 500) {
        broken.push(`${p.slug} → ${status}`);
      } else if (WALLED.has(status)) {
        walled.push(`${p.slug} → ${status}`);
      }
    }
    checks.push({
      name: `buy links (sample ${batch.length} of ${linked})`,
      ok: broken.length === 0,
      detail: [
        broken.length ? broken.slice(0, 5).join("; ") : "none broken",
        walled.length ? `${walled.length} bot-walled, not counted` : "",
      ].filter(Boolean).join(" · "),
    });
  }

  const failures = checks.filter((c) => !c.ok);
  const summary = failures.length
    ? failures.map((f) => `${f.name}: ${f.detail}`).join("\n")
    : `all ${checks.length} checks passed`;

  await db("audit_runs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      mode: deep ? "deep" : "shallow",
      // /status shows production runs only; a dev run tests localhost.
      source: process.env.VERCEL_ENV === "production" ? "production" : "local",
      failures: failures.length,
      checks,
      summary,
    }),
  });

  const hook = process.env.ALERT_WEBHOOK;
  if (failures.length && hook) {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `VETT audit: ${failures.length} failed\n\n${summary}` }),
    }).catch(() => {});
  }

  return NextResponse.json({ mode: deep ? "deep" : "shallow", failures: failures.length, checks });
}

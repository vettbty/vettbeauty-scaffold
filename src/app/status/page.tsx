// Private. Gated by src/proxy.ts — never rely on obscurity.
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };
// Rendered on every request. With ISR (revalidate = 60) the first visit after
// a quiet spell served the old snapshot, "Last run ... ago" included, and only
// a reload showed fresh data. One gated reader, so per-request cost is nil.
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail: string; daily?: string };
type Run = {
  ran_at: string;
  mode: string;
  failures: number;
  checks: Check[];
  summary: string | null;
};

const PASS = "#6E8B6B";
const WARN = "#C08A3E";
const FAIL = "#A6553F";
const STALE_MS = 3 * 3600_000;

function svc(path: string, init?: RequestInit) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

async function countRows(table: string) {
  const res = await svc(`${table}?select=id`, {
    method: "HEAD",
    headers: { Prefer: "count=exact" } as HeadersInit,
  });
  const total = res.headers.get("content-range")?.split("/")[1];
  // No count means the query failed; say so rather than show 0 products.
  if (!res.ok || total === undefined || total === "*") throw new Error(`${table}: ${res.status}`);
  return Number(total);
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const colour = (failures: number) => (failures === 0 ? PASS : failures <= 2 ? WARN : FAIL);

export default async function StatusPage() {
  let runs: Run[] = [];
  let deepRun: Run | undefined;
  let dbError: string | null = null;
  let products = 0;
  let awards = 0;

  try {
    // Production runs only — a local dev run must never show as a site failure.
    const res = await svc(
      "audit_runs?select=ran_at,mode,failures,checks,summary" +
        "&source=eq.production&order=ran_at.desc&limit=30",
    );
    if (!res.ok) throw new Error(`audit_runs: ${res.status}`);
    runs = (await res.json()) as Run[];
    // Score drift and buy links run only in the 06:00 UTC deep run, so the
    // hourly runs after it do not carry them. Fetch the last deep run too.
    const deepRes = await svc(
      "audit_runs?select=ran_at,mode,failures,checks,summary" +
        "&source=eq.production&mode=eq.deep&order=ran_at.desc&limit=1",
    );
    if (deepRes.ok) deepRun = ((await deepRes.json()) as Run[])[0];
    products = await countRows("site_products");
    awards = await countRows("awards");
  } catch (err) {
    // The page must render even if the database is unreachable, but it must
    // not pass off missing data as "no runs" or "0 products".
    dbError = (err as Error).message;
  }

  const newest = runs[0];
  const stale = !newest || Date.now() - new Date(newest.ran_at).getTime() > STALE_MS;
  // Hourly checks from the newest run, plus the daily-only checks from the last
  // deep run (when the newest run is not itself that deep run).
  const shown = new Set(newest?.checks?.map((c) => c.name) ?? []);
  const checks: Check[] = [
    ...(newest?.checks ?? []),
    ...(deepRun && deepRun.ran_at !== newest?.ran_at
      ? deepRun.checks
          .filter((c) => !shown.has(c.name))
          .map((c) => ({ ...c, daily: ago(deepRun!.ran_at) }))
      : []),
  ];
  const failing = checks.filter((c) => !c.ok);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <span className="eyebrow text-gold">The verified record of beauty</span>
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.02em]">Record status</h1>
        </div>
        <form method="POST" action="/api/logout">
          <button className="text-[11px] uppercase tracking-[0.07em] text-[var(--charcoal-light)]">
            Sign out
          </button>
        </form>
      </div>

      {dbError ? (
        <div className="flex flex-wrap items-baseline gap-3 border-b border-[var(--cream-dark)] pb-5">
          <span
            aria-hidden="true"
            className="inline-block h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: FAIL }}
          />
          <strong className="text-[19px] font-semibold">
            Could not read the database, so nothing below is current
          </strong>
          <span className="text-sm text-[var(--charcoal-light)]">{dbError}</span>
        </div>
      ) : stale ? (
        <div className="flex flex-wrap items-baseline gap-3 border-b border-[var(--cream-dark)] pb-5">
          <span
            aria-hidden="true"
            className="inline-block h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: WARN }}
          />
          <strong className="text-[19px] font-semibold">
            No production run in over 3 hours — the audit may not be running
          </strong>
          {newest ? (
            <span className="text-sm text-[var(--charcoal-light)]">
              Last run {ago(newest.ran_at)}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline gap-3 border-b border-[var(--cream-dark)] pb-5">
          <span
            aria-hidden="true"
            className="inline-block h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: colour(failing.length) }}
          />
          <strong className="text-[19px] font-semibold">
            {failing.length === 0
              ? "All checks passing"
              : `${failing.length} check${failing.length === 1 ? "" : "s"} failing`}
          </strong>
          <span className="text-sm text-[var(--charcoal-light)]">
            Last run {ago(newest!.ran_at)} · checked hourly
          </span>
        </div>
      )}

      {dbError ? null : (
        <div className="flex flex-wrap gap-x-7 gap-y-2 border-b border-[var(--cream-dark)] py-5 text-[13px] text-[var(--charcoal-light)]">
          <span>
            <b className="tabular-nums text-[var(--charcoal)]">{products.toLocaleString()}</b> products
          </span>
          <span>
            <b className="tabular-nums text-[var(--charcoal)]">{awards.toLocaleString()}</b> awards
          </span>
        </div>
      )}

      {newest ? (
        <>
          <h2 className="mb-3 mt-10 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--charcoal-light)]">
            Checks
          </h2>
          <ul className="border-t border-[var(--cream-dark)]">
            {checks.map((c) => (
              <li
                key={c.name}
                className="flex items-baseline gap-4 border-b border-[var(--cream-dark)] py-[11px]"
              >
                <span className="flex-1 text-sm">
                  {c.name}
                  {c.daily ? (
                    <span className="block text-[11px] text-[var(--charcoal-light)]">
                      daily check · ran {c.daily}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right text-[13px] text-[var(--charcoal-light)]">
                  {c.detail}
                </span>
                <span
                  className="w-[74px] shrink-0 text-right text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: c.ok ? PASS : FAIL }}
                >
                  {c.ok ? "Passing" : "Failing"}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="mb-2 mt-10 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--charcoal-light)]">
            Last {runs.length} production runs
          </h2>
          <div className="flex gap-[3px] py-1">
            {[...runs].reverse().map((r) => (
              <i
                key={r.ran_at}
                className="h-[22px] max-w-[16px] flex-1 rounded-[2px] opacity-80"
                style={{ background: colour(r.failures) }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.05em] text-[var(--charcoal-light)]">
            <span>oldest</span>
            <span>now</span>
          </div>

          {failing.length > 0 ? (
            <div className="mt-10 rounded-[6px] border border-[var(--cream-dark)] bg-white p-5">
              <p className="mb-1 text-sm font-semibold">Currently failing</p>
              {failing.map((f) => (
                <p key={f.name} className="text-sm text-[var(--charcoal-light)]">
                  {f.name} — {f.detail}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-8 text-sm text-[var(--charcoal-light)]">
          No production run has been recorded yet.
        </p>
      )}

      <div className="mt-12 rounded-[6px] border border-[var(--cream-dark)] bg-white p-5">
        <p className="text-sm text-[var(--charcoal-light)]">
          <strong className="font-semibold text-[var(--charcoal)]">What this page checks:</strong>{" "}
          that the record is intact, the published data matches the database, the pages serve, and
          the buy links resolve.
        </p>
        <p className="mt-3 text-sm text-[var(--charcoal-light)]">
          <strong className="font-semibold text-[var(--charcoal)]">What it cannot check:</strong>{" "}
          whether an award was read correctly from its source. That is done by hand at import,
          against the publication&rsquo;s own article — and no automated check can replace it.
        </p>
      </div>
    </div>
  );
}

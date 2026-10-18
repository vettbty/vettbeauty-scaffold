import Link from 'next/link';
import Wordmark from '@/components/Wordmark';
import { getProgrammes, getPublications } from '@/lib/record';

/* The record's health, for us, not readers. Private: src/proxy.ts puts it
   behind basic auth, and it is deliberately absent from the footer and the
   sitemap. Reads Supabase with the service-role key, which is server-only
   (no NEXT_PUBLIC_ prefix) and never reaches the browser.

   Nothing here may throw: a missing table, a failed fetch or an empty
   audit_runs renders as "No audit has run yet." */
export const revalidate = 300;
export const metadata = {
  title: 'Record status | Vettbeauty',
  robots: { index: false, follow: false },
};

type Status = 'pass' | 'warn' | 'fail';
interface Check { name: string; detail: string; status: Status }
interface Run { ranAt: string; checks: Check[] }

const COLOUR: Record<Status, string> = { pass: '#6E8B6B', warn: '#C08A3E', fail: '#A6553F' };
const LABEL: Record<Status, string> = { pass: 'PASSING', warn: 'WARNING', fail: 'FAILING' };

function toStatus(v: unknown): Status {
  const s = String(v ?? '').toLowerCase();
  if (/^(pass|passing|ok|green|true)$/.test(s)) return 'pass';
  if (/^(warn|warning|amber)$/.test(s)) return 'warn';
  return 'fail';
}

// `checks` is jsonb: accept an array of {name, detail, status} or an object
// keyed by check name, so the page does not depend on one exact shape.
function toChecks(raw: unknown): Check[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.entries(raw as Record<string, unknown>).map(([name, v]) =>
          v && typeof v === 'object' ? { name, ...(v as object) } : { name, status: v })
      : [];
  return list.map((c: Record<string, unknown>) => ({
    name: String(c.name ?? c.check ?? 'Unnamed check'),
    detail: String(c.detail ?? c.message ?? ''),
    status: toStatus(c.status ?? c.result ?? c.ok),
  }));
}

const runStatus = (r: Run): Status =>
  r.checks.some(c => c.status === 'fail') ? 'fail' : r.checks.some(c => c.status === 'warn') ? 'warn' : 'pass';

async function supabase(path: string, extra: Record<string, string> = {}): Promise<Response | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, ...extra },
      next: { revalidate: 300 },
    });
  } catch {
    return null;
  }
}

async function getRuns(): Promise<Run[]> {
  try {
    const res = await supabase('audit_runs?select=ran_at,checks&order=ran_at.desc&limit=30');
    if (!res?.ok) return [];
    const rows: { ran_at: string; checks: unknown }[] = await res.json();
    return rows.map(r => ({ ranAt: r.ran_at, checks: toChecks(r.checks) }));
  } catch {
    return [];
  }
}

async function getProductCount(): Promise<number | null> {
  try {
    const res = await supabase('site_products?select=slug', { Prefer: 'count=exact', Range: '0-0' });
    const total = res?.ok ? res.headers.get('content-range')?.split('/')[1] : undefined;
    return total && total !== '*' ? Number(total) : null;
  } catch {
    return null;
  }
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return 'at an unknown time';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default async function StatusPage() {
  const [runs, products, programmes, publications] = await Promise.all([
    getRuns(), getProductCount(), getProgrammes(), getPublications(),
  ]);
  const latest = runs[0];
  const failing = latest ? latest.checks.filter(c => c.status === 'fail').length : 0;
  const overall: Status | null = latest ? runStatus(latest) : null;

  return (
    <>
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <nav className="flex items-center gap-5">
            <Link href="/browse" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">Browse</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="eyebrow text-[11px] text-gold mb-5">The verified record of beauty</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-light mb-8">Record status</h1>

        {latest && overall ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-charcoal">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLOUR[overall] }} aria-hidden />
            <span className="font-semibold">
              {failing === 0 ? 'All checks passing' : `${failing} check${failing === 1 ? '' : 's'} failing`}
            </span>
            <span className="text-charcoal-light">Last run {relative(latest.ranAt)} · checked hourly</span>
          </p>
        ) : (
          <p className="text-[15px] text-charcoal-light">No audit has run yet.</p>
        )}

        <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-b border-cream-dark py-3 text-sm tabular">
          <div className="flex items-baseline gap-2"><dt className="text-charcoal-light">Products</dt><dd className="font-semibold text-charcoal">{products === null ? '—' : products.toLocaleString()}</dd></div>
          <div className="flex items-baseline gap-2"><dt className="text-charcoal-light">Programmes</dt><dd className="font-semibold text-charcoal">{programmes.length.toLocaleString()}</dd></div>
          <div className="flex items-baseline gap-2"><dt className="text-charcoal-light">Publications</dt><dd className="font-semibold text-charcoal">{publications.length.toLocaleString()}</dd></div>
        </dl>

        {latest && (
          <section className="mt-10">
            <h2 className="eyebrow text-xs text-charcoal-light mb-3">Checks</h2>
            <ul className="divide-y divide-cream-dark border-t border-b border-cream-dark">
              {latest.checks.map(c => (
                <li key={c.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-baseline gap-4 py-2.5 text-sm">
                  <span className="font-semibold text-charcoal">{c.name}</span>
                  <span className="text-charcoal-light">{c.detail}</span>
                  <span className="text-[11px] font-semibold microcap" style={{ color: COLOUR[c.status] }}>{LABEL[c.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {runs.length > 0 && (
          <section className="mt-10">
            <h2 className="eyebrow text-xs text-charcoal-light mb-3">Last {runs.length} runs</h2>
            <div className="flex items-end gap-1 border-t border-b border-cream-dark py-3" aria-label="Oldest to newest">
              {[...runs].reverse().map(r => {
                const s = runStatus(r);
                return <span key={r.ranAt} title={`${r.ranAt} · ${LABEL[s]}`} className="inline-block w-2 h-5 rounded-sm" style={{ background: COLOUR[s] }} />;
              })}
            </div>
          </section>
        )}

        <div className="mt-10 rounded-[6px] border border-cream-dark p-5 text-sm leading-relaxed text-charcoal-light">
          <p>
            <span className="font-semibold text-charcoal">What this page checks:</span> that the record is intact, the published data
            matches the database, the pages serve, and the buy links resolve.
          </p>
          <p className="mt-3">
            <span className="font-semibold text-charcoal">What it cannot check:</span> whether an award was read correctly from its
            source. That is done by hand at import, against the publication&rsquo;s own
            article — and no automated check can replace it.
          </p>
        </div>
      </main>
    </>
  );
}

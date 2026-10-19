import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/status", error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto px-4 py-24">
      <span className="eyebrow text-gold">The verified record of beauty</span>
      <h1 className="text-[32px] leading-[1.1] tracking-[-0.02em] mb-8">Status</h1>

      <form method="POST" action="/api/login" className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.07em] text-[var(--charcoal-light)]">
            Password
          </span>
          <input
            type="password"
            name="password"
            autoFocus
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-[6px] border border-[var(--cream-dark)] bg-white px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none"
          />
        </label>

        {error ? (
          <p className="text-sm" style={{ color: "#A6553F" }}>
            That password is not right.
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-[6px] bg-[var(--charcoal)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

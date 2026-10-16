"use client";

import { useState } from "react";

/**
 * Email signup for award-season alerts, winner lists and deal drops.
 *
 * Ported from the dev repo when the endpoint came back (see api/subscribe.js).
 * The label uses .eyebrow rather than the original tracking-[0.25em]: that
 * width is the setting Sascha rejected site-wide on 2026-09-24.
 */
export default function EmailCapture() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "site" }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="bg-cream-dark/40 border-t border-cream-dark py-10 px-4">
      <div className="max-w-md mx-auto text-center">
        <p className="eyebrow text-[10px] text-gold mb-3">Award season alerts</p>
        {state === "done" ? (
          <p className="text-sm text-charcoal py-3">
            You&rsquo;re on the list.
          </p>
        ) : (
          <>
            <p className="text-sm text-charcoal-light mb-5">
              Winner lists the day they&rsquo;re announced, and a note when an
              award winner goes on sale.
            </p>
            <form onSubmit={submit} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                className="flex-1 min-w-0 rounded-md bg-white border border-warm-beige px-4 py-3 text-sm text-charcoal placeholder:text-warm-beige focus:outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={state === "busy"}
                className="rounded-md bg-charcoal text-white text-sm font-semibold px-6 py-3 hover:bg-charcoal-light transition-colors disabled:opacity-60"
              >
                {state === "busy" ? "…" : "Join"}
              </button>
            </form>
            {state === "error" && (
              <p className="mt-3 text-xs text-gold">
                Something went wrong — try again.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

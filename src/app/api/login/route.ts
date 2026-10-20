import { NextResponse } from "next/server";
import { createSession, COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  // Trim both sides: a value pasted into Vercel often carries a trailing
  // newline or space, which would otherwise make the right password fail.
  const password = String(form.get("password") ?? "").trim();
  const rawNext = String(form.get("next") ?? "/status");

  // Only ever redirect within this site — never an absolute URL.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/status";

  // Also drop one pair of wrapping quotes: Vercel stores "abc" literally.
  const expected = process.env.STATUS_PASS?.trim().replace(/^(["'])(.*)\1$/, "$2");
  const secret = process.env.STATUS_SECRET;
  if (!expected || !secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  if (password !== expected) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), { status: 303 });
  }

  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(COOKIE, await createSession(secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86_400,
  });
  return res;
}

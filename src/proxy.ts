import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/session";

/* Cookie login for /status, the private record-health page. Unauthenticated
   requests go to /login; a valid signed cookie (src/lib/session.ts) passes.

   Next 16 renamed middleware to proxy, and with an src/app layout the file has
   to sit in src/ beside app/: a middleware.ts at the repository root is
   ignored, which would serve /status with no password at all. */
export const config = { matcher: ["/status"] };

export async function proxy(req: NextRequest) {
  const secret = process.env.STATUS_SECRET;

  // Fail closed: unconfigured means nobody gets in, not everybody.
  if (!secret) return new NextResponse("Not configured", { status: 503 });

  const ok = await verifySession(req.cookies.get(COOKIE)?.value, secret);
  if (ok) return NextResponse.next();

  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

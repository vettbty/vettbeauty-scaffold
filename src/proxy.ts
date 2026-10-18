import { NextResponse, type NextRequest } from 'next/server';

/* Basic auth for /status, the private record-health page.

   Next 16 renamed middleware to proxy, and with an src/app layout the file has
   to sit in src/ beside app/: a middleware.ts at the repository root is
   ignored, which would serve /status with no password at all. */
export const config = { matcher: ['/status'] };

export function proxy(req: NextRequest) {
  const user = process.env.STATUS_USER;
  const pass = process.env.STATUS_PASS;
  // Fail closed: an unconfigured page must not be served.
  if (!user || !pass) {
    return new NextResponse('Not configured', { status: 503 });
  }
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    let decoded = '';
    try {
      decoded = atob(header.slice(6));
    } catch {
      // Malformed base64 is just a wrong password: fall through to 401.
    }
    const i = decoded.indexOf(':');
    if (i > 0 && decoded.slice(0, i) === user && decoded.slice(i + 1) === pass) {
      return NextResponse.next();
    }
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="VETT status", charset="UTF-8"' },
  });
}

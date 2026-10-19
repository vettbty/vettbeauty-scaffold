import { revalidateTag } from 'next/cache';

/* Called by scripts/lib/site-products.mjs after it writes site_products, so a
   regenerate reaches the live site at once instead of at the next revalidate.

   The tag alone is enough: every page reads the catalogue through the tagged
   fetch in data.ts (there is no in-memory copy), so dropping the tag marks
   exactly the pages that use it. Each then regenerates on its next request
   within its own window (1h, product pages 1d), not all at once. */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get('x-revalidate-secret') !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag('catalogue', 'max');
  return Response.json({ ok: true });
}

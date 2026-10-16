import { revalidatePath, revalidateTag } from 'next/cache';

/* Called by scripts/lib/site-products.mjs after it writes site_products, so a
   regenerate reaches the live site at once instead of at the next revalidate.

   Both calls are needed. The tag drops the cached Supabase fetch. But the
   catalogue is also held in memory for 5 minutes (getProducts in data.ts),
   so most prerendered pages were built without making the tagged fetch
   themselves and carry no tag; revalidatePath('/', 'layout') marks every
   page under the root for regeneration. */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get('x-revalidate-secret') !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag('catalogue', 'max');
  revalidatePath('/', 'layout');
  return Response.json({ ok: true });
}

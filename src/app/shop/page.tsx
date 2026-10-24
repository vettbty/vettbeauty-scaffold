import Link from 'next/link';
import Image from 'next/image';
import Wordmark from '@/components/Wordmark';
import AffiliateNote from '@/components/AffiliateNote';
import { getShoppable, type Product } from '@/lib/data';
import { getFeatureWindow, dayNumber, editorialLabel } from '@/lib/featured';
import { priceLabel } from '@/lib/format';
import igPosts from '@/lib/ig-posts.json';

/* vettbeauty.com/shop: the Instagram link-in-bio page. Instagram captions
   cannot carry clickable links, so the bio links here and every product has
   one tap to its ShopMy (or Amazon) buy link.

   Posts come from src/lib/ig-posts.json, newest first:
     { "posts": [ { "date": "2026-10-24", "title": "Best of Beauty serums",
                    "slugs": ["slug-one", "slug-two"] } ] }
   Slugs are product page slugs (vettbeauty.com/product/<slug>). A slug with
   no product or no buy link is skipped. With no posts listed, the page shows
   the homepage's eight featured winners of the day instead.

   Buy buttons carry data-buy="ig" so BuyClickTracker counts them apart from
   the rest of the site. */
export const revalidate = 3600;

export const metadata = {
  title: 'Shop the Post | Vettbeauty',
  description: 'Shop the award winners from @vettedbty posts.',
};

type Post = { date: string; title: string; slugs: string[] };
const MAX_POSTS = 30;

function ShopCard({ product }: { product: Product }) {
  const price = priceLabel(product);
  return (
    <div className="bg-white flex gap-3 p-3 items-center">
      <Link href={`/product/${product.slug}`} className="shrink-0">
        <div className="product-tile relative w-20 h-20 overflow-hidden rounded">
          {product.image ? (
            <Image
              src={product.image}
              alt={`${product.brand} ${product.name}`}
              className={`w-full h-full ${product.imageCutout ? 'cutout' : ''}`}
              fill
              sizes="80px"
              unoptimized={!product.image.startsWith('/')}
            />
          ) : (
            <span className="tile-fallback text-[10px]" aria-hidden="true">{product.brand}</span>
          )}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase microcap text-gold">{product.brand}</p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-sm font-semibold text-charcoal leading-snug line-clamp-2">{product.name}</h3>
        </Link>
        <p className="text-[11px] text-charcoal-light mt-0.5 line-clamp-1">
          {price ? <span className="font-bold text-charcoal">{price}</span> : null}
          {price ? ' · ' : ''}{editorialLabel(product)}
        </p>
      </div>
      <a
        href={product.buyLink}
        target="_blank"
        rel="sponsored noopener noreferrer"
        data-buy="ig"
        className="shrink-0 bg-charcoal text-white text-center py-2.5 px-3 rounded-md font-semibold text-xs hover:bg-charcoal-light transition-colors"
      >
        Shop →
      </a>
    </div>
  );
}

export default async function ShopPage() {
  const shoppable = await getShoppable();
  const bySlug = new Map(shoppable.map(p => [p.slug, p]));

  const posts = ((igPosts.posts ?? []) as Post[])
    .slice(0, MAX_POSTS)
    .map(post => ({ ...post, items: post.slugs.map(s => bySlug.get(s)).filter((p): p is Product => !!p) }))
    .filter(post => post.items.length);

  const fallback = posts.length
    ? []
    : (await getFeatureWindow(dayNumber())).items.filter(p => p.buyLink);

  return (
    <>
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <a href="https://www.instagram.com/vettedbty/" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-charcoal-light hover:text-charcoal">
            @vettedbty
          </a>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <h1 className="font-serif text-3xl font-bold text-charcoal mb-1">Shop the post</h1>
        <p className="text-sm text-charcoal-light mb-6">
          Every product here won a named award from a major beauty publication. Tap Shop to buy.
        </p>

        {posts.map(post => (
          <section key={`${post.date}-${post.title}`} className="mb-8">
            <p className="eyebrow text-xs text-gold mb-1">
              {new Date(post.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <h2 className="font-serif text-lg font-semibold text-charcoal mb-3">{post.title}</h2>
            <div className="flex flex-col gap-px bg-cream-dark rounded-md overflow-hidden">
              {post.items.map(p => <ShopCard key={p.slug} product={p} />)}
            </div>
          </section>
        ))}

        {fallback.length > 0 && (
          <section className="mb-8">
            <p className="eyebrow text-xs text-gold mb-1">Today</p>
            <h2 className="font-serif text-lg font-semibold text-charcoal mb-3">Top of the record</h2>
            <div className="flex flex-col gap-px bg-cream-dark rounded-md overflow-hidden">
              {fallback.map(p => <ShopCard key={p.slug} product={p} />)}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link href="/sale" className="bg-gold text-white text-center py-3 rounded-md font-semibold text-sm hover:bg-gold-dark">On sale now</Link>
          <Link href="/browse" className="bg-white text-charcoal text-center py-3 rounded-md font-semibold text-sm border border-cream-dark hover:border-charcoal">All winners</Link>
        </div>
      </main>

      <footer className="bg-white border-t border-cream-dark py-6 px-4 text-center">
        <p className="text-xs text-charcoal-light">© 2026 Vettbeauty · <Link href="/about" className="hover:text-charcoal">Only the Vetted</Link></p>
        <AffiliateNote className="mt-2 max-w-2xl mx-auto" />
      </footer>
    </>
  );
}

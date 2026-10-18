import Link from 'next/link';
import EmailCapture from "@/components/EmailCapture";
import Wordmark from '@/components/Wordmark';
import SaveCount from '@/components/SaveCount';
import Image from 'next/image';
import { getShoppable, pressArticles } from '@/lib/data';
import { getProgrammes, getPublications, getKoreanRankings, getCategories } from '@/lib/record';

/* The front page is an index into the record, not a catalogue: one row of the
   most widely recognised winners, then every way in — by publication, by
   category, by Korean ranking — as plain link rows. Every link uses slugs from
   src/lib/record.ts, the same ones Browse reads. Sascha, 2026-10-15: the old
   page stacked a full product grid per award class and read as "terrible". */
export const revalidate = 3600;

export default async function Home() {
  const [shoppable, programmes, publications, koreanRankings, categories] = await Promise.all([
    getShoppable(), getProgrammes(), getPublications(), getKoreanRankings(), getCategories(),
  ]);

  // Most widely recognised first: distinct editorial publications. Equal
  // scores rotate daily: a day-seeded hash breaks ties, so the order is the
  // same for everyone within a UTC day and different the next, and never
  // crosses a score boundary. Keyed by slug, which is stable; id is positional.
  const seed = Math.floor(Date.now() / 86_400_000);

  // murmur3 fmix32: two multiply rounds, so a one-bit change anywhere in the
  // input changes about half the output bits. The raw seed cannot be used
  // directly: consecutive day seeds differ only in low bits, and x ^ seed
  // then a single multiply round shifts every hash by the same amount — the
  // constant-offset flaw — so the order barely moves.
  const fmix = (x: number) => {
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return x >>> 0;
  };

  const h = (key: string) => {
    let x = 2166136261 >>> 0;              // FNV-1a offset basis
    for (let i = 0; i < key.length; i++) {
      x ^= key.charCodeAt(i);
      x = Math.imul(x, 16777619) >>> 0;    // FNV prime
    }
    return fmix(x ^ fmix(seed));
  };

  const top = [...shoppable]
    .sort((a, b) => b.consensusCount - a.consensusCount || h(a.slug) - h(b.slug))
    .slice(0, 8);

  // The newest programme by announcement date; the first entry if none is dated.
  const dated = programmes.filter(p => p.announcedDate && !Number.isNaN(Date.parse(p.announcedDate)));
  const newest = dated.length
    ? dated.reduce((a, b) => (Date.parse(b.announcedDate!) > Date.parse(a.announcedDate!) ? b : a))
    : programmes[0];

  const pubHref = (slugs: string[]) => `/browse?pub=${slugs.join(',')}`;

  const row = 'flex items-baseline justify-between gap-4 py-2.5 text-sm text-charcoal hover:text-gold transition-colors';
  const label = 'eyebrow text-xs text-gold mb-3';

  return (
    <>
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <nav className="flex items-center gap-5">
            <Link href="/browse" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">Browse</Link>
            <Link href="/sale" className="text-sm font-medium text-gold hover:text-gold-dark transition-colors">Sale</Link>
            <Link href="/about" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">About</Link>
            <SaveCount />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4">
        {/* 1. Hero */}
        <section className="text-center pt-[48px] max-w-3xl mx-auto">
          <p className="eyebrow text-xs text-gold mb-4">The verified record of beauty</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold text-charcoal mb-4 leading-tight">Only the Vetted</h1>
          <p className="text-[15px] leading-[1.55] text-charcoal-light mb-7">
            Every product here won a named award from a major beauty publication.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 bg-charcoal text-white px-7 py-3 rounded-md font-semibold text-sm hover:bg-charcoal-light transition-colors"
          >
            Browse {shoppable.length.toLocaleString()} winners →
          </Link>
        </section>

        {/* 2. Newest programme */}
        {newest && (
          <p className="mt-[48px] text-center text-[15px] leading-[1.55]">
            <Link href={pubHref([newest.slug])} className="text-charcoal hover:text-gold transition-colors">
              Just announced: <span className="font-semibold">{newest.name} {newest.edition}</span>
              {' · '}{newest.winnerCount.toLocaleString()} winners
              {newest.announcedDate && <>{' · '}{newest.announcedDate}</>} →
            </Link>
          </p>
        )}

        {/* 3. Top of the Record — the only imagery on the page */}
        <section className="mt-[48px]">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal">Top of the Record</h2>
              <p className="text-sm text-charcoal-light mt-1">Recognised by the most publications we track</p>
            </div>
            <Link href="/browse" className="text-sm font-medium text-gold hover:text-gold-dark shrink-0">See all →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-cream-dark">
            {top.map(product => (
              <div key={product.id} className="bg-white flex flex-col">
                <Link href={`/product/${product.slug}`} className="block">
                  <div className="product-tile record-tile aspect-[4/5] relative overflow-hidden">
                    {product.image && (
                      <Image src={product.image} alt={`${product.brand} ${product.name}`} className={`w-full h-full ${product.imageCutout ? "cutout" : ""}`} fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" unoptimized={!product.image.startsWith('/')} />
                    )}
                    <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[11px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
                      {product.topAward.split(' — ')[0]}
                    </span>
                    {product.consensusCount > 1 && (
                      <span className={`absolute top-2 right-2 consensus-badge ${product.consensusCount >= 3 ? 'consensus-high' : ''} text-[11px] w-5 h-5`}>
                        {product.consensusCount}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] font-semibold uppercase microcap text-gold mb-0.5">{product.brand}</p>
                    <h3 className="text-sm font-semibold text-charcoal leading-snug line-clamp-2">{product.name}</h3>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* 4. The record: every way in */}
        <section className="mt-[48px] grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-[48px]">
          <div>
            <h2 className={label}>By publication</h2>
            <ul className="divide-y divide-cream-dark border-t border-b border-cream-dark">
              {publications.map(p => (
                <li key={p.title}>
                  <Link href={pubHref(p.editions.map(e => e.slug))} className={row}>
                    <span>{p.title}</span>
                    <span className="text-charcoal-light">{p.winnerCount.toLocaleString()} winners →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={label}>By category</h2>
            <ul className="divide-y divide-cream-dark border-t border-b border-cream-dark">
              {categories.map(c => (
                <li key={c.slug}>
                  <Link href={`/browse?cat=${c.slug}`} className={row}>
                    <span>{c.label}</span>
                    <span className="text-charcoal-light">{c.count.toLocaleString()} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. In the press */}
        <section className="mt-[48px]">
          <h2 className={label}>In the press</h2>
          <ul className="divide-y divide-cream-dark border-t border-b border-cream-dark">
            {pressArticles.map(article => (
              <li key={article.id}>
                <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className={row}>
                  <span className="truncate">{article.title}</span>
                  <span className="text-charcoal-light shrink-0">{article.source} →</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* 6. Korean rankings: shown, never scored */}
        <section className="mt-[48px] pt-[48px] border-t border-cream-dark pb-[48px]">
          <h2 className={label}>Korean rankings</h2>
          <ul className="divide-y divide-cream-dark border-t border-b border-cream-dark">
            {koreanRankings.map(k => (
              <li key={k.title}>
                <Link href={pubHref(k.editions.map(e => e.slug))} className={row}>
                  <span>{k.title}</span>
                  <span className="text-charcoal-light">{k.winnerCount.toLocaleString()} winners →</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-charcoal-light mt-3">Recorded separately. Never counted toward the consensus score.</p>
        </section>
      </main>

      <EmailCapture />

      <footer className="bg-white border-t border-cream-dark py-6 px-4 text-center">
        <p className="text-xs text-charcoal-light">© 2026 Vettbeauty · <Link href="/about" className="hover:text-charcoal">Only the Vetted</Link></p>
      </footer>
    </>
  );
}

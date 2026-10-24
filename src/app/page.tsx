import Link from 'next/link';
import EmailCapture from "@/components/EmailCapture";
import Wordmark from '@/components/Wordmark';
import SaveCount from '@/components/SaveCount';
import { getShoppable, pressArticles } from '@/lib/data';
import { getFeatureWindow, dayNumber } from "@/lib/featured";
import FeatureRow from "@/components/FeatureRow";
import { getProgrammes, getPublications, getKoreanRankings, getCategories } from '@/lib/record';
import AffiliateNote from '@/components/AffiliateNote';

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

  // Every editorial winner in turn, eight a day (src/lib/featured.ts).
  const { items: featured, total: featuredTotal } = await getFeatureWindow(dayNumber());

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

        {/* 3. From the Record — the only imagery on the page */}
        <section className="mt-[48px]">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal">From the Record</h2>
              <p className="text-xs text-charcoal-light mt-1">
                Every editorial award winner, in turn. Eight a day, working through all{" "}
                {featuredTotal.toLocaleString()}.
              </p>
            </div>
            <Link href="/browse" className="text-sm font-medium text-gold hover:text-gold-dark shrink-0">See all →</Link>
          </div>
          <FeatureRow items={featured} />
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
        <p className="text-xs text-charcoal-light">© 2026 Vettbeauty · <Link href="/about" className="hover:text-charcoal">Only the Vetted</Link> · <a href="/status" className="hover:text-charcoal">Site status</a></p>
        <AffiliateNote className="mt-2 max-w-2xl mx-auto" />
      </footer>
    </>
  );
}

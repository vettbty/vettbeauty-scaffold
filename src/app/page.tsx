import Link from 'next/link';
import Wordmark from '@/components/Wordmark';
import SaveCount from '@/components/SaveCount';
import { products2026, awardPrograms, pressArticles, publications } from '@/lib/data';

export default function Home() {
  const top = [...products2026].sort((a, b) => b.awardCount - a.awardCount).slice(0, 8);
  return (
    <>
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <nav className="flex items-center gap-5">
            <Link href="/browse" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">Browse</Link>
            <Link href="/about" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">About</Link>
            <SaveCount />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-4 pt-14 pb-10 max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gold mb-4">The Verified Record of Beauty</p>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-charcoal mb-4 leading-tight">Only the Vetted</h1>
        <div className="hero-underline mb-5" />
        <p className="text-base sm:text-lg text-charcoal-light leading-relaxed max-w-lg mx-auto mb-7">
          Every product here won a named award from a major beauty publication&apos;s formal awards program.
          No listicles. No paid placements. Only verified winners.
        </p>
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 bg-charcoal text-white px-7 py-3 rounded-xl font-semibold text-sm hover:bg-charcoal-light transition-colors"
        >
          Browse {products2026.length.toLocaleString()} winners →
        </Link>
      </section>

      {/* Trust banner */}
      <div className="bg-white border-y border-cream-dark py-4 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-charcoal-light/70">Cross-Referenced Against</span>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            {publications.map(pub => (
              <li key={pub} className="text-xs sm:text-sm font-medium text-charcoal-light">{pub}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Most-awarded preview */}
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal">Top of the Record</h2>
          <p className="text-sm text-charcoal-light mt-1">The most-awarded products across every publication we track</p>
        </div>
        <Link href="/browse" className="text-sm font-medium text-gold hover:text-gold-dark shrink-0">See all →</Link>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-cream-dark">
          {top.map(product => (
            <div key={product.id} className="bg-white flex flex-col">
              <Link href={`/product/${product.slug}`} className="block">
                <div className="product-tile aspect-square relative overflow-hidden">
                  {product.image && (
                    <img src={product.image} alt={`${product.brand} ${product.name}`} className="w-full h-full" loading="lazy" />
                  )}
                  <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded">
                    {product.topAward.split(' — ')[0]}
                  </span>
                  {product.awardCount > 1 && (
                    <span className={`absolute top-2 right-2 consensus-badge ${product.awardCount >= 3 ? 'consensus-high' : ''} text-[10px] w-5 h-5`}>
                      {product.awardCount}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gold mb-0.5">{product.brand}</p>
                  <h3 className="text-xs font-semibold text-charcoal leading-snug line-clamp-2">{product.name}</h3>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Region note */}
      <div className="max-w-3xl mx-auto px-4 py-6 text-center">
        <p className="text-sm sm:text-base text-charcoal-light leading-relaxed">
          <strong className="text-charcoal">United States · South Korea · France</strong><br className="hidden sm:block" />
          <span className="sm:ml-1">We track award programs beyond the US — regional wins are recorded separately and never counted toward the consensus score.</span>
        </p>
      </div>

      {/* Just In */}
      <section className="bg-white border-t border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 pt-10 pb-2">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal mb-1">Just In</h2>
          <p className="text-sm text-charcoal-light">Newly recorded award programs</p>
        </div>
        <ul className="max-w-6xl mx-auto px-4 pb-10">
          {awardPrograms.map(program => (
            <li key={program.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-4 border-b border-cream-dark last:border-b-0">
              <span className="font-semibold text-charcoal text-sm sm:text-base sm:flex-1">{program.name}</span>
              <span className="text-charcoal-light text-sm">{program.edition}</span>
              <span className="inline-flex self-start bg-cream-dark text-charcoal-light text-xs font-medium px-3 py-1 rounded-full">{program.winnerCount} winners</span>
              <time className="text-charcoal-light/70 text-sm sm:ml-auto">{program.announcedDate}</time>
            </li>
          ))}
        </ul>
      </section>

      {/* In the Press */}
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-2">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal mb-1">In the Press</h2>
        <p className="text-sm text-charcoal-light">Coverage from the publications we track</p>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pressArticles.map(article => (
            <a href={article.sourceUrl} key={article.id} target="_blank" rel="noopener noreferrer"
               className="bg-white rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold mb-2">{article.source}</p>
              <h3 className="text-sm sm:text-base font-semibold text-charcoal leading-snug mb-2">{article.title}</h3>
              <p className="text-xs sm:text-sm text-charcoal-light">On {article.productName}</p>
            </a>
          ))}
        </div>
      </div>

      <footer className="bg-white border-t border-cream-dark py-6 px-4 text-center">
        <p className="text-xs text-charcoal-light">© 2026 Vettbeauty · <Link href="/about" className="hover:text-charcoal">Only the Vetted</Link></p>
      </footer>
    </>
  );
}

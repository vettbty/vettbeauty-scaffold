import Link from 'next/link';
import EmailCapture from "@/components/EmailCapture";
import ProductGrid from "@/components/ProductGrid";
import Wordmark from '@/components/Wordmark';
import SaveCount from '@/components/SaveCount';
import { shoppable, awardPrograms, pressArticles, publications } from '@/lib/data';
import type { Product, AwardProgram } from '@/lib/data';

export default function Home() {
  const top = [...shoppable].sort((a, b) => b.awardCount - a.awardCount).slice(0, 8);

  // The newest award class, taken from the top of awardPrograms so this follows
  // whatever was recorded most recently instead of naming a programme here.
  //
  // It needs its own row because "Top of the Record" sorts by award count, and a
  // freshly imported class cannot compete there: 245 of Allure's 308 2026 winners
  // hold exactly one award, so the biggest import we have ever done moved three
  // faces in the top eight. A visitor had no way to see what had just landed.
  //
  // Only winners with a packshot are shown — the rest render a grey placeholder,
  // and a row of those reads as broken rather than new. They join as the image
  // routine works through them.
  //
  // Every class flagged justAdded gets that row, newest first — Sascha,
  // 2026-09-27: "new additions need to be on site and mentioned on home page".
  // Until then only awardPrograms[0] had a grid, and Cosmopolitan and Marie
  // Claire Readers' Choice were a line of text in "Just In" further down.
  const recordName = (prog: AwardProgram) => prog.recordName || prog.name;
  const wonIn = (prog: AwardProgram) => (w: string) =>
    w.startsWith(`${recordName(prog)} — `) && w.endsWith(`(${prog.edition})`);
  //
  // The WHOLE class is listed, not a preview of it — Sascha, 2026-09-21: "i want
  // all new products on home page". Winners with a packshot lead, so the section
  // opens on real product shots rather than a wall of grey; the rest follow and
  // swap in as the image routine works through them.
  //
  // NOT by award count — Sascha, 2026-09-21: "i dont want the products sorted
  // ... by most awards i want the products of the lastest allure release".
  // Award count is what "Top of the Record" directly below is for; repeating it
  // here just prints that list again under a different heading.
  //
  // This used to order by Allure's own section running order, which worked while
  // the award names were the coarse section labels the winners index publishes
  // ("Skin", "Base"). 254 of the 308 have since been upgraded to the granular
  // names off Allure's category pages ("Best Herbaceous Fragrance"), so there is
  // no section label left to sort on. Alphabetical by brand instead: stable,
  // and it does not pretend to an editorial order we can no longer read.
  const classCategory = (prog: AwardProgram, p: Product) => {
    const win = (p.awardsWon || []).find(wonIn(prog));
    return win ? win.slice(`${recordName(prog)} — `.length, win.lastIndexOf(' (')) : '';
  };
  //
  // Packshot required. Showing the full class put 245 empty grey tiles on the
  // homepage — Sascha, 2026-09-21: "junky and grey patches". A winner joins the
  // grid when it has an image, which the image routine fills in on Tue/Fri.
  const winnersOf = (prog: AwardProgram) => shoppable
    .filter(p => p.image && (p.awardsWon || []).some(wonIn(prog)))
    .sort((a, b) =>
      (b.image ? 1 : 0) - (a.image ? 1 : 0) ||
      a.brand.localeCompare(b.brand) ||
      classCategory(prog, a).localeCompare(classCategory(prog, b))
    );
  const newClasses = awardPrograms
    .filter(prog => prog.justAdded)
    .map(prog => ({ prog, winners: winnersOf(prog) }))
    .filter(c => c.winners.length > 0);
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

      {/* Hero */}
      <section className="text-center px-4 pt-14 pb-10 max-w-2xl mx-auto">
        <p className="eyebrow text-xs text-gold mb-4">The Verified Record of Beauty</p>
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
          Browse {shoppable.length.toLocaleString()} winners →
        </Link>
      </section>

      {/* Trust banner */}
      <div className="bg-white border-y border-cream-dark py-4 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="eyebrow text-[10px] sm:text-xs text-charcoal-light/70">Cross-Referenced Against</span>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            {publications.map(pub => (
              <li key={pub} className="masthead-name text-xs sm:text-sm font-medium text-charcoal-light">{pub}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Newly added award classes */}
      {newClasses.map(({ prog, winners }, i) => (
        <section key={prog.id}>
          <div className="max-w-6xl mx-auto px-4 pt-10 pb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal">
                {i === 0 ? 'Just Announced' : 'Just Added'}: {prog.name} {prog.edition}
              </h2>
              <p className="text-sm text-charcoal-light mt-1">
                {prog.winnerCount.toLocaleString()} winners, announced {prog.announcedDate}
              </p>
            </div>
            <Link href="/browse" className="text-sm font-medium text-gold hover:text-gold-dark shrink-0">See all →</Link>
          </div>
          <div className="max-w-6xl mx-auto px-4 pb-12">
            <ProductGrid products={winners} badge={`${prog.name} ${prog.edition}`} />
          </div>
        </section>
      ))}

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
                    <img src={product.image} alt={`${product.brand} ${product.name}`} className={`w-full h-full ${product.imageCutout ? "cutout" : ""}`} loading="lazy" />
                  )}
                  <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[9px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
                    {product.topAward.split(' — ')[0]}
                  </span>
                  {product.awardCount > 1 && (
                    <span className={`absolute top-2 right-2 consensus-badge ${product.awardCount >= 3 ? 'consensus-high' : ''} text-[10px] w-5 h-5`}>
                      {product.awardCount}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[9px] font-semibold uppercase microcap text-gold mb-0.5">{product.brand}</p>
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
              <p className="eyebrow text-xs text-gold mb-2">{article.source}</p>
              <h3 className="text-sm sm:text-base font-semibold text-charcoal leading-snug mb-2">{article.title}</h3>
              <p className="text-xs sm:text-sm text-charcoal-light">On {article.productName}</p>
            </a>
          ))}
        </div>
      </div>

      <EmailCapture />

      <footer className="bg-white border-t border-cream-dark py-6 px-4 text-center">
        <p className="text-xs text-charcoal-light">© 2026 Vettbeauty · <Link href="/about" className="hover:text-charcoal">Only the Vetted</Link></p>
      </footer>
    </>
  );
}
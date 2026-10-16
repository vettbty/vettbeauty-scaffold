import { notFound } from 'next/navigation';
import Link from 'next/link';
import { products2026, shoppable } from '@/lib/data';
import { priceLabel } from '@/lib/format';
import SaveButton from '@/components/SaveButton';
import { CATEGORIES, OTHER, slugify } from '@/lib/taxonomy';
import { descriptionFor } from '@/lib/descriptions';
import { CONSUMER_PLATFORMS, publicationOf } from '@/lib/consensus';

// Generate static paths for all products
export function generateStaticParams() {
  return products2026.map((product) => ({
    slug: product.slug,
  }));
}

function getProduct(slug: string) {
  return products2026.find((p) => p.slug === slug);
}

/**
 * How each programme actually picks its winners. Editors trialling products and
 * an algorithm ranking shop reviews are both real awards, but they are evidence
 * of different things — see docs/AWARD-METHODOLOGY.md in the data repo. The
 * three non-editorial programmes are named so a reader can tell them apart.
 */
const AWARD_MECHANISM: Record<string, string> = {
  'Glowpick Awards': 'Ranked from shoppers’ reviews',
  'Hwahae Beauty Awards': 'Ranked from shoppers’ reviews',
  'Olive Young Awards': 'Retailer sales ranking',
};

function parseAward(awardStr: string) {
  const match = awardStr.match(/^(.+?) — (.+?) \((\d{4})\)$/);
  if (match) {
    return {
      source: match[1].trim(),
      category: match[2].trim(),
      year: parseInt(match[3]),
    };
  }
  // "Glowpick Awards (2025)" — a win whose category name is published only in
  // Korean. We hold the publication and the year, and print those rather than
  // dropping the award or machine-translating the category.
  const noCategory = awardStr.match(/^(.+?) \((\d{4})\)$/);
  if (noCategory) {
    return {
      source: noCategory[1].trim(),
      category: '',
      year: parseInt(noCategory[2]),
    };
  }
  // Fallback for malformed awards
  const yearMatch = awardStr.match(/\((\d{4})\)/);
  return {
    source: awardStr.split(' — ')[0] || awardStr,
    category: '',
    year: yearMatch ? parseInt(yearMatch[1]) : 2026,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);

  if (!product) {
    notFound();
  }
  const about = descriptionFor(product.slug);
  // The shop price is on show when there is no publication price, or always
  // for Korean products priced from Olive Young US.
  const showingRetail = !!product.retail && (!product.price || product.retail.at === 'Olive Young');
  const categoryKey = CATEGORIES.find(c => c.label === product.category)?.key ?? slugify(product.category);

  const parsedAwards = product.awardsWon.map(parseAward);
  // parsedAwards[i] is product.awardsWon[i] parsed, so the pairing holds.
  // Editorial awards are scored; the Korean consumer platforms' rankings are
  // recorded and shown, in their own section, but never scored.
  const withKind = product.awardsWon.map((raw, i) => {
    const pub = publicationOf(raw);
    return {
      ...parsedAwards[i],
      pub,
      isConsumer: pub !== null && (CONSUMER_PLATFORMS as readonly string[]).includes(pub),
    };
  });
  const editorialAwards = withKind.filter(a => !a.isConsumer);
  const consumerAwards = withKind.filter(a => a.isConsumer);
  const editorialSources = [...new Set(editorialAwards.map(a => a.pub))].filter((p): p is string => p !== null);

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex items-center gap-2 text-sm text-charcoal-light">
            <Link href="/" className="hover:text-charcoal transition-colors">Home</Link>
            <span>/</span>
            <Link
              href={`/browse?cat=${categoryKey}`}
              className="hover:text-charcoal transition-colors"
            >
              {product.category}
            </Link>
            <span>/</span>
            {product.subcategory && product.subcategory !== OTHER && (
              <>
                <Link
                  href={`/browse?cat=${categoryKey}&sub=${slugify(product.subcategory)}`}
                  className="hover:text-charcoal transition-colors"
                >
                  {product.subcategory}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-charcoal truncate max-w-[200px]">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
          {/* Image */}
          <div className="product-tile aspect-square rounded-2xl overflow-hidden relative">
            {product.image ? (
              <img 
                src={product.image} 
                alt={`${product.brand} ${product.name}`}
                className={`w-full h-full ${product.imageCutout ? "cutout" : ""}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-charcoal-light/30">
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {product.consensusCount > 1 && (
              <div className={`absolute top-4 left-4 consensus-badge ${product.consensusCount >= 3 ? 'consensus-high' : ''} w-10 h-10 text-sm`}>
                {product.consensusCount}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <p className="eyebrow text-xs sm:text-sm text-gold mb-2">
              {product.category}
              {product.subcategory && product.subcategory !== OTHER && ` · ${product.subcategory}`}
            </p>
            
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-charcoal mb-2 leading-tight">
              {product.name}
            </h1>
            
            <p className="text-lg sm:text-xl text-charcoal-light mb-6">{product.brand}</p>

            {about && (
              <div className="mb-6">
                <p className="text-sm sm:text-base text-charcoal leading-relaxed">{about.text}</p>
                {about.star.length > 0 && (
                  <div className="mt-4">
                    <p className="eyebrow text-xs text-gold mb-2">Star ingredients</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {about.star.map(i => (
                        <li key={i.name} className="bg-white rounded-lg px-3 py-2 shadow-sm">
                          <p className="text-sm font-semibold text-charcoal">{i.name}</p>
                          <p className="text-xs text-charcoal-light leading-snug">{i.does}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-3 text-[11px] text-charcoal-light">
                  Details from{' '}
                  <a href={about.source} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-charcoal">
                    {product.brand}&apos;s website
                  </a>
                </p>
              </div>
            )}

            {/* Consensus Score: distinct US editorial publications. Consumer
                rankings are listed below, never counted here. */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className={`consensus-badge ${product.consensusCount === 0 ? 'bg-cream-dark text-charcoal-light' : product.consensusCount >= 3 ? 'consensus-high' : ''} w-8 h-8 text-xs`}>
                  {product.consensusCount}
                </span>
                <div>
                  <p className="font-semibold text-charcoal">US Consensus Score</p>
                  <p className="text-sm text-charcoal-light">
                    {product.consensusCount === 0
                      ? 'No US editorial awards recorded'
                      : <>{product.consensusCount} publication{product.consensusCount !== 1 ? 's' : ''}</>}
                  </p>
                </div>
              </div>
              {editorialSources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editorialSources.map(source => (
                    <span key={source} className="text-xs bg-cream-dark text-charcoal-light px-2 py-1 rounded-full">
                      {source}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Price & CTA */}
            <div className="flex items-center gap-4 mb-8">
              <span className="text-2xl sm:text-3xl font-bold text-charcoal">
                {priceLabel(product) ?? 'Price unavailable'}
                {showingRetail && product.retail && (
                  <span className="block text-[11px] font-normal text-charcoal-light mt-0.5">
                    {product.retail.at ? `at ${product.retail.at} · ` : ''}checked {new Date(product.retail.checked + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </span>
              {product.buyLink && (
                <a
                  href={product.buyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 max-w-xs bg-charcoal text-white text-center py-3 px-6 rounded-xl font-semibold text-sm hover:bg-charcoal-light transition-colors"
                >
                  Check Price →
                </a>
              )}
            </div>

            <div className="mb-8 -mt-4">
              <SaveButton
                product={{
                  id: product.id,
                  slug: product.slug,
                  brand: product.brand,
                  name: product.name,
                  price: product.price,
                  image: product.image,
                  topAward: product.topAward,
                  awardCount: product.awardCount,
                  consensusCount: product.consensusCount,
                }}
              />
            </div>

            {/* Region — catalogue records regions as "US", "France", or a
               comma-joined list; flag anything that isn't US-only. */}
            {product.region && product.region !== 'US' && (
              <div className="bg-gold/10 border border-gold/20 rounded-lg p-3 mb-6">
                <p className="text-xs sm:text-sm text-charcoal">
                  <strong>Regions:</strong> {product.region}. 
                  Regional wins don&apos;t count toward the US consensus score.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Awards Timeline */}
      <section className="bg-white border-t border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {editorialAwards.length > 0 && (
            <>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal mb-6">
            Editorial awards
          </h2>
          <div className="space-y-4">
            {[...editorialAwards]
              .sort((a, b) => b.year - a.year)
              .map((award, i) => (
                <div 
                  key={i} 
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 bg-cream rounded-xl"
                >
                  <span className="inline-flex self-start sm:self-center bg-charcoal text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {award.year}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-charcoal text-sm sm:text-base">
                      {award.source}
                    </p>
                    {award.category && (
                      <p className="text-sm text-charcoal-light">{award.category}</p>
                    )}
                    {AWARD_MECHANISM[award.source] && (
                      <p className="text-xs text-charcoal-light italic">
                        {AWARD_MECHANISM[award.source]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
            </>
          )}

          {consumerAwards.length > 0 && (
            <>
          <h2 className={`font-serif text-xl sm:text-2xl font-semibold text-charcoal mb-6 ${editorialAwards.length > 0 ? 'mt-10' : ''}`}>
            Consumer rankings
          </h2>
          <div className="space-y-4">
            {[...consumerAwards]
              .sort((a, b) => b.year - a.year)
              .map((award, i) => (
                <div 
                  key={i} 
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 bg-cream rounded-xl"
                >
                  <span className="inline-flex self-start sm:self-center bg-charcoal text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {award.year}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-charcoal text-sm sm:text-base">
                      {award.source}
                    </p>
                    {award.category && (
                      <p className="text-sm text-charcoal-light">{award.category}</p>
                    )}
                    {AWARD_MECHANISM[award.source] && (
                      <p className="text-xs text-charcoal-light italic">
                        {AWARD_MECHANISM[award.source]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
            </>
          )}
        </div>
      </section>

      {/* Where to Buy - Honest Version */}
      {product.buyLink && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
            <h3 className="font-serif text-lg font-semibold text-charcoal mb-4">Where to Buy</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-charcoal">{product.brand} {product.name}</p>
                <p className="text-sm text-charcoal-light">
                  {priceLabel(product) ? `${priceLabel(product)}${showingRetail && product.retail?.at ? ` at ${product.retail.at}` : ''}` : 'Price varies by retailer'}
                </p>
              </div>
              <a
                href={product.buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gold text-white py-3 px-6 rounded-xl font-semibold text-sm hover:bg-gold-dark transition-colors"
              >
                Check Price →
              </a>
            </div>
            {product.linkType === 'search' && (
              <p className="text-xs text-charcoal-light mt-3">
                This link searches for the product. Exact availability and price may vary.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Related Products - Same Category */}
      <section className="bg-white border-t border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal mb-6">
            More {product.category} Winners
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {shoppable
              .filter(p => p.category === product.category && p.id !== product.id)
              .slice(0, 4)
              .map(related => (
                <Link
                  href={`/product/${related.slug}`}
                  key={related.id}
                  className="group bg-cream rounded-xl overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="product-tile aspect-square relative overflow-hidden">
                    {related.image ? (
                      <img 
                        src={related.image} 
                        alt={related.name}
                        className={`w-full h-full group-hover:scale-105 transition-transform ${related.imageCutout ? "cutout" : ""}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-charcoal-light/30">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] font-semibold uppercase microcap text-gold mb-1">{related.brand}</p>
                    <p className="text-sm font-semibold text-charcoal line-clamp-2">{related.name}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Back to Browse */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-center">
        <Link 
          href="/browse"
          className="inline-flex items-center gap-2 text-gold font-semibold hover:underline"
        >
          ← Browse all {product.category.toLowerCase()}
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-cream-dark py-6 sm:py-8 px-4 text-center">
        <p className="text-xs sm:text-sm text-charcoal-light">© 2026 Vettbeauty. Every award-winning beauty product, verified.</p>
      </footer>
    </>
  );
}

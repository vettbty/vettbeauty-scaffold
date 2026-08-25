import Link from 'next/link';
import Wordmark from '@/components/Wordmark';
import sale from '@/lib/sale.json';

export const metadata = {
  title: 'On Sale — Award Winners, Reduced | Vettbeauty',
  description:
    'Beauty products that formally won a named award and currently cost less than the price the awarding publication printed.',
};

type Deal = (typeof sale.items)[number];

function Card({ d, hero = false }: { d: Deal; hero?: boolean }) {
  const inner = (
    <>
      <div className={`product-tile relative overflow-hidden ${hero ? 'aspect-[4/3] sm:aspect-square' : 'aspect-square'}`}>
        {d.image && (
          <img src={d.image} alt={`${d.brand} ${d.product}`} className={`w-full h-full ${d.imageCutout ? 'cutout' : ''}`} loading="lazy" />
        )}
        <span className={`absolute top-2 left-2 consensus-badge consensus-high ${hero ? 'w-14 h-14 text-base' : 'w-11 h-11 text-xs'}`}>
          −{d.percentOff}%
        </span>
        {d.topAward && (
          <span className="absolute bottom-2 left-2 bg-charcoal/90 text-white text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded">
            {d.topAward.split(' — ')[0]}
          </span>
        )}
      </div>
      <div className={hero ? 'p-5' : 'p-3'}>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gold mb-0.5">{d.brand}</p>
        <h3 className={`font-semibold text-charcoal leading-snug ${hero ? 'text-lg mb-2' : 'text-xs line-clamp-2 mb-2'}`}>{d.product}</h3>
        <div className="flex items-baseline gap-2">
          <span className={`font-bold text-charcoal ${hero ? 'text-2xl' : 'text-sm'}`}>${d.now}</span>
          <span className={`text-charcoal-light line-through ${hero ? 'text-base' : 'text-xs'}`}>${d.was}</span>
          <span className="text-[9px] uppercase tracking-wider text-charcoal-light ml-auto">{d.retailer}</span>
        </div>
        <a
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 inline-flex items-center justify-center w-full rounded-lg font-semibold uppercase tracking-wider bg-gold text-white hover:bg-gold-dark transition-colors ${hero ? 'py-3 text-xs' : 'py-2 text-[10px]'}`}
        >
          Get it for ${d.now} →
        </a>
      </div>
    </>
  );
  return <div className={`bg-white ${hero ? 'rounded-2xl overflow-hidden shadow-sm sm:grid sm:grid-cols-2' : 'flex flex-col'}`}>{inner}</div>;
}

export default function SalePage() {
  const items = sale.items as Deal[];
  const [top, ...rest] = items;
  return (
    <>
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <nav className="flex items-center gap-5">
            <Link href="/browse" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">Browse</Link>
            <Link href="/about" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">About</Link>
          </nav>
        </div>
      </header>

      <section className="text-center px-4 pt-12 pb-8 max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gold mb-3">Price Watch</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal mb-3">The Sale Rack</h1>
        <p className="text-base text-charcoal-light leading-relaxed max-w-md mx-auto">
          {items.length} award winners currently priced <em>below</em> what they cost when they won.
          The struck-through figure is the awarding publication&apos;s printed price — not an inflated RRP.
        </p>
      </section>

      {items.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-charcoal-light mb-2">Deepest cut</p>
          <Card d={top} hero />
        </div>
      )}

      {rest.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-cream-dark">
            {rest.map(d => <Card key={`${d.brand}-${d.product}-${d.retailer}`} d={d} />)}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pb-12 text-center">
        <p className="text-xs text-charcoal-light leading-relaxed">
          Prices checked {sale.generated} against live retailer pages. A reduction is only listed when
          the current price is below the price the awarding publication printed — the one honest
          &ldquo;was.&rdquo; Availability changes fast; the link shows today&apos;s truth.
        </p>
      </div>

      <footer className="bg-white border-t border-cream-dark py-6 px-4 text-center">
        <p className="text-xs text-charcoal-light">© 2026 Vettbeauty · Only the Vetted</p>
      </footer>
    </>
  );
}

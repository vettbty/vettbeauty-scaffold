'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import SaveCount from '@/components/SaveCount';
import Wordmark from '@/components/Wordmark';

export interface Deal {
  brand: string;
  product: string;
  retailer: string | null;
  was: number;
  now: number;
  percentOff: number;
  url: string;
  size: string | null;
  slug: string | null;
  image: string | null;
  imageCutout: boolean;
  topAward: string | null;
  category: string | null;
  subcategory: string | null;
  awardCount: number;
  awardsWon: string[];
}

type SortKey = 'discount' | 'saving' | 'price-asc' | 'price-desc' | 'awards';

// The hero card is just the first row of the sorted list, so its label has to
// follow the sort or it lies the moment anyone re-sorts.
const HERO_LABEL: Record<SortKey, string> = {
  discount: 'Deepest cut',
  saving: 'Biggest saving',
  'price-asc': 'Lowest price',
  'price-desc': 'Highest price',
  awards: 'Most awarded',
};

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

/** Publication name only — topAward reads "InStyle Best Beauty Buys — Best Lash Serum (2026)". */
const publication = (award: string) => award.split(' — ')[0];

function Card({ d, hero = false }: { d: Deal; hero?: boolean }) {
  const saving = Math.round(d.was - d.now);

  const tile = (
    <div
      className={`product-tile relative overflow-hidden ${
        hero ? 'aspect-[4/3] sm:aspect-square' : 'aspect-square'
      }`}
    >
      {d.image ? (
        <img
          src={d.image}
          alt={`${d.brand} ${d.product}`}
          className={`w-full h-full ${d.imageCutout ? 'cutout' : ''}`}
          /* The hero is the LCP element — never defer it. */
          loading={hero ? 'eager' : 'lazy'}
          fetchPriority={hero ? 'high' : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-charcoal-light/30">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <span
        className={`absolute top-2 left-2 consensus-badge consensus-high ${
          hero ? 'w-14 h-14 text-base' : 'w-11 h-11 text-xs'
        }`}
      >
        −{d.percentOff}%
      </span>

      {d.awardCount > 1 && (
        <span
          className={`absolute top-2 right-2 consensus-badge ${d.awardCount >= 3 ? 'consensus-high' : ''} ${
            hero ? 'w-7 h-7 text-xs' : 'w-5 h-5 text-[10px]'
          }`}
          title={`${d.awardCount} awards`}
        >
          {d.awardCount}
        </span>
      )}

      {d.topAward && !hero && (
        <span className="absolute bottom-2 left-2 bg-charcoal/90 text-white text-[9px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
          {publication(d.topAward)}
        </span>
      )}
    </div>
  );

  const heading = (
    <div className={hero ? 'px-5 pt-5' : 'p-3 pb-2'}>
      <p className="text-[9px] font-semibold uppercase microcap text-gold mb-0.5">{d.brand}</p>
      <h3
        className={`font-semibold text-charcoal leading-snug ${
          hero ? 'text-lg mb-2' : 'text-xs line-clamp-2'
        }`}
      >
        {d.product}
      </h3>
      {hero && d.topAward && (
        <p className="text-xs text-charcoal-light leading-relaxed">
          {d.topAward}
          {d.awardCount > 1 && ` · ${d.awardCount} awards in total`}
        </p>
      )}
    </div>
  );

  // The tile and the name go to our own product page; only the CTA leaves the
  // site. (Same split as /browse.) Deals whose brand+name found no catalogue
  // row have no slug, so they render unlinked rather than pointing at /404.
  const Linked = ({ children }: { children: React.ReactNode }) =>
    d.slug ? (
      <Link href={`/product/${d.slug}`} className="block">{children}</Link>
    ) : (
      <>{children}</>
    );

  const buy = (
    <a
      href={d.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center w-full rounded-lg font-semibold uppercase microcap bg-gold text-white hover:bg-gold-dark transition-colors ${
        hero ? 'mt-3 py-3 text-xs' : 'mt-2 py-2 text-[10px]'
      }`}
    >
      Get it for {money(d.now)} →
    </a>
  );

  if (hero) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm sm:grid sm:grid-cols-2 sm:items-center">
        <Linked>{tile}</Linked>
        <div>
          <Linked>{heading}</Linked>
          <div className="px-5 pb-5">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-bold text-charcoal text-2xl">{money(d.now)}</span>
              <span className="text-charcoal-light line-through text-base">{money(d.was)}</span>
              {saving > 0 && <span className="text-xs font-semibold text-gold">Save ${saving}</span>}
            </div>
            <p className="text-[10px] uppercase microcap text-charcoal-light">
              {d.retailer}
              {d.size && ` · ${d.size}`}
            </p>
            {buy}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white flex flex-col">
      <Linked>
        {tile}
        {heading}
      </Linked>
      <div className="px-3 pb-3 mt-auto">
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold text-charcoal text-sm">{money(d.now)}</span>
          <span className="text-charcoal-light line-through text-xs">{money(d.was)}</span>
          <span className="text-[9px] uppercase microcap text-charcoal-light ml-auto">
            {d.retailer}
          </span>
        </div>
        {d.size && <p className="text-[9px] text-charcoal-light mt-0.5">{d.size}</p>}
        {buy}
      </div>
    </div>
  );
}

export default function SaleBrowser({ items, generated }: { items: Deal[]; generated: string }) {
  const [category, setCategory] = useState('all');
  const [retailer, setRetailer] = useState('all');
  const [maxPrice, setMaxPrice] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('discount');

  const { categories, retailers, deepest, cheapest } = useMemo(
    () => ({
      categories: [...new Set(items.map(i => i.category).filter(Boolean))].sort() as string[],
      retailers: [...new Set(items.map(i => i.retailer).filter(Boolean))].sort() as string[],
      deepest: items.reduce((m, i) => Math.max(m, i.percentOff), 0),
      cheapest: items.reduce((m, i) => Math.min(m, i.now), Infinity),
    }),
    [items]
  );

  const filtered = useMemo(() => {
    let out = items;
    if (category !== 'all') out = out.filter(i => i.category === category);
    if (retailer !== 'all') out = out.filter(i => i.retailer === retailer);
    if (maxPrice !== 'all') out = out.filter(i => i.now <= Number(maxPrice));
    return [...out].sort((a, b) => {
      switch (sortBy) {
        case 'saving': return (b.was - b.now) - (a.was - a.now);
        case 'price-asc': return a.now - b.now;
        case 'price-desc': return b.now - a.now;
        case 'awards': return b.awardCount - a.awardCount;
        default: return b.percentOff - a.percentOff;
      }
    });
  }, [items, category, retailer, maxPrice, sortBy]);

  const filtersActive = category !== 'all' || retailer !== 'all' || maxPrice !== 'all';
  const clear = () => { setCategory('all'); setRetailer('all'); setMaxPrice('all'); };
  const [top, ...rest] = filtered;

  const selectClass =
    'shrink-0 px-3 py-1.5 bg-white border border-warm-beige/30 rounded-lg text-xs text-charcoal focus:outline-none focus:border-gold';

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

      <section className="text-center px-4 pt-12 pb-6 max-w-2xl mx-auto">
        <p className="eyebrow text-xs text-gold mb-3">Price Watch</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal mb-3">The Sale Rack</h1>
        <p className="text-base text-charcoal-light leading-relaxed max-w-md mx-auto">
          {items.length} award winners currently priced below what they cost when they won.
          The struck-through figure is the price the awarding publication printed.
        </p>
        {items.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-6 text-center">
            <div>
              <p className="font-serif text-xl font-bold text-charcoal">{items.length}</p>
              <p className="text-[10px] uppercase microcap text-charcoal-light">Winners</p>
            </div>
            <div className="w-px h-8 bg-cream-dark" />
            <div>
              <p className="font-serif text-xl font-bold text-charcoal">{deepest}%</p>
              <p className="text-[10px] uppercase microcap text-charcoal-light">Deepest cut</p>
            </div>
            <div className="w-px h-8 bg-cream-dark" />
            <div>
              <p className="font-serif text-xl font-bold text-charcoal">{money(cheapest)}</p>
              <p className="text-[10px] uppercase microcap text-charcoal-light">From</p>
            </div>
          </div>
        )}
      </section>

      <div className="max-w-6xl mx-auto px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setCategory('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === 'all' ? 'bg-charcoal text-white' : 'bg-cream-dark text-charcoal-light'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === c ? 'bg-charcoal text-white' : 'bg-cream-dark text-charcoal-light'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto mt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className={selectClass} aria-label="Sort by">
            <option value="discount">Biggest discount</option>
            <option value="saving">Biggest saving ($)</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="awards">Most awarded</option>
          </select>
          <select value={retailer} onChange={e => setRetailer(e.target.value)} className={selectClass} aria-label="Retailer">
            <option value="all">All retailers</option>
            {retailers.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className={selectClass} aria-label="Maximum price">
            <option value="all">Any price</option>
            <option value="25">Under $25</option>
            <option value="50">Under $50</option>
            <option value="100">Under $100</option>
          </select>
          {filtersActive && (
            <button onClick={clear} className="shrink-0 px-3 py-1.5 text-xs text-gold font-medium">Clear</button>
          )}
        </div>

        <p className="text-xs text-charcoal-light mt-2">
          {filtered.length} {filtered.length === 1 ? 'deal' : 'deals'}
          {filtersActive && ` of ${items.length}`}
        </p>
      </div>

      {top && (
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <p className="eyebrow text-[10px] text-charcoal-light mb-2">
            {HERO_LABEL[sortBy]}
          </p>
          <Card d={top} hero />
        </div>
      )}

      {rest.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-cream-dark">
            {rest.map(d => (
              <Card key={`${d.brand}-${d.product}-${d.retailer}`} d={d} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-charcoal-light mb-2">No deals match those filters.</p>
          <button onClick={clear} className="text-gold text-sm font-medium hover:underline">Clear</button>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pb-12 text-center">
        <p className="text-xs text-charcoal-light leading-relaxed">
          Prices checked {generated} against live retailer pages. A product is listed only when
          its current price is below the price the awarding publication printed. Availability and
          pricing change quickly.
        </p>
      </div>

      <footer className="bg-white border-t border-cream-dark py-6 px-4 text-center">
        <p className="text-xs text-charcoal-light">© 2026 Vettbeauty · Only the Vetted</p>
      </footer>
    </>
  );
}

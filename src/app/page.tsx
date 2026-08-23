'use client';

import Link from 'next/link';
import { useState, useMemo, useRef } from 'react';
import { products2026 } from '@/lib/data';
import SaveCount from '@/components/SaveCount';

const categoryMap: Record<string, string> = {
  'skincare': 'Skincare',
  'makeup': 'Makeup',
  'hair': 'Hair',
  'body': 'Body',
  'fragrance': 'Fragrance',
  'tools-devices': 'Tools & Devices',
  'wellness': 'Wellness',
  'nails': 'Nails'
};

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    let filtered = products2026;
    if (activeFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryMap[activeFilter]);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.brand.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.topAward.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => b.awardCount - a.awardCount);
  }, [activeFilter, searchQuery]);

  return (
    <>
      {/* Minimal header */}
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-bold tracking-tight text-charcoal">
            Vett<span className="text-gold">beauty</span>
          </Link>
          <div className="flex items-center gap-1">
          <SaveCount className="ml-2" />
          <button
            aria-label="Search"
            className="p-2 text-charcoal-light hover:text-charcoal"
            onClick={() => searchRef.current?.focus()}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          </div>
        </div>
      </header>

      {/* 2-line hero */}
      <section className="max-w-2xl mx-auto px-4 pt-8 pb-6 text-center">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal leading-snug">
          Award-winning beauty, verified.
        </h1>
        <button
          onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="mt-3 inline-flex items-center gap-1 text-gold font-semibold text-sm hover:text-gold-dark"
        >
          Browse →
        </button>
      </section>

      {/* Sticky search */}
      <div className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm px-4 py-2 border-b border-cream-dark">
        <div className="max-w-6xl mx-auto">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search products, brands, awards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-warm-beige/30 rounded-lg text-sm text-charcoal placeholder:text-charcoal-light/60 focus:outline-none focus:border-gold"
          />
        </div>
      </div>

      {/* Scrollable categories */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveFilter('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === 'all' ? 'bg-charcoal text-white' : 'bg-cream-dark text-charcoal-light'
            }`}
          >
            All
          </button>
          {Object.entries(categoryMap).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFilter === key ? 'bg-charcoal text-white' : 'bg-cream-dark text-charcoal-light'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-charcoal-light mt-2">{filteredProducts.length} products</p>
      </div>

      {/* 2-column grid, no gaps */}
      <div ref={gridRef} className="max-w-6xl mx-auto pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-cream-dark">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white flex flex-col">
              <Link href={`/product/${product.slug}`} className="block">
                <div className="product-tile aspect-square relative overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={`${product.brand} ${product.name}`}
                      className="w-full h-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-charcoal-light/30">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
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
              <div className="px-3 pb-3 mt-auto flex items-center justify-between">
                <span className="text-xs font-bold text-charcoal">{product.price ? `$${product.price}` : '—'}</span>
                {product.buyLink && (
                  <a
                    href={product.buyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-semibold text-gold uppercase tracking-wider"
                  >
                    Check Price →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-charcoal-light mb-2">No products match.</p>
            <button
              onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}
              className="text-gold text-sm font-medium hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Footer only */}
      <footer className="bg-white border-t border-cream-dark py-6 px-4 text-center">
        <p className="text-xs text-charcoal-light">© Vettbeauty</p>
      </footer>
    </>
  );
}

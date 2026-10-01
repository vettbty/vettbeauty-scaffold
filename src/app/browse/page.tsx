'use client';

import Link from 'next/link';
import { useState, useMemo, useRef, useEffect } from 'react';
import { products2026, shoppable, type Product } from '@/lib/data';
import { CATEGORIES, OTHER, slugify, subcategoriesOf } from '@/lib/taxonomy';
import { search, suggest, type Suggestion } from '@/lib/search';
import SaveCount from '@/components/SaveCount';
import Wordmark from '@/components/Wordmark';

const categoryMap: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label]));

// "Allure Best of Beauty — Best Serum (2026)" and "Glowpick Awards (2025)" →
// the programme name alone, so each publication is one choice, not one per year.
const programOf = (award: string) => award.split(' — ')[0].replace(/\s*\(\d{4}\)\s*$/, '').trim();

type Sort = 'auto' | 'relevance' | 'awards' | 'price-asc' | 'price-desc' | 'name' | 'brand';

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeSub, setActiveSub] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<Sort>('auto');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<'any' | 'all'>('any');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [minAwards, setMinAwards] = useState<number>(1);
  const [brandQuery, setBrandQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { availableYears, availableSources, availableBrands } = useMemo(() => {
    const years = new Set<string>(); const sources = new Set<string>(); const brands = new Set<string>();
    products2026.forEach(p => {
      brands.add(p.brand);
      p.awardsWon.forEach(a => {
        const y = a.match(/\((\d{4})\)/); if (y) years.add(y[1]);
        const src = programOf(a); if (src) sources.add(src);
      });
    });
    return {
      availableYears: [...years].sort().reverse(),
      availableSources: [...sources].sort(),
      availableBrands: [...brands].sort((a, b) => a.localeCompare(b)),
    };
  }, []);

  // Filters live in the URL (?q=&cat=&sub=&brand=) so a result can be shared,
  // bookmarked, and survives the back button from a product page. Read once on
  // mount; written with replaceState so typing doesn't stack history entries.
  const [hydrated, setHydrated] = useState(false);
  // The page is prerendered with default filters (so the grid stays in the
  // static HTML); the URL is only known after hydration. useSearchParams would
  // instead push the whole grid behind a Suspense boundary and out of the HTML.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const cat = u.get('cat');
    if (cat && categoryMap[cat]) setActiveFilter(cat);
    if (u.get('sub')) setActiveSub(u.get('sub')!);
    if (u.get('q')) setSearchQuery(u.get('q')!);
    if (u.get('brand')) setBrandQuery(u.get('brand')!);
    const pubs = u.get('pub')?.split(',').filter(Boolean) ?? [];
    if (pubs.length) setSelectedSources(availableSources.filter(src => pubs.includes(slugify(src))));
    if (u.get('pubmode') === 'all') setSourceMode('all');
    setHydrated(true);
  }, [availableSources]); // memoised once; runs on mount only
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated) return;
    const u = new URLSearchParams();
    if (searchQuery.trim()) u.set('q', searchQuery.trim());
    if (activeFilter !== 'all') u.set('cat', activeFilter);
    if (activeFilter !== 'all' && activeSub !== 'all') u.set('sub', activeSub);
    if (brandQuery.trim()) u.set('brand', brandQuery.trim());
    if (selectedSources.length) u.set('pub', selectedSources.map(slugify).join(','));
    if (selectedSources.length > 1 && sourceMode === 'all') u.set('pubmode', 'all');
    const qs = u.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [hydrated, searchQuery, activeFilter, activeSub, brandQuery, selectedSources, sourceMode]);

  const searching = searchQuery.trim() !== '';
  const effectiveSort: Sort = sortBy === 'auto' ? (searching ? 'relevance' : 'awards') : sortBy;

  // Every filter except category/subcategory, so the chips can show counts and
  // the "in all categories" hint can say what a wider search would find.
  const { base, scores, prePub } = useMemo(() => {
    // Browsing shows buyable winners only; a typed search reaches every winner,
    // so a reader looking for a specific product can still find its page.
    let pool: Product[] = searching || brandQuery.trim() ? products2026 : shoppable;
    if (selectedYear !== 'all') pool = pool.filter(p => p.awardsWon.some(a => a.includes(`(${selectedYear})`)));
    if (minAwards > 1) pool = pool.filter(p => p.awardCount >= minAwards);
    if (brandQuery.trim()) {
      const b = brandQuery.trim().toLowerCase();
      pool = pool.filter(p => p.brand.toLowerCase().includes(b));
    }
    const scores = new Map<string, number>();
    if (searching) {
      // Search the whole catalogue once, then intersect with the pool.
      const inPool = new Set(pool.map(p => p.id));
      const hits = search(products2026, searchQuery).filter(r => inPool.has(r.product.id));
      for (const r of hits) scores.set(r.product.id, r.score);
      pool = hits.map(r => r.product);
    }
    // Publications last: the pool before them feeds the publication counts.
    const prePub = pool;
    if (selectedSources.length) {
      pool = pool.filter(p => {
        const won = new Set(p.awardsWon.map(programOf));
        return sourceMode === 'all' ? selectedSources.every(src => won.has(src)) : selectedSources.some(src => won.has(src));
      });
    }
    return { base: pool, scores, prePub };
  }, [searching, searchQuery, selectedYear, selectedSources, sourceMode, minAwards, brandQuery]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of base) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [base]);

  const activeCategory = activeFilter !== 'all' ? categoryMap[activeFilter] : null;

  const subChips = useMemo(() => {
    if (!activeCategory) return [];
    const counts: Record<string, number> = {};
    for (const p of base) if (p.category === activeCategory) counts[p.subcategory] = (counts[p.subcategory] ?? 0) + 1;
    return subcategoriesOf(activeCategory)
      .filter(label => counts[label])
      .map(label => ({ key: slugify(label), label, count: counts[label] }))
      .sort((a, b) => Number(a.label === OTHER) - Number(b.label === OTHER) || b.count - a.count);
  }, [base, activeCategory]);

  const activeSubLabel = subChips.find(c => c.key === activeSub)?.label ?? null;

  // Each publication's count is what ticking it alone would show, within the
  // current category, subcategory and every other filter.
  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of prePub) {
      if (activeCategory && p.category !== activeCategory) continue;
      if (activeCategory && activeSubLabel && p.subcategory !== activeSubLabel) continue;
      for (const src of new Set(p.awardsWon.map(programOf))) c[src] = (c[src] ?? 0) + 1;
    }
    return c;
  }, [prePub, activeCategory, activeSubLabel]);

  const filteredProducts = useMemo(() => {
    let filtered = base;
    if (activeCategory) filtered = filtered.filter(p => p.category === activeCategory);
    if (activeCategory && activeSubLabel) filtered = filtered.filter(p => p.subcategory === activeSubLabel);
    return [...filtered].sort((a, b) => {
      switch (effectiveSort) {
        case 'relevance': return (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.awardCount - a.awardCount;
        case 'price-asc': return (a.price ?? Infinity) - (b.price ?? Infinity);
        case 'price-desc': return (b.price ?? -Infinity) - (a.price ?? -Infinity);
        case 'name': return a.name.localeCompare(b.name);
        case 'brand': return a.brand.localeCompare(b.brand);
        default: return b.awardCount - a.awardCount;
      }
    });
  }, [base, activeCategory, activeSubLabel, effectiveSort, scores]);

  const suggestions = useMemo(() => (searching ? suggest(products2026, searchQuery) : []), [searching, searchQuery]);

  // The tile label names the award that matches the active year and publication
  // filters. It used to always show topAward, so a product kept by the 2026
  // filter for its 2026 win could still be labelled with an older 2025 award.
  const labelFor = (p: Product) => {
    const fits = (a: string) =>
      (selectedYear === 'all' || a.includes(`(${selectedYear})`)) &&
      (!selectedSources.length || selectedSources.includes(programOf(a)));
    const award = fits(p.topAward) ? p.topAward : p.awardsWon.find(fits) ?? p.topAward;
    const year = award.match(/\((\d{4})\)/)?.[1];
    return year ? `${programOf(award)} ${year}` : programOf(award);
  };

  const chooseCategory = (key: string) => { setActiveFilter(key); setActiveSub('all'); };
  const applySuggestion = (s: Suggestion) => {
    if (s.kind === 'brand') setBrandQuery(s.label);
    else {
      const cat = CATEGORIES.find(c => c.label === s.category);
      if (cat) { setActiveFilter(cat.key); setActiveSub(slugify(s.label)); }
    }
    setSearchQuery('');
  };
  const clearAll = () => {
    setActiveFilter('all'); setActiveSub('all'); setSelectedYear('all'); setSelectedSources([]); setSourceMode('any');
    setMinAwards(1); setSearchQuery(''); setBrandQuery(''); setSortBy('auto');
  };
  const anyFilter = activeFilter !== 'all' || selectedYear !== 'all' || selectedSources.length > 0 || minAwards > 1 || searchQuery || brandQuery;
  const outsideCategory = activeCategory ? base.length - (categoryCounts[activeCategory] ?? 0) : 0;

  const chip = (active: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-charcoal text-white' : 'bg-cream-dark text-charcoal-light hover:text-charcoal'}`;

  return (
    <>
      {/* Minimal header */}
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark className="text-xl" />
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
          <form role="search" onSubmit={e => { e.preventDefault(); searchRef.current?.blur(); }} className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-light/60 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              enterKeyHint="search"
              aria-label="Search products"
              placeholder="Try “vitamin c serum”, “Dyson” or “sunscreen”"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setSearchQuery(''); }}
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-warm-beige/30 rounded-lg text-base sm:text-sm text-charcoal placeholder:text-charcoal-light/60 focus:outline-none focus:border-gold [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-charcoal-light hover:text-charcoal hover:bg-cream-dark"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </form>
          {suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {suggestions.map(sg => (
                <button
                  key={`${sg.kind}-${sg.category ?? ''}-${sg.label}`}
                  onClick={() => applySuggestion(sg)}
                  className="shrink-0 px-3 py-1 rounded-full border border-gold/40 bg-white text-xs text-charcoal hover:border-gold"
                >
                  <span className="text-charcoal-light">{sg.kind === 'brand' ? 'Brand' : sg.category}:</span>{' '}
                  <span className="font-medium">{sg.label}</span>{' '}
                  <span className="text-charcoal-light">{sg.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Categories, then that category's subcategories */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => chooseCategory('all')} className={chip(activeFilter === 'all')}>All</button>
          {CATEGORIES.map(({ key, label }) => (
            <button key={key} onClick={() => chooseCategory(key)} className={chip(activeFilter === key)}>
              {label}
              {searching && <span className="ml-1 opacity-60">{categoryCounts[label] ?? 0}</span>}
            </button>
          ))}
        </div>
        {subChips.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mt-2 pl-2 border-l-2 border-gold/40 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveSub('all')}
              className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${!activeSubLabel ? 'bg-gold text-white' : 'bg-white border border-cream-dark text-charcoal-light hover:text-charcoal'}`}
            >
              All {activeCategory}
            </button>
            {subChips.map(c => (
              <button
                key={c.key}
                onClick={() => setActiveSub(c.key)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${activeSub === c.key ? 'bg-gold text-white' : 'bg-white border border-cream-dark text-charcoal-light hover:text-charcoal'}`}
              >
                {c.label === OTHER ? `Other ${activeCategory}` : c.label}
                <span className="ml-1 opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto mt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <select value={effectiveSort} onChange={e => setSortBy(e.target.value as Sort)} aria-label="Sort"
            className="shrink-0 px-3 py-1.5 bg-white border border-warm-beige/30 rounded-lg text-xs text-charcoal focus:outline-none focus:border-gold">
            {searching && <option value="relevance">Best match</option>}
            <option value="awards">Most awarded</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name A–Z</option>
            <option value="brand">Brand A–Z</option>
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} aria-label="Award year"
            className="shrink-0 px-3 py-1.5 bg-white border border-warm-beige/30 rounded-lg text-xs text-charcoal focus:outline-none focus:border-gold">
            <option value="all">All years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <input
            list="brand-list"
            value={brandQuery}
            onChange={e => setBrandQuery(e.target.value)}
            placeholder="Brand"
            aria-label="Brand"
            className="shrink-0 w-32 px-3 py-1.5 bg-white border border-warm-beige/30 rounded-lg text-xs text-charcoal placeholder:text-charcoal-light/60 focus:outline-none focus:border-gold"
          />
          <datalist id="brand-list">
            {availableBrands.map(b => <option key={b} value={b} />)}
          </datalist>
          <button
            onClick={() => setSourcesOpen(o => !o)}
            aria-expanded={sourcesOpen}
            aria-controls="publication-panel"
            className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border focus:outline-none ${selectedSources.length ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal border-warm-beige/30 hover:border-gold'}`}
          >
            {selectedSources.length ? `Publications (${selectedSources.length})` : 'All publications'}
            <svg className={`w-3 h-3 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <select value={minAwards} onChange={e => setMinAwards(parseInt(e.target.value))} aria-label="Minimum awards"
            className="shrink-0 px-3 py-1.5 bg-white border border-warm-beige/30 rounded-lg text-xs text-charcoal focus:outline-none focus:border-gold">
            <option value={1}>Any awards</option>
            <option value={2}>2+ awards</option>
            <option value={3}>3+ awards</option>
            <option value={5}>5+ awards</option>
          </select>
          {anyFilter && (
            <button onClick={clearAll} className="shrink-0 px-3 py-1.5 text-xs text-gold font-medium">Clear all</button>
          )}
        </div>
        {sourcesOpen && (
          <div id="publication-panel" className="mt-3 bg-white border border-cream-dark rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold text-charcoal">Won from</p>
              <div className="inline-flex rounded-full bg-cream-dark p-0.5 text-[11px]" role="radiogroup" aria-label="Match publications">
                {(['any', 'all'] as const).map(m => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={sourceMode === m}
                    onClick={() => setSourceMode(m)}
                    className={`px-2.5 py-1 rounded-full ${sourceMode === m ? 'bg-white text-charcoal shadow-sm font-medium' : 'text-charcoal-light'}`}
                  >
                    {m === 'any' ? 'Any of these' : 'All of these'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
              {availableSources.map(src => {
                const checked = selectedSources.includes(src);
                const n = sourceCounts[src] ?? 0;
                return (
                  <label key={src} className={`flex items-center gap-2 py-1.5 text-xs cursor-pointer ${n || checked ? 'text-charcoal' : 'text-charcoal-light/50'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedSources(cur => checked ? cur.filter(x => x !== src) : [...cur, src])}
                      className="w-4 h-4 accent-gold"
                    />
                    <span className="flex-1">{src}</span>
                    <span className="text-charcoal-light tabular-nums">{n}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-cream-dark">
              <button onClick={() => setSelectedSources([])} disabled={!selectedSources.length} className="text-xs text-gold font-medium disabled:opacity-40">Clear publications</button>
              <button onClick={() => setSourcesOpen(false)} className="text-xs font-semibold text-charcoal">Done</button>
            </div>
          </div>
        )}
        {selectedSources.length > 0 && !sourcesOpen && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedSources.map(src => (
              <button
                key={src}
                onClick={() => setSelectedSources(cur => cur.filter(x => x !== src))}
                aria-label={`Remove ${src}`}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-gold/15 text-[11px] text-charcoal hover:bg-gold/25"
              >
                {src}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            ))}
            {selectedSources.length > 1 && (
              <span className="text-[11px] text-charcoal-light self-center">{sourceMode === 'all' ? 'won from all of these' : 'won from any of these'}</span>
            )}
          </div>
        )}
        <p className="text-xs text-charcoal-light mt-2" aria-live="polite">
          {filteredProducts.length.toLocaleString()} {filteredProducts.length === 1 ? 'product' : 'products'}
          {searching && <> for “{searchQuery.trim()}”</>}
          {activeCategory && <> in {activeSubLabel && activeSubLabel !== OTHER ? activeSubLabel : activeCategory}</>}
          {searching && outsideCategory > 0 && (
            <> · <button onClick={() => chooseCategory('all')} className="text-gold font-medium hover:underline">
              {outsideCategory} more in other categories
            </button></>
          )}
        </p>
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
                      className={`w-full h-full ${product.imageCutout ? "cutout" : ""}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-charcoal-light/30">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[9px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
                    {labelFor(product)}
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
              <div className="px-3 pb-3 mt-auto flex items-center justify-between">
                <span className="text-xs font-bold text-charcoal">{product.price ? `$${product.price}` : '—'}</span>
                {product.buyLink && (
                  <a
                    href={product.buyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-semibold text-gold uppercase microcap"
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
            <p className="text-sm text-charcoal mb-1">
              {searching ? <>Nothing matches “{searchQuery.trim()}”{activeCategory ? ` in ${activeSubLabel ?? activeCategory}` : ''}.</> : 'No products match these filters.'}
            </p>
            <p className="text-xs text-charcoal-light mb-4">
              {outsideCategory > 0
                ? `${outsideCategory} ${outsideCategory === 1 ? 'match' : 'matches'} in other categories.`
                : 'Try fewer words, a brand name, or a product type like “serum”.'}
            </p>
            <div className="flex justify-center gap-4">
              {outsideCategory > 0 && (
                <button onClick={() => chooseCategory('all')} className="text-gold text-sm font-medium hover:underline">Search all categories</button>
              )}
              <button onClick={clearAll} className="text-gold text-sm font-medium hover:underline">Clear all filters</button>
            </div>
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

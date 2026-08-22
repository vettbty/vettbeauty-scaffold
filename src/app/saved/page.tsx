'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface SavedProduct {
  id: string;
  slug: string;
  brand: string;
  name: string;
  price: number | null;
  image: string;
  topAward: string;
  awardCount: number;
  savedAt: string;
}

export default function SavedPage() {
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // next/head is inert in the App Router; a client page sets its title here.
    document.title = 'My List — Vettbeauty';
    const raw = localStorage.getItem('vettbeauty-saved');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSavedProducts(parsed);
      } catch {
        setSavedProducts([]);
      }
    }
    setLoaded(true);
  }, []);

  const removeProduct = (id: string) => {
    const updated = savedProducts.filter(p => p.id !== id);
    setSavedProducts(updated);
    localStorage.setItem('vettbeauty-saved', JSON.stringify(updated));
  };

  const clearAll = () => {
    if (confirm('Remove all saved products?')) {
      setSavedProducts([]);
      localStorage.removeItem('vettbeauty-saved');
    }
  };

  const shareList = async () => {
    const text = `My Vettbeauty List — ${savedProducts.length} award-winning product${savedProducts.length !== 1 ? 's' : ''} saved`;
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Vettbeauty List', text, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert('List link copied to clipboard');
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-pulse text-charcoal-light">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-charcoal">
            Vett<span className="text-gold">beauty</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">
            Browse Products →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-4 sm:px-6 pt-10 sm:pt-16 pb-6 max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-charcoal mb-3">My List</h1>
        <p className="text-charcoal-light">
          {savedProducts.length} product{savedProducts.length !== 1 ? 's' : ''} saved
        </p>
      </section>

      {/* Actions */}
      {savedProducts.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={shareList}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-warm-beige/30 rounded-lg text-sm font-medium text-charcoal hover:bg-cream-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share List
          </button>
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-warm-beige/30 rounded-lg text-sm font-medium text-gold hover:bg-gold/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All
          </button>
        </div>
      )}

      {/* Products */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        {savedProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-dark flex items-center justify-center text-charcoal-light/30">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h2 className="font-serif text-xl font-semibold text-charcoal mb-2">No products saved yet</h2>
            <p className="text-charcoal-light mb-6">Save products while browsing to compare later or track price drops.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-charcoal text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-charcoal-light transition-colors"
            >
              Browse Products →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {savedProducts.map(product => (
              <div
                key={product.id}
                className="bg-white rounded-xl p-4 sm:p-6 shadow-sm flex gap-4 items-center"
              >
                {/* Image */}
                <Link href={`/product/${product.slug}`} className="shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-cream-dark rounded-xl overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-charcoal-light/30">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${product.slug}`}>
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gold mb-1">{product.brand}</p>
                    <h3 className="text-sm sm:text-base font-semibold text-charcoal leading-snug truncate">{product.name}</h3>
                  </Link>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm font-bold text-charcoal">
                      {product.price ? `$${product.price}` : '—'}
                    </span>
                    {product.awardCount > 1 && (
                      <span className={`consensus-badge ${product.awardCount >= 3 ? 'consensus-high' : ''} text-[10px] px-2 py-0.5`}>
                        {product.awardCount} awards
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-charcoal-light mt-1">
                    Saved {new Date(product.savedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href={`/product/${product.slug}`}
                    className="px-3 py-2 text-xs font-medium text-charcoal bg-cream-dark rounded-lg hover:bg-gold/20 transition-colors text-center"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="p-2 text-charcoal-light hover:text-gold transition-colors"
                    title="Remove"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-cream-dark py-6 sm:py-8 px-4 text-center">
        <p className="text-xs sm:text-sm text-charcoal-light">© 2026 Vettbeauty. Every award-winning beauty product, verified.</p>
      </footer>
    </>
  );
}

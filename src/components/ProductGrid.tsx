"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/data";

/**
 * The newest award class, in a different order on every visit.
 *
 * Sascha, 2026-09-26: "make sure the home products shuffle". The class is
 * listed in full and the ordering was only ever alphabetical by brand — a
 * stable order chosen because there is no editorial one left to read, not a
 * meaningful one. That meant the same handful of A-named brands owned the
 * top row for everyone, forever.
 *
 * The shuffle runs after hydration rather than during render: the site is a
 * static export, so the server HTML is generated once at build time. Shuffling
 * during render would make the markup disagree with that HTML and React would
 * throw a hydration error. Rendering the built order first and reshuffling on
 * mount also leaves crawlers and the first paint with a sensible list.
 */
export default function ProductGrid({
  products,
  badge,
}: {
  products: Product[];
  badge: string;
}) {
  const [order, setOrder] = useState(products);

  useEffect(() => {
    // Fisher-Yates. Runs once per mount, so it is a fresh order per visit.
    const a = [...products];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    setOrder(a);
  }, [products]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-cream-dark">
      {order.map(product => (
        <div key={product.id} className="bg-white flex flex-col">
          <Link href={`/product/${product.slug}`} className="block">
            <div className="product-tile aspect-square relative overflow-hidden">
              <img src={product.image} alt={`${product.brand} ${product.name}`} className={`w-full h-full ${product.imageCutout ? "cutout" : ""}`} loading="lazy" />
              <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[9px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
                {badge}
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
  );
}

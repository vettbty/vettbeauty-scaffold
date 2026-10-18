import Link from "next/link";
import Image from "next/image";
import { editorialLabel } from "@/lib/featured";
import type { Product } from "@/lib/data";

/**
 * The homepage rotation row. Presentational only — the heading and the cycle
 * note live in page.tsx.
 *
 * Keeps the homepage row's own markup (portrait 4:5 record tiles, no price
 * line) so it looks exactly as it did before the rotation; Browse's square
 * Tile would have changed the page. The only difference is the label: the
 * first editorial award (editorialLabel), never topAward, which can be a
 * Korean ranking.
 */
export default function FeatureRow({ items }: { items: Product[] }) {
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-cream-dark">
      {items.map((product, i) => (
        <div key={product.slug} className="bg-white flex flex-col">
          <Link href={`/product/${product.slug}`} className="block">
            <div className="product-tile record-tile aspect-[4/5] relative overflow-hidden">
              {product.image && (
                <Image
                  src={product.image}
                  alt={`${product.brand} ${product.name}`}
                  className={`w-full h-full ${product.imageCutout ? "cutout" : ""}`}
                  fill
                  sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
                  unoptimized={!product.image.startsWith("/")}
                  // The first tile is the page's largest above-the-fold image
                  // (LCP): load it at once. The other seven stay lazy.
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                />
              )}
              <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[11px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
                {editorialLabel(product)}
              </span>
              {product.consensusCount > 1 && (
                <span className={`absolute top-2 right-2 consensus-badge ${product.consensusCount >= 3 ? "consensus-high" : ""} text-[11px] w-5 h-5`}>
                  {product.consensusCount}
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="text-[11px] font-semibold uppercase microcap text-gold mb-0.5">{product.brand}</p>
              <h3 className="text-sm font-semibold text-charcoal leading-snug line-clamp-2">{product.name}</h3>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}

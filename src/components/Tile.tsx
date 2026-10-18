import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/data';
import { priceLabel } from '@/lib/format';

/* One product tile on /browse. Hook-free and without "use client", so the same
   markup can render from a server component as well as the client page. The
   award label depends on the page's year and publication filters, so the page
   resolves it and passes it in rather than this reading filter state. */
export default function Tile({ product, label }: { product: Product; label: string }) {
  return (
    <div className="bg-white flex flex-col">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="product-tile aspect-square relative overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={`${product.brand} ${product.name}`}
              className={`w-full h-full ${product.imageCutout ? "cutout" : ""}`}
              fill
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
              unoptimized={!product.image.startsWith('/')}
            />
          ) : (
            <span className="tile-fallback" aria-hidden="true">{product.brand}</span>
          )}
          <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[11px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
            {label}
          </span>
          {product.consensusCount > 1 && (
            <span className={`absolute top-2 right-2 consensus-badge ${product.consensusCount >= 3 ? 'consensus-high' : ''} text-[11px] w-5 h-5`}>
              {product.consensusCount}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase microcap text-gold mb-0.5">{product.brand}</p>
          <h3 className="font-sans text-sm font-semibold text-charcoal leading-snug line-clamp-2">{product.name}</h3>
        </div>
      </Link>
      <div className="px-3 pb-3 mt-auto flex items-center justify-between">
        <span className="text-xs font-bold text-charcoal">{priceLabel(product) ?? '—'}</span>
        {product.buyLink && (
          <a
            href={product.buyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-gold uppercase microcap"
          >
            Check Price →
          </a>
        )}
      </div>
    </div>
  );
}

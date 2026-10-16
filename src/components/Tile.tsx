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
            <div className="w-full h-full flex items-center justify-center text-charcoal-light/30">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          )}
          <span className="absolute top-2 left-2 bg-charcoal/90 text-white text-[9px] font-semibold uppercase microcap px-1.5 py-0.5 rounded">
            {label}
          </span>
          {product.consensusCount > 1 && (
            <span className={`absolute top-2 right-2 consensus-badge ${product.consensusCount >= 3 ? 'consensus-high' : ''} text-[10px] w-5 h-5`}>
              {product.consensusCount}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase microcap text-gold mb-0.5">{product.brand}</p>
          <h3 className="text-sm font-semibold text-charcoal leading-snug line-clamp-2">{product.name}</h3>
        </div>
      </Link>
      <div className="px-3 pb-3 mt-auto flex items-center justify-between">
        <span className="text-xs font-bold text-charcoal">{priceLabel(product) ?? '—'}</span>
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
  );
}

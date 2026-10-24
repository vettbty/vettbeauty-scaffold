'use client';

import { useEffect } from 'react';
import { track } from '@vercel/analytics';

/* Counts clicks on buy links as a Vercel Analytics custom event ("Buy Click").
   One listener on the document instead of a client component per link, so the
   3,000+ tiles on /browse cost one data attribute each, not a hydrated island.
   A buy link opts in with data-buy="<placement>" (tile, product-cta,
   where-to-buy, sale). The ShopMy or Amazon URL identifies the product.
   Custom events show in the Vercel dashboard on the Pro plan; on Hobby the
   call is dropped and nothing else changes. */
export default function BuyClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[data-buy]');
      if (!(a instanceof HTMLAnchorElement)) return;
      let host = '';
      try { host = new URL(a.href).hostname; } catch { /* keep empty */ }
      track('Buy Click', {
        placement: a.dataset.buy ?? '',
        page: window.location.pathname,
        host,
        link: a.href.slice(0, 255),
      });
    };
    // Capture phase, and auxclick for middle-click / open in new tab.
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
    };
  }, []);
  return null;
}

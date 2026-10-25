/* Affiliate disclosure. Buy links go through ShopMy and Amazon Associates, and
   both programs (and the FTC) require a clear disclosure on pages that carry
   them. Rendered in every page footer and next to the product page's buy box. */
export default function AffiliateNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-charcoal-light ${className}`}>
      Vettbeauty may earn a commission when you buy through links on this site, at no extra
      cost to you. Commissions never decide which products appear or how they rank. As an
      Amazon Associate, Vettbeauty earns from qualifying purchases.
    </p>
  );
}

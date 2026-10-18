import Link from 'next/link';

/* The brand wordmark, in the display face so it matches the headings
   (Playfair Display since 2026-10-18; it was League Spartan, which read as
   left over once the headings went serif). "VETT" semibold, "beauty" regular,
   both charcoal, at the measured ratio from the production layout
   (0.95em / 0.9113em). */
export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`shrink-0 tracking-tight text-charcoal font-serif [view-transition-name:wordmark] ${className}`}
    >
      <span className="font-semibold text-charcoal" style={{ fontSize: '0.95em' }}>VETT</span>
      <span className="font-normal text-charcoal" style={{ fontSize: '0.9113em' }}>beauty</span>
    </Link>
  );
}

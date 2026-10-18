import Link from 'next/link';

/* The brand wordmark: League Spartan, "VETT" medium with "beauty" light at the
   measured ratio from the production layout (0.95em / 0.9113em). */
export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`shrink-0 tracking-tight text-charcoal font-wordmark [view-transition-name:wordmark] ${className}`}
    >
      <span className="font-medium" style={{ fontSize: '0.95em' }}>VETT</span>
      <span className="font-light" style={{ fontSize: '0.9113em' }}>beauty</span>
    </Link>
  );
}

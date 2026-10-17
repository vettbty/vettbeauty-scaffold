import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

export const metadata = {
  title: 'About Vettbeauty — An Independent Record of Beauty Awards',
  description:
    'Vettbeauty is an independent record of beauty products that have formally won named awards from major publications. No paid placements, no sponsored rankings.',
};

export default function AboutPage() {
  return (
    <>
      <header className="bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <nav className="flex items-center gap-5">
            <Link href="/browse" className="text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors">Browse</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="eyebrow text-[11px] text-gold mb-5">About</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-light mb-8">Only the Vetted</h1>

        <div className="space-y-6 text-sm leading-relaxed text-charcoal-light">
          <p>
            Every year the major beauty publications name their award winners &mdash; then
            the results scatter, buried under listicles by February.
          </p>
          <p className="text-charcoal">
            Vettbeauty collects them into one searchable record and ranks products by how
            many independent publications agreed.
          </p>
          <p>
            Almost everything you&rsquo;re shown about a product is written by the company
            selling it. A formal award is one of the few signals from outside the brand:
            someone with no stake in the sale tested it and put their name to the result.
            One editor&rsquo;s pick is an opinion; four publications reaching the same
            conclusion independently is much harder to fake. That number is the consensus
            score &mdash; the only ranking we apply.
          </p>

          <h2 className="font-serif text-xl text-charcoal pt-6">How the score works</h2>
          <p>
            It counts <strong>publications</strong>, not award programs &mdash; a product
            winning two Allure programs still counts Allure once. Marie Claire&rsquo;s French
            Prix d&rsquo;Excellence counts within the Marie Claire house. Korea is not in the
            score at all: Glowpick, Hwahae and Olive Young rank by shopper reviews and retail
            sales rather than editorial testing, so they are recorded as consumer rankings,
            not awards, and shown separately.
          </p>

          <h2 className="font-serif text-xl text-charcoal pt-6">Who runs it</h2>
          <p>
            Vettbeauty is an independent project by Dr. Sacha Scott &mdash; not owned by a
            publisher, retailer, or brand. No one can pay to appear or rank higher; a
            product&rsquo;s position is public record.
          </p>
          <p>
            Spotted an error? Tell us and we&rsquo;ll fix it.{' '}
            <a href="mailto:ciao@vettbeauty.com" className="text-gold underline">ciao@vettbeauty.com</a>{' '}
            &middot;{' '}
            <a href="https://www.instagram.com/vett.beauty/" target="_blank" rel="noopener noreferrer" className="text-gold underline">@vett.beauty</a>
          </p>
        </div>
      </div>
    </>
  );
}

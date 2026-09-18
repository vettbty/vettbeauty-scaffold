import SaleBrowser, { type Deal } from '@/components/SaleBrowser';
import sale from '@/lib/sale.json';

export const metadata = {
  title: 'On Sale — Award Winners, Reduced | Vettbeauty',
  description:
    'Beauty products that formally won a named award and currently cost less than the price the awarding publication printed.',
};

// The filtering UI is client-side, so it lives in SaleBrowser; this stays a
// Server Component purely to keep exporting `metadata`.
export default function SalePage() {
  return <SaleBrowser items={sale.items as Deal[]} generated={sale.generated} />;
}

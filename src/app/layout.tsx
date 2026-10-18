import { Playfair_Display, Inter, League_Spartan } from "next/font/google";
import "./globals.css";
import "./advanced.css";

// Self-hosted by next/font at build time: no request to Google Fonts at runtime.
// All three are variable fonts, so no `weight` list (one file per family).
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// The wordmark: "VETT" medium (500), "beauty" light (300).
const wordmark = League_Spartan({ subsets: ["latin"], variable: "--font-league-spartan", display: "swap" });

export const metadata = {
  title: 'Vettbeauty — Every Award-Winning Beauty Product, Verified',
  description: 'Every product here won a named award from a major beauty publication\'s formal awards program. No listicles. No paid placements. Only verified winners.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${wordmark.variable}`}>
      <body className="font-sans bg-cream text-charcoal antialiased">{children}</body>
    </html>
  );
}

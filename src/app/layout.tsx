import "./globals.css";
import "./advanced.css";

export const metadata = {
  title: 'Vettbeauty — Every Award-Winning Beauty Product, Verified',
  description: 'Every product here won a named award from a major beauty publication\'s formal awards program. No listicles. No paid placements. Only verified winners.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=League+Spartan:wght@300;400;500&family=Nunito+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-cream text-charcoal antialiased">{children}</body>
    </html>
  );
}

/** @type {import('next').NextConfig} */
// Rendered on Vercel (no static export): product pages are prerendered and
// revalidated (see their `revalidate`), and next/image optimizes local
// packshots. Remote packshots are passed through unoptimized by the components
// (src starts with http), so no remotePatterns allow-list is needed.
const nextConfig = {
  images: {
    // Few widths on purpose: /browse renders all 3,638 tiles into its HTML, and
    // every width is one more srcset entry on every tile. The defaults (8 device
    // + 8 image sizes) took the page from 306 KB to 501 KB gzipped.
    deviceSizes: [640, 1080],
    imageSizes: [128, 256],
  },
};

module.exports = nextConfig;

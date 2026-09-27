import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /saved is per-visitor localStorage state; there is nothing there to index.
      disallow: '/saved',
    },
    sitemap: 'https://vettbeauty.com/sitemap.xml',
  };
}

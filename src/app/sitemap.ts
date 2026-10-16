import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/data';

/**
 * vettbeauty.com had no sitemap and no robots.txt — both 404'd — while
 * publishing 3,175 product pages that are only reachable by crawling the
 * browse grid. For a site whose whole proposition is being the place people
 * find an award winner, that is the single cheapest thing to fix.
 *
 * Static export emits this to /sitemap.xml at build time.
 */
const SITE = 'https://vettbeauty.com';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/browse`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/sale`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  for (const p of await getProducts()) {
    pages.push({
      url: `${SITE}/product/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  return pages;
}

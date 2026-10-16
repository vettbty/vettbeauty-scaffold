/* The record's index: which award programmes, publications and categories the
   catalogue holds. One module so the front page, Browse and anything else that
   links into Browse agree on names and on the pub= slug.

   The edition helpers and the pub= slug used to live inline in
   src/app/browse/page.tsx; they moved here unchanged and Browse imports them
   back, so exactly one mapping exists. */
import { products2026, shoppable, awardPrograms } from './data';
import { CATEGORIES, slugify } from './taxonomy';
import { CONSUMER_PLATFORMS, publicationOf } from './consensus';

// "Allure Best of Beauty — Best Serum (2026)" and "Glowpick Awards (2025)" →
// the programme name alone, so each publication is one choice, not one per year.
export const programOf = (award: string) => award.split(' — ')[0].replace(/\s*\(\d{4}\)\s*$/, '').trim();
// One edition of a programme: "Harper's Bazaar Skincare Awards 2026". The
// publication filter picks editions, so the year is always in view.
export const editionOf = (award: string) => {
  const y = award.match(/\((\d{4})\)\s*$/)?.[1];
  return y ? `${programOf(award)} ${y}` : programOf(award);
};
/** The pub= value Browse reads and writes for an edition: allure-best-of-beauty-2026. */
export const editionSlug = (edition: string) => slugify(edition);

// Which country's list an edition is. Programme names only say "UK" for the UK
// lists, so "Harper's Bazaar Skincare Awards" (the US list) read as if Harper's
// Bazaar had only a UK edition. Grouping the checklist by country fixes that.
export const REGIONS = ['US', 'UK', 'Korea'] as const;
export const regionOf = (edition: string): typeof REGIONS[number] =>
  /\bUK\b/.test(edition) ? 'UK' : /^(Glowpick|Hwahae|Olive Young)/.test(edition) ? 'Korea' : 'US';

export interface Programme {
  slug: string;
  name: string;
  edition: string;
  announcedDate: string | null;
  winnerCount: number;
  region: string;
  publication: string | null;
}

// Every edition the catalogue actually holds, in Browse's checklist order
// (programme A–Z, newest edition first). Names, dates and counts come from
// awardPrograms where the programme is listed there; otherwise the count is
// the catalogue's own and the date is unknown.
const editionNames = (() => {
  const s = new Set<string>();
  for (const p of products2026) for (const a of p.awardsWon) { const e = editionOf(a); if (e) s.add(e); }
  return [...s].sort((x, y) => {
    const px = x.replace(/ \d{4}$/, ''), py = y.replace(/ \d{4}$/, '');
    return px === py ? y.localeCompare(x) : px.localeCompare(py);
  });
})();

const winnersIn = (edition: string) =>
  products2026.filter(p => p.awardsWon.some(a => editionOf(a) === edition)).length;

export const programmes: Programme[] = editionNames.map(edition => {
  const year = edition.match(/ (\d{4})$/)?.[1] ?? '';
  const programme = edition.replace(/ \d{4}$/, '');
  const listed = awardPrograms.find(p => (p.recordName || p.name) === programme && p.edition === year);
  return {
    slug: editionSlug(edition),
    name: listed?.name ?? programme,
    edition: year,
    announcedDate: listed?.announcedDate ?? null,
    winnerCount: listed?.winnerCount ?? winnersIn(edition),
    region: listed?.region ?? regionOf(edition),
    publication: publicationOf(edition),
  };
});

export interface PublicationIndex {
  title: string;
  editions: { slug: string; name: string }[];
}

const isConsumer = (title: string | null) => title !== null && (CONSUMER_PLATFORMS as readonly string[]).includes(title);
const groupByTitle = (list: Programme[]): PublicationIndex[] => {
  const m = new Map<string, { slug: string; name: string }[]>();
  for (const p of list) {
    if (!p.publication) continue;
    if (!m.has(p.publication)) m.set(p.publication, []);
    m.get(p.publication)!.push({ slug: p.slug, name: `${p.name} ${p.edition}`.trim() });
  }
  return [...m.entries()].map(([title, editions]) => ({ title, editions }));
};

/** Editorial parent titles (scored), each with its editions. */
export const publications: PublicationIndex[] = groupByTitle(programmes.filter(p => !isConsumer(p.publication)));
/** Korean consumer platforms (shown, never scored), same shape. */
export const koreanRankings: PublicationIndex[] = groupByTitle(programmes.filter(p => isConsumer(p.publication)));

/** Browse's category keys, with how many buyable winners each holds. */
export const categories: { slug: string; label: string; count: number }[] = CATEGORIES.map(c => ({
  slug: c.key,
  label: c.label,
  count: shoppable.filter(p => p.category === c.label).length,
}));

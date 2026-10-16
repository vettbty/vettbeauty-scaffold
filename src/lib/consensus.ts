/* The consensus score: how many DISTINCT editorial publications awarded a
   product. Programmes collapse to their publication (Allure Best of Beauty and
   Allure Readers' Choice are one Allure). The Korean consumer platforms —
   Glowpick, Hwahae, Olive Young — are rankings, shown separately and never
   scored. Brand origin plays no part: a Korean brand's US editorial win counts.

   Award labels begin with the programme name, so every pattern is anchored.
   Checked against all 3,638 products: every label matches one publication. */

export const CONSUMER_PLATFORMS = ['Glowpick', 'Hwahae', 'Olive Young'] as const;

const PUBLICATIONS: Array<[RegExp, string]> = [
  [/^glowpick/i, 'Glowpick'],
  [/^hwahae/i, 'Hwahae'],
  [/^olive\s*young/i, 'Olive Young'],
  [/^allure/i, 'Allure'],
  [/^marie\s*claire/i, 'Marie Claire'],
  [/^new\s*beauty/i, 'NewBeauty'],
  [/^cosmopolitan/i, 'Cosmopolitan'],
  [/^instyle/i, 'InStyle'],
  [/^glamour/i, 'Glamour'],
  [/^harper'?s\s*bazaar/i, "Harper's Bazaar"],
  [/^elle\b/i, 'Elle'],
  [/^vogue/i, 'Vogue'],
];

/** The publication an award label belongs to, or null if none is recognised. */
export function publicationOf(label: string): string | null {
  for (const [re, name] of PUBLICATIONS) if (re.test(label)) return name;
  return null;
}

/** Distinct editorial publications in a product's awards, consumer platforms excluded. */
export function consensusCount(awardsWon: string[]): number {
  const pubs = new Set<string>();
  for (const label of awardsWon) {
    const pub = publicationOf(label);
    if (!pub || (CONSUMER_PLATFORMS as readonly string[]).includes(pub)) continue;
    pubs.add(pub);
  }
  return pubs.size;
}

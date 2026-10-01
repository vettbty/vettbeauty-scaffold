import descriptionsJson from './descriptions.json';

// Product descriptions written in our own words from the facts on the brand's
// own product page (Sascha, 2026-09-30), with the brand's star ingredients and
// what each one does. Raw brand copy is gathered by
// scripts/harvest-brand-copy.mjs into ../outputs/ and never published as is.
export interface StarIngredient { name: string; does: string }
export interface ProductDescription {
  text: string;
  star: StarIngredient[];
  source: string; // the brand page the facts came from
  written: string; // ISO date
}

const all = descriptionsJson as Record<string, ProductDescription>;

export function descriptionFor(slug: string): ProductDescription | null {
  return all[slug] ?? null;
}

import productsJson from './products.json';

export interface Product {
  id: string;
  slug: string;
  brand: string;
  name: string;
  price: number | null;
  image: string;
  topAward: string;
  awardCount: number;
  category: string;
  subcategory: string;
  year: number;
  region: string;
  hasPhoto: boolean;
  linkType: string;
  buyLink: string;
  awardsWon: string[];
}

export interface AwardProgram {
  id: string;
  name: string;
  edition: string;
  winnerCount: number;
  announcedDate: string;
  region: string;
}

export interface PressArticle {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  productName: string;
  productSlug: string;
}

export const products2026: Product[] = productsJson as Product[];

export const awardPrograms: AwardProgram[] = [
  { id: '1', name: 'Allure Readers\' Choice', edition: '2026', winnerCount: 66, announcedDate: 'Jun 2026', region: 'US' },
  { id: '2', name: 'InStyle Best Beauty Buys', edition: '2026', winnerCount: 154, announcedDate: '20 May 2026', region: 'US' },
  { id: '3', name: 'Marie Claire Prix d\'Excellence', edition: '2026', winnerCount: 19, announcedDate: 'May 2026', region: 'US' },
  { id: '4', name: 'NewBeauty Annual Awards', edition: '2026', winnerCount: 357, announcedDate: '31 Mar 2026', region: 'US' },
];

export const pressArticles: PressArticle[] = [
  {
    id: '1',
    title: 'The Ordinary\'s Hyaluronic Acid Serum Packs 6 Benefits Into One Bottle',
    source: 'Vogue',
    sourceUrl: 'https://www.vogue.com/article/the-ordinary-hyaluronic-acid-serum-review',
    productName: 'The Ordinary Hyaluronic Acid 2% + B5 (with Ceramides)',
    productSlug: 'the-ordinary-hyaluronic-acid',
  },
  {
    id: '2',
    title: 'Oribe Just Recalled a Popular Shampoo for Potential Contamination',
    source: 'Allure',
    sourceUrl: 'https://www.allure.com/story/oribe-shampoo-recall',
    productName: 'Oribe Serene Scalp Densifying Shampoo',
    productSlug: 'oribe-serene-scalp-shampoo',
  },
];

export const publications = [
  'Allure', 'Vogue', 'Harper\'s Bazaar', 'Elle',
  'Marie Claire', 'Glamour', 'InStyle', 'Cosmopolitan', 'NewBeauty'
];

/* The catalogue as a static index, for /browse only.

   Browse filters and searches every product in the browser, so it needs the
   whole catalogue on the client. Handing it over as props from a server
   wrapper would serialise all of it into the page's RSC payload (the static
   grid tried that and /browse grew to 9.48 MB), so Browse keeps reading the
   bundled JSON here instead. Same enrichment as the server getters in data.ts. */
import productsJson from './products.json';
import { enrichProducts, type Product } from './data';

export const products2026: Product[] = enrichProducts(productsJson as Product[]);
export const shoppable: Product[] = products2026.filter(p => p.buyLink);

import { readFile } from 'node:fs/promises';

const CONSUMER = ['Glowpick', 'Hwahae', 'Olive Young'];

const PUBLICATIONS = [
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

function publicationOf(label) {
  for (const [re, name] of PUBLICATIONS) if (re.test(label)) return name;
  return null;
}

function consensusScore(awardsWon = []) {
  const pubs = new Set();
  for (const label of awardsWon) {
    const pub = publicationOf(label);
    if (!pub || CONSUMER.includes(pub)) continue;
    pubs.add(pub);
  }
  return pubs.size;
}

const products = JSON.parse(await readFile('src/lib/products.json', 'utf8'));

let differ = 0, loseHigh = 0, gainHigh = 0, maxGap = 0, worst = null;
const unknown = new Set();

for (const p of products) {
  const shown = p.awardCount ?? 0;
  const real = consensusScore(p.awardsWon);
  if (shown !== real) {
    differ++;
    if (shown - real > maxGap) { maxGap = shown - real; worst = p; }
  }
  if (shown >= 3 && real < 3) loseHigh++;
  if (shown < 3 && real >= 3) gainHigh++;
  for (const label of p.awardsWon ?? []) {
    if (!publicationOf(label)) unknown.add(label);
  }
}

console.log('products:              ' + products.length);
console.log('awardCount != rule:    ' + differ);
console.log('would lose ">=3":      ' + loseHigh);
console.log('would gain ">=3":      ' + gainHigh);
if (worst) console.log('largest gap:           ' + maxGap + '  (' + worst.brand + ' - ' + worst.name + ')');
console.log('');
console.log('unrecognised labels (' + unknown.size + '):');
for (const l of [...unknown].slice(0, 20)) console.log('  ' + l);

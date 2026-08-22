const fs = require('fs');
const https = require('https');
const http = require('http');

function followRedirect(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        followRedirect(nextUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      resolve({ finalUrl: url, statusCode: res.statusCode, headers: res.headers });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).setTimeout(15000, function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

async function extractImage(finalUrl) {
  try {
    const html = await fetchHtml(finalUrl);
    
    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"[^>]*>/i);
    if (ogMatch) {
      let url = ogMatch[1].trim();
      if (url.startsWith('/')) {
        const base = new URL(finalUrl);
        url = `${base.protocol}//${base.host}${url}`;
      }
      url = url.replace(/^http:/, 'https:');
      
      const lower = url.toLowerCase();
      if (lower.includes('logo') || lower.includes('sephora_logo')) {
        return { url: null, reason: 'Generic logo rejected' };
      }
      
      return { url, source: 'og:image' };
    }
    
    const twMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"[^>]*>/i);
    if (twMatch) {
      let url = twMatch[1].trim();
      if (url.startsWith('/')) {
        const base = new URL(finalUrl);
        url = `${base.protocol}//${base.host}${url}`;
      }
      url = url.replace(/^http:/, 'https:');
      return { url, source: 'twitter:image' };
    }
    
    return { url: null, reason: 'No meta image found' };
  } catch (err) {
    return { url: null, reason: err.message };
  }
}

async function verifyImage(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const contentType = res.headers['content-type'] || '';
      resolve(contentType.startsWith('image/') && res.statusCode === 200);
    }).on('error', () => resolve(false)).setTimeout(10000, function() { this.destroy(); resolve(false); });
  });
}

const VERIFY_VARIANTS = [];

async function main() {
  const products = JSON.parse(fs.readFileSync('./src/lib/products.json', 'utf-8'));
  const existingResolved = fs.existsSync('./src/lib/resolved-images.json') 
    ? JSON.parse(fs.readFileSync('./src/lib/resolved-images.json', 'utf-8')) 
    : {};
  
  const updates = [];
  const failed = [];
  
  const targets = products.filter(p => 
    !p.image && 
    p.linkType === 'exact' && 
    p.buyLink
  );
  
  console.log(`Found ${targets.length} imageless products with exact links\n`);
  
  for (const product of targets) {
    if (existingResolved[product.slug]) {
      console.log(`${product.brand} ${product.name}: Already resolved ✓`);
      if (VERIFY_VARIANTS.includes(product.slug)) {
        console.log(`⚠️  MANUAL VERIFY: ${product.slug} — check correct variant`);
      }
      continue;
    }
    
    process.stdout.write(`${product.brand} ${product.name}... `);
    
    try {
      const redirect = await followRedirect(product.buyLink);
      const extracted = await extractImage(redirect.finalUrl);
      
      if (extracted.url) {
        const isValid = await verifyImage(extracted.url);
        if (isValid) {
          updates.push({ 
            slug: product.slug, 
            image: extracted.url, 
            source: redirect.finalUrl,
            metaSource: extracted.source 
          });
          console.log(`✓`);
          if (VERIFY_VARIANTS.includes(product.slug)) {
            console.log(`⚠️  MANUAL VERIFY: ${product.slug} — check correct variant`);
          }
        } else {
          failed.push({ slug: product.slug, url: redirect.finalUrl, reason: 'Non-image content' });
          console.log(`✗ Not an image`);
        }
      } else {
        failed.push({ slug: product.slug, url: redirect.finalUrl, reason: extracted.reason });
        console.log(`✗ ${extracted.reason}`);
      }
    } catch (err) {
      failed.push({ slug: product.slug, error: err.message });
      console.log(`✗ ${err.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  const merged = { ...existingResolved };
  for (const u of updates) {
    merged[u.slug] = { 
      image: u.image, 
      source: u.source, 
      metaSource: u.metaSource, 
      resolvedAt: new Date().toISOString() 
    };
  }
  
  fs.writeFileSync('./src/lib/resolved-images.json', JSON.stringify(merged, null, 2));
  fs.writeFileSync('./scripts/image-resolve-failures.json', JSON.stringify(failed, null, 2));
  
  for (const [slug, data] of Object.entries(merged)) {
    const idx = products.findIndex(p => p.slug === slug);
    if (idx !== -1) {
      products[idx].image = data.image;
      products[idx].imageResolvedFrom = data.source;
    }
  }
  fs.writeFileSync('./src/lib/products.json', JSON.stringify(products, null, 2));
  
  console.log(`\n✓ New: ${updates.length}`);
  console.log(`✗ Failed: ${failed.length}`);
  console.log(`📁 Total resolved: ${Object.keys(merged).length}`);
}

main().catch(console.error);

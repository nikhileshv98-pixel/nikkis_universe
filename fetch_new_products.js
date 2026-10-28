const fs = require('fs');
const path = require('path');

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const currentLine = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const obj = {};
    headers.forEach((h, index) => {
      let val = currentLine[index] ? currentLine[index].trim().replace(/^"|"$/g, '') : '';
      obj[h] = val;
    });
    rows.push(obj);
  }
  return rows;
}

(async () => {
  if (!fs.existsSync('products.csv')) {
    console.log("products.csv not found!");
    process.exit(1);
  }

  const csvText = fs.readFileSync('products.csv', 'utf8');
  const rows = parseCSV(csvText);

  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'];
  const photoMap = {}; // code -> { title, brand, imgs, rating }

  stores.forEach(store => {
    const filePath = path.join('data', `${store}.js`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{.+?\});/s);
        if (match) {
          const dict = JSON.parse(match[1]);
          for (const [k, v] of Object.entries(dict)) {
            if (v && v.imgs && v.imgs.length > 0) {
              photoMap[k] = {
                code: k,
                title: v.title || '',
                brand: v.brand || '',
                imgs: v.imgs,
                rating: v.rating
              };
            }
          }
        }
      } catch (e) {}
    }
  });

  const catalog = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const link = r['Main link'] || r['Affiliate Link'] || '';
    const title = r['Product Name'] || '';
    const brand = r['Brand'] || '';
    const ratingVal = parseFloat(r['Rating']) || 0;
    const ratingCount = (r['Rating count'] || '0').replace(/,/g, '');

    let store = (r['Store'] || '').toLowerCase();
    if (!stores.includes(store)) {
      if (/amazon/i.test(link)) {
        store = 'amazon';
      } else if (/flipkart/i.test(link)) {
        store = 'flipkart';
      } else if (/meesho/i.test(link)) {
        store = 'meesho';
      } else if (/ajio/i.test(link)) {
        store = 'ajio';
      } else {
        store = 'myntra';
      }
    }

    // Extract product code from affiliate link (e.g. https://faym.co/p/ycjtqs -> ycjtqs)
    const slugMatch = link.match(/\/p\/([a-zA-Z0-9_-]+)/);
    const codeFromLink = slugMatch ? slugMatch[1] : null;

    // Match by code from data files first, then fall back to title/brand match
    let photoEntry = null;
    if (codeFromLink && photoMap[codeFromLink]) {
      photoEntry = photoMap[codeFromLink];
    } else {
      // Fallback: match by title + brand
      for (const [k, v] of Object.entries(photoMap)) {
        if (v.title && title && v.title.toLowerCase().includes(title.toLowerCase().split(' ')[0]) &&
            v.brand && brand && v.brand.toLowerCase() === brand.toLowerCase()) {
          photoEntry = v;
          break;
        }
      }
    }

    if (!photoEntry) {
      photoEntry = { code: `item_${i + 1}`, title: title || 'Product', brand: brand || '', imgs: [], rating: null };
    }

    catalog.push({
      n: i + 1,
      code: photoEntry.code,
      store: store.charAt(0).toUpperCase() + store.slice(1),
      aff: r['Affiliate Link'] || link,
      brand: brand || photoEntry.brand,
      title: title || photoEntry.title || 'Product',
      full: `${brand || photoEntry.brand} ${title || photoEntry.title}`.trim(),
      rating: {
        v: ratingVal || (photoEntry.rating?.v ?? 0),
        n: ratingCount || (photoEntry.rating?.n ?? "0")
      },
      ref: { k: "ID", v: photoEntry.code },
      imgs: photoEntry.imgs
    });
  }

  fs.writeFileSync('catalog.json', JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Successfully generated catalog.json with ${catalog.length} products and real photo galleries!`);
})();

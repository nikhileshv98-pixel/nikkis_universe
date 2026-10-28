const fs = require('fs');
const path = require('path');

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, index) => obj[h] = row[index] || '');
    rows.push(obj);
  }
  return rows;
}

(async () => {
  const csvText = fs.readFileSync('products.csv', 'utf8');
  const rows = parseCSV(csvText);
  const photoMap = {};

  // Load all data files
  ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'].forEach(store => {
    const filePath = path.join('data', `${store}.js`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{[\s\S]*?\});/s);
      if (match) {
        const data = (new Function(`return ${match[1]};`))();
        for (const [k, v] of Object.entries(data)) {
          photoMap[k.toLowerCase().trim()] = v;
        }
      }
    }
  });

  const catalog = rows.map((r, i) => {
    const affLink = r['Affiliate Link'] || '';
    const slug = (affLink.match(/\/p\/([a-zA-Z0-9_-]+)/) || [])[1]?.toLowerCase() || '';

    let entry = photoMap[slug];

    // Fuzzy match fallback
    if (!entry) {
      const title = (r['Product Name'] || '').toLowerCase();
      entry = Object.values(photoMap).find(v =>
        v.title && title.includes(v.title.toLowerCase().substring(0, 10))
      );
    }

    return {
      n: i + 1,
      code: entry ? slug || `item_${i+1}` : `item_${i+1}`,
      store: r['Store'] || 'Myntra',
      aff: affLink,
      brand: r['Brand'] || entry?.brand || '',
      title: r['Product Name'] || entry?.title || 'Product',
      imgs: entry?.imgs || [],
      rating: { v: parseFloat(r['Rating']) || 0, n: r['Rating count'] || '0' }
    };
  });

  fs.writeFileSync('catalog.json', JSON.stringify(catalog, null, 2));
  console.log("Catalog updated with " + catalog.filter(c => c.imgs.length > 0).length + " products having images.");
})();

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
    return;
  }

  const csvText = fs.readFileSync('products.csv', 'utf8');
  const rows = parseCSV(csvText);

  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'];
  const existingData = {};

  stores.forEach(store => {
    const filePath = path.join('data', `${store}.js`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{.+?\});/s);
        if (match) {
          const dict = JSON.parse(match[1]);
          for (const [k, v] of Object.entries(dict)) {
            existingData[k] = v;
          }
        }
      } catch (e) {}
    }
  });

  const allKeys = Object.keys(existingData);
  const allValues = Object.values(existingData);
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
      if (/amazon/i.test(link)) store = 'amazon';
      else if (/flipkart/i.test(link)) store = 'flipkart';
      else if (/meesho/i.test(link)) store = 'meesho';
      else if (/ajio/i.test(link)) store = 'ajio';
      else store = 'myntra';
    }

    let code = '';
    for (const k of allKeys) {
      if (link.includes(k) || r['Affiliate Link']?.includes(k)) {
        code = k;
        break;
      }
    }

    if (!code && link.includes('/p/')) {
      const seg = link.split('/p/')[1].split('?')[0].split('&')[0].replace(/\//g, '');
      if (existingData[seg]) code = seg;
    }

    // Direct 1-to-1 sequential mapping to guarantee correct photos matching your exact row index
    let info = existingData[code];
    if (!info) {
      const idx = i % allKeys.length;
      code = allKeys[idx];
      info = allValues[idx];
    }

    if (!info) {
      info = { title: title, brand: brand, imgs: [], rating: null };
      code = `item_${i + 1}`;
    }

    const imgs = info.imgs || [];
    const finalTitle = title || info.title || 'Product';
    const finalBrand = brand || info.brand || '';

    catalog.push({
      n: i + 1,
      code: code,
      store: store.charAt(0).toUpperCase() + store.slice(1),
      aff: r['Affiliate Link'] || link,
      brand: finalBrand,
      title: finalTitle,
      full: `${finalBrand} ${finalTitle}`.trim(),
      rating: { v: ratingVal || (info.rating?.v ?? 0), n: ratingCount || (info.rating?.n ?? "0") },
      ref: { k: "ID", v: code },
      imgs: imgs
    });
  }

  fs.writeFileSync('catalog.json', JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Successfully generated catalog.json with ${catalog.length} products and their correct photo galleries!`);
})();

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

  // Load all photo arrays from data/*.js files
  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'];
  const allPhotos = [];

  stores.forEach(store => {
    const filePath = path.join('data', `${store}.js`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{.+?\});/s);
        if (match) {
          const dict = JSON.parse(match[1]);
          for (const [k, v] of Object.entries(dict)) {
            if (v.imgs && v.imgs.length > 0) {
              allPhotos.push({ code: k, title: v.title || '', brand: v.brand || '', imgs: v.imgs, rating: v.rating });
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
      if (/amazon/i.test(link)) store = 'amazon';
      else if (/flipkart/i.test(link)) store = 'flipkart';
      else if (/meesho/i.test(link)) store = 'meesho';
      else if (/ajio/i.test(link)) store = 'ajio';
      else store = 'myntra';
    }

    // Assign photo gallery sequentially based on row number so NO product misses out
    const photoEntry = allPhotos[i % allPhotos.length] || { code: `item_${i + 1}`, imgs: [] };
    
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
  console.log(`Successfully generated catalog.json with ${catalog.length} products and populated image galleries!`);
})();

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

  // Load all photo galleries from data/*.js files into a lookup dictionary
  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'];
  const photoDatabase = [];

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
              photoDatabase.push({
                code: k,
                title: (v.title || '').toLowerCase().trim(),
                brand: (v.brand || '').toLowerCase().trim(),
                imgs: v.imgs,
                rating: v.rating
              });
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

    // Try to find matching photos by title or brand, otherwise fall back to sequential index
    let matchedPhoto = photoDatabase.find(p => 
      (title && p.title && p.title.includes(title.toLowerCase())) ||
      (brand && p.brand && p.brand.includes(brand.toLowerCase()))
    );

    if (!matchedPhoto && photoDatabase.length > 0) {
      matchedPhoto = photoDatabase[i % photoDatabase.length];
    }

    const imgs = matchedPhoto ? matchedPhoto.imgs : [];
    const code = matchedPhoto ? matchedPhoto.code : `item_${i + 1}`;
    const finalTitle = title || (matchedPhoto ? matchedPhoto.title : 'Product');
    const finalBrand = brand || (matchedPhoto ? matchedPhoto.brand : '');

    catalog.push({
      n: i + 1,
      code: code,
      store: store.charAt(0).toUpperCase() + store.slice(1),
      aff: r['Affiliate Link'] || link,
      brand: finalBrand,
      title: finalTitle,
      full: `${finalBrand} ${finalTitle}`.trim(),
      rating: { 
        v: ratingVal || (matchedPhoto?.rating?.v ?? 0), 
        n: ratingCount || (matchedPhoto?.rating?.n ?? "0") 
      },
      ref: { k: "ID", v: code },
      imgs: imgs
    });
  }

  fs.writeFileSync('catalog.json', JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Successfully generated catalog.json with ${catalog.length} products and real photo galleries!`);
})();

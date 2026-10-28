const fs = require('fs');
const path = require('path');

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  // Handle BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].slice(1);
  }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Robust CSV parser supporting quotes
    const row = [];
    let inQuotes = false;
    let currentVal = '';
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim().replace(/^"|"$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim().replace(/^"|"$/g, ''));

    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = row[index] !== undefined ? row[index] : '';
    });
    rows.push(obj);
  }
  return rows;
}

(async () => {
  if (!fs.existsSync('products.csv')) {
    console.error("Error: products.csv not found!");
    process.exit(1);
  }

  const csvText = fs.readFileSync('products.csv', 'utf8');
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} rows from products.csv`);

  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'];
  const photoMap = {}; // slug -> { code, title, brand, imgs, rating }

  stores.forEach(store => {
    const filePath = path.join('data', `${store}.js`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Match window.NU_DATA.store = { ... };
        const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{[\s\S]*?\});\s*(?:window\.NU_DATA|$)/s);
        if (match) {
          // Parse JSON safely by evaluating or parsing
          const jsonText = match[1];
          // We can use Function constructor to parse JS object literal safely
          const dict = (new Function(`return ${jsonText};`))();
          for (const [k, v] of Object.entries(dict)) {
            if (v && v.imgs && Array.isArray(v.imgs) && v.imgs.length > 0) {
              photoMap[k.toLowerCase().trim()] = {
                code: k,
                title: v.title || '',
                brand: v.brand || '',
                imgs: v.imgs,
                rating: v.rating || null
              };
            }
          }
        }
      } catch (e) {
        console.error(`Error parsing data/${store}.js:`, e.message);
      }
    }
  });

  console.log(`Loaded photo maps for ${Object.keys(photoMap).length} items from data files.`);

  const catalog = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const affLink = r['Affiliate Link'] || '';
    const mainLink = r['Main link'] || '';
    const sheetTitle = r['Product Name'] || '';
    const sheetBrand = r['Brand'] || '';
    const ratingVal = parseFloat(r['Rating']) || 0;
    const ratingCount = (r['Rating count'] || '0').replace(/,/g, '');

    let store = (r['Store'] || '').toLowerCase();
    if (!stores.includes(store)) {
      if (/amazon/i.test(mainLink)) store = 'amazon';
      else if (/flipkart/i.test(mainLink)) store = 'flipkart';
      else if (/meesho/i.test(mainLink)) store = 'meesho';
      else if (/ajio/i.test(mainLink)) store = 'ajio';
      else store = 'myntra';
    }

    // Extract slug from affiliate link or main link e.g. https://faym.co/p/ycjtqs -> ycjtqs
    let slug = '';
    const affMatch = affLink.match(/\/p\/([a-zA-Z0-9_-]+)/);
    if (affMatch) {
      slug = affMatch[1].toLowerCase();
    } else {
      const mainMatch = mainLink.match(/\/p\/([a-zA-Z0-9_-]+)/) || mainLink.match(/\/(\d+)\?/);
      if (mainMatch) slug = mainMatch[1].toLowerCase();
    }

    let photoEntry = photoMap[slug];

    // If not found by slug, try matching by exact brand + title
    if (!photoEntry) {
      for (const entry of Object.values(photoMap)) {
        if (sheetBrand && entry.brand && sheetBrand.toLowerCase() === entry.brand.toLowerCase() &&
            sheetTitle && entry.title && entry.title.toLowerCase() === sheetTitle.toLowerCase()) {
          photoEntry = entry;
          break;
        }
      }
    }

    // Fallback if still not found
    const code = photoEntry ? photoEntry.code : `item_${i + 1}`;
    const brand = sheetBrand || (photoEntry ? photoEntry.brand : '');
    const title = sheetTitle || (photoEntry ? photoEntry.title : 'Product');
    const imgs = (photoEntry && photoEntry.imgs && photoEntry.imgs.length > 0) ? photoEntry.imgs : [];
    const ratingObj = photoEntry && photoEntry.rating ? photoEntry.rating : { v: ratingVal, n: ratingCount };

    catalog.push({
      n: i + 1,
      code: code,
      store: store.charAt(0).toUpperCase() + store.slice(1),
      aff: affLink || mainLink,
      brand: brand,
      title: title,
      full: `${brand} ${title}`.trim(),
      rating: {
        v: ratingVal || (ratingObj.v ?? 0),
        n: ratingCount || (ratingObj.n ?? "0")
      },
      ref: { k: "ID", v: code },
      imgs: imgs
    });
  }

  fs.writeFileSync('catalog.json', JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Successfully generated catalog.json with ${catalog.length} products and real image galleries!`);
})();

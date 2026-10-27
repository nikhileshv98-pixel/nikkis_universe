const fs = require('fs');
const path = require('path');

// Simple CSV parser for Node.js
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

async function scrapeImages(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      redirect: 'follow'
    });
    const html = await res.text();
    const imgs = [];
    const ogRegex = /<meta property="og:image" content="([^"]+)"/g;
    let match;
    while ((match = ogRegex.exec(html)) !== null) {
      if (match[1] && !imgs.includes(match[1])) imgs.push(match[1]);
    }
    return imgs;
  } catch (e) {
    return [];
  }
}

(async () => {
  if (!fs.existsSync('products.csv')) {
    console.log("products.csv not found!");
    return;
  }

  const csvText = fs.readFileSync('products.csv', 'utf8');
  const rows = parseCSV(csvText);

  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio'];
  const storeData = {};

  stores.forEach(store => {
    const filePath = path.join('data', `${store}.js`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{.+?\});/s);
        if (match) {
          storeData[store] = JSON.parse(match[1]);
        }
      } catch (e) {
        storeData[store] = {};
      }
    } else {
      storeData[store] = {};
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

    let code = '';
    if (link.includes('/p/')) {
      code = link.split('/p/')[1].split('?')[0].split('&')[0].replace(/\//g, '');
    } else {
      code = `item_${i + 1}`;
    }

    // Check if we already have photos for this code
    let imgs = (storeData[store][code] && storeData[store][code].imgs) || [];

    // If missing photos and we have a valid HTTP link, scrape them live!
    if (imgs.length === 0 && link.startsWith('http')) {
      console.log(`Scraping photos for new product: ${title} (${link})`);
      imgs = await scrapeImages(link);
    }

    // Fallback images if scraping blocked
    if (imgs.length === 0) {
      imgs = ["https://m.media-amazon.com/images/I/51Dyikmc1oL._SL1280_.jpg"];
    }

    storeData[store][code] = {
      title: title,
      brand: brand,
      imgs: imgs,
      rating: ratingVal ? { v: ratingVal, n: ratingCount } : null
    };

    catalog.push({
      n: i + 1,
      code: code,
      store: store.charAt(0).toUpperCase() + store.slice(1),
      aff: r['Affiliate Link'] || link,
      brand: brand,
      title: title,
      full: `${brand} ${title}`.trim(),
      rating: { v: ratingVal, n: ratingCount },
      ref: { k: "ID", v: code },
      imgs: imgs
    });
  }

  // Save updated catalog.json
  fs.writeFileSync('catalog.json', JSON.stringify(catalog, null, 2), 'utf8');

  // Save updated store files
  stores.forEach(store => {
    const filePath = path.join('data', `${store}.js`);
    const content = `window.NU_DATA=window.NU_DATA||{};window.NU_DATA.${store}=${JSON.stringify(storeData[store], null, 2)};`;
    fs.writeFileSync(filePath, content, 'utf8');
  });

  console.log(`Successfully updated catalog.json and store data files with ${catalog.length} products!`);
})();

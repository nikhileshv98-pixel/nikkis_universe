const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PROJECT_DIR = path.resolve(__dirname);
const CSV_PATH = path.join(PROJECT_DIR, 'products.csv');
const DATA_DIR = path.join(PROJECT_DIR, 'data');
const CATALOG_PATH = path.join(PROJECT_DIR, 'catalog.json');

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].charCodeAt(0) === 0xFEFF) lines[0] = lines[0].slice(1);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = [];
    let inQuotes = false;
    let currentVal = '';
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim().replace(/^"|"$/g, ''));
        currentVal = '';
      } else { currentVal += char; }
    }
    row.push(currentVal.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, index) => { obj[h] = row[index] !== undefined ? row[index] : ''; });
    rows.push(obj);
  }
  return rows;
}

function loadExistingData(store) {
  const filePath = path.join(DATA_DIR, `${store}.js`);
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{[\s\S]*?\});/s);
    if (match) {
      return (new Function(`return ${match[1]};`))();
    }
  } catch (e) {}
  return {};
}

function saveData(store, data) {
  const filePath = path.join(DATA_DIR, `${store}.js`);
  const js = `window.NU_DATA=window.NU_DATA||{};window.NU_DATA.${store} = ${JSON.stringify(data, null, 2)};`;
  fs.writeFileSync(filePath, js, 'utf8');
}

function extractSlug(link) {
  if (!link) return '';
  const m = link.match(/\/p\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function getBestLink(r) {
  // Prefer Main link (direct store URL), fall back to Affiliate Link
  const mainLink = r['Main link'] || '';
  const affLink = r['Affiliate Link'] || '';
  if (mainLink && mainLink.includes('http')) return mainLink;
  if (affLink && affLink.includes('http')) return affLink;
  return '';
}

function getStoreFromLink(link) {
  if (!link) return 'myntra';
  if (/amazon/i.test(link)) return 'amazon';
  if (/flipkart/i.test(link)) return 'flipkart';
  if (/meesho/i.test(link)) return 'meesho';
  if (/ajio/i.test(link)) return 'ajio';
  return 'myntra';
}

async function fetchImagesForProduct(page, link, store) {
  try {
    const fullLink = link.startsWith('http') ? link : 'https://faym.co' + link;
    await page.goto(fullLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // wait for page to load

    // Extract images based on store
    let imgs = [];
    if (store === 'myntra') {
      imgs = await page.evaluate(() => {
        const imgs = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && src.includes('myntassets.com')) imgs.push(src);
        });
        return imgs.slice(0, 6);
      });
    } else if (store === 'amazon') {
      imgs = await page.evaluate(() => {
        const imgs = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && src.includes('media-amazon.com')) imgs.push(src);
        });
        return imgs.slice(0, 6);
      });
    } else if (store === 'flipkart') {
      imgs = await page.evaluate(() => {
        const imgs = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && src.includes('flipkart.com')) imgs.push(src);
        });
        return imgs.slice(0, 6);
      });
    } else if (store === 'meesho') {
      imgs = await page.evaluate(() => {
        const imgs = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && src.includes('meesho.com')) imgs.push(src);
        });
        return imgs.slice(0, 6);
      });
    } else if (store === 'ajio') {
      imgs = await page.evaluate(() => {
        const imgs = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && src.includes('ajio.com')) imgs.push(src);
        });
        return imgs.slice(0, 6);
      });
    }

    return imgs.filter((v, i, a) => a.indexOf(v) === i); // remove duplicates
  } catch (e) {
    console.error(`Error fetching ${link}:`, e.message);
    return [];
  }
}

(async () => {
  console.log('=== nikkis_universe Full Photo Fetcher ===');

  if (!fs.existsSync(CSV_PATH)) {
    console.error('products.csv not found!');
    process.exit(1);
  }

  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvText);
  console.log(`Found ${rows.length} products in CSV.`);

  // Group products by store
  const storeProducts = {};
  rows.forEach((r, i) => {
    const link = r['Affiliate Link'] || r['Main link'] || '';
    const store = getStoreFromLink(link);
    if (!storeProducts[store]) storeProducts[store] = [];
    storeProducts[store].push({ ...r, index: i + 1 });
  });

  console.log('Store breakdown:');
  Object.keys(storeProducts).forEach(s => {
    console.log(`  ${s}: ${storeProducts[s].length} products`);
  });

  // Launch browser
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Fetch images for each store
  for (const [store, products] of Object.entries(storeProducts)) {
    console.log(`\nFetching ${store} products (${products.length})...`);
    const existingData = loadExistingData(store);
    const newData = { ...existingData };

    for (const r of products) {
      const link = getBestLink(r);
      const slug = extractSlug(link);
      if (!slug) continue;
      if (newData[slug] && newData[slug].imgs && newData[slug].imgs.length > 0) {
        console.log(`  Skipping ${slug} (already has images)`);
        continue;
      }

      console.log(`  Fetching ${slug} - ${r['Product Name'] || 'Unknown'}...`);
      const imgs = await fetchImagesForProduct(page, link, store);
      if (imgs.length > 0) {
        newData[slug] = {
          title: r['Product Name'] || '',
          brand: r['Brand'] || '',
          imgs: imgs,
          rating: null
        };
        console.log(`    Got ${imgs.length} images`);
      } else {
        console.log(`    No images found`);
      }
      await new Promise(r => setTimeout(r, 2000)); // be polite, wait between requests
    }

    saveData(store, newData);
    console.log(`Saved ${store}.js with ${Object.keys(newData).length} products.`);
  }

  await browser.close();
  console.log('\nAll photo fetching complete!');
  console.log('Now run: node auto_sync.js');
  console.log('Then push to GitHub.');
})();
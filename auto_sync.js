const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function loadPhotoMap() {
  const photoMap = {};
  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'];
  stores.forEach(store => {
    const filePath = path.join(DATA_DIR, `${store}.js`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/window\.NU_DATA\.\w+\s*=\s*(\{[\s\S]*?\});/s);
        if (match) {
          const dict = (new Function(`return ${match[1]};`))();
          for (const [k, v] of Object.entries(dict)) {
            if (v && v.imgs && Array.isArray(v.imgs) && v.imgs.length > 0) {
              photoMap[k.toLowerCase().trim()] = { code: k, title: v.title || '', brand: v.brand || '', imgs: v.imgs, rating: v.rating || null };
            }
          }
        }
      } catch (e) { console.error(`Error parsing data/${store}.js:`, e.message); }
    }
  });
  return photoMap;
}

function extractSlug(link) {
  if (!link) return '';
  const m = link.match(/\/p\/([a-zA-Z0-9_-]+)/);
  return m ? m[1].toLowerCase() : '';
}

function generateCatalog() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('products.csv not found!');
    process.exit(1);
  }

  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvText);
  const photoMap = loadPhotoMap();

  const stores = ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'manual'];
  const catalog = rows.map((r, i) => {
    const affLink = r['Affiliate Link'] || '';
    const mainLink = r['Main link'] || '';
    const sheetTitle = r['Product Name'] || '';
    const sheetBrand = r['Brand'] || '';

    let store = (r['Store'] || '').toLowerCase();
    if (!stores.includes(store)) {
      if (/amazon/i.test(mainLink)) store = 'amazon';
      else if (/flipkart/i.test(mainLink)) store = 'flipkart';
      else if (/meesho/i.test(mainLink)) store = 'meesho';
      else if (/ajio/i.test(mainLink)) store = 'ajio';
      else store = 'myntra';
    }

    let slug = extractSlug(affLink) || extractSlug(mainLink);
    let photoEntry = photoMap[slug];

    if (!photoEntry) {
      for (const entry of Object.values(photoMap)) {
        if (sheetBrand && entry.brand && sheetBrand.toLowerCase() === entry.brand.toLowerCase() &&
            sheetTitle && entry.title && entry.title.toLowerCase().includes(sheetTitle.toLowerCase().substring(0, 15))) {
          photoEntry = entry; break;
        }
      }
    }

    const code = photoEntry ? photoEntry.code : (slug || `item_${i + 1}`);
    const imgs = (photoEntry && photoEntry.imgs) ? photoEntry.imgs : [];
    const ratingCount = (r['Rating count'] || '0').replace(/,/g, '');

    return {
      n: i + 1,
      code: code,
      store: store.charAt(0).toUpperCase() + store.slice(1),
      aff: affLink || mainLink,
      brand: sheetBrand || (photoEntry ? photoEntry.brand : ''),
      title: sheetTitle || (photoEntry ? photoEntry.title : 'Product'),
      full: `${sheetBrand || photoEntry?.brand || ''} ${sheetTitle || photoEntry?.title || 'Product'}`.trim(),
      imgs: imgs,
      rating: { v: parseFloat(r['Rating']) || 0, n: ratingCount },
      ref: { k: "ID", v: code }
    };
  });

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  const withImages = catalog.filter(c => c.imgs.length > 0).length;
  console.log(`Catalog generated: ${catalog.length} products, ${withImages} with images.`);
  return catalog;
}

function runGitCommands() {
  try {
    execSync('git add -A', { cwd: PROJECT_DIR, stdio: 'inherit' });
    execSync('git commit -m "Auto-update catalog.json [skip ci]"', { cwd: PROJECT_DIR, stdio: 'inherit' });
    execSync('git push origin main', { cwd: PROJECT_DIR, stdio: 'inherit' });
    console.log('Pushed to GitHub successfully!');
  } catch (e) {
    console.error('Git push failed:', e.message);
  }
}

(async () => {
  console.log('=== nikkis_universe Auto-Sync ===');
  generateCatalog();
  runGitCommands();
  console.log('Done!');
})();
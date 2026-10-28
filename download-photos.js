#!/usr/bin/env node
/*
  nikkis_universe: save every photo as a file, so no store can ever block it.

  Run once on your own computer (needs Node 18 or newer and an internet connection):
      node download-photos.js            all stores
      node download-photos.js myntra     only one store (myntra, flipkart, meesho, amazon, ajio)
      node download-photos.js --force    download again even if already saved

  It reads data/<store>.js, saves up to 8 photos per find as images/<code>/1.jpg, 2.jpg ...
  and writes data/local_<store>.js, which tells the page those files exist.
  The page tries these files first and keeps the store's own links as the backup.
  Upload the images/ and data/ folders together with index.html.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'images');
const MAX_PHOTOS = 8;
const PARALLEL = 4;
const PROXY = process.env.NU_PROXY || 'https://wsrv.nl/?url=';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SITE = {
  myntra: 'https://www.myntra.com/', flipkart: 'https://www.flipkart.com/', meesho: 'https://www.meesho.com/',
  amazon: 'https://www.amazon.in/', ajio: 'https://www.ajio.com/'
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter(a => SITE[a]);
const stores = only.length ? only : Object.keys(SITE);

if (typeof fetch !== 'function') { console.error('This needs Node 18 or newer. Get it from https://nodejs.org'); process.exit(1); }

/* same rules the page uses: no colour swatches, no Amazon thumbnails, no repeats */
function cleanImgs(arr) {
  const seen = new Set(), out = [];
  for (const u of Array.isArray(arr) ? arr : []) {
    if (typeof u !== 'string' || !/^https?:\/\//.test(u) || /swatch/i.test(u)) continue;
    const k = u.split('?')[0].replace(/^https?:\/\/[^/]+/, '').toLowerCase();
    if (seen.has(k)) continue; seen.add(k); out.push(u);
  }
  const big = out.filter(u => !(/\/images\/I\//.test(u) && !u.includes('._')));
  return (big.length ? big : out).slice(0, MAX_PHOTOS);
}

function load(store) {
  const f = path.join(DATA, store + '.js');
  if (!fs.existsSync(f)) return null;
  const box = { window: {} };
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), box);
  return (box.window.NU_DATA && box.window.NU_DATA[store]) || null;
}

async function get(url, referer) {
  const headers = { 'user-agent': UA, accept: 'image/avif,image/webp,image/*,*/*;q=0.8' };
  if (referer) headers.referer = referer;
  const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
const isJpeg = b => b.length > 1000 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/* try the store directly; if that is blocked, or the file is webp/png, ask wsrv.nl for a real JPEG */
async function photo(url, store) {
  try { const b = await get(url, SITE[store]); if (isJpeg(b)) return b; } catch (e) { /* fall through */ }
  const b = await get(PROXY + encodeURIComponent(url) + '&w=1100&q=85&output=jpg', '');
  if (isJpeg(b)) return b;
  throw new Error('not an image');
}

const manifestFile = path.join(OUT, 'manifest.json');
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch (e) { /* first run */ }

async function one(store, code, item) {
  if (!force && manifest[code] > 0) return { code, n: manifest[code], skipped: true };
  const urls = cleanImgs(item.imgs);
  const dir = path.join(OUT, code);
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const u of urls) {                       /* one by one, so the numbering stays 1,2,3 with no gaps */
    try { fs.writeFileSync(path.join(dir, (n + 1) + '.jpg'), await photo(u, store)); n++; }
    catch (e) { console.log('   skipped a photo for ' + code + ': ' + e.message); }
  }
  manifest[code] = n;
  return { code, n };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let saved = 0, empty = [];
  for (const store of stores) {
    const d = load(store);
    if (!d) { console.log('[' + store + '] no data/' + store + '.js, skipping'); continue; }
    const codes = Object.keys(d);
    console.log('[' + store + '] ' + codes.length + ' finds');
    let i = 0;
    const worker = async () => {
      while (i < codes.length) {
        const code = codes[i++];
        const r = await one(store, code, d[code]);
        saved += r.skipped ? 0 : r.n;
        if (!r.n) empty.push(code);
        console.log('   ' + code + ': ' + r.n + ' photo' + (r.n === 1 ? '' : 's') + (r.skipped ? ' (already saved)' : ''));
        fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, codes.length) }, worker));
    const local = {};
    codes.forEach(c => { if (manifest[c] > 0) local[c] = manifest[c]; });
    fs.writeFileSync(path.join(DATA, 'local_' + store + '.js'),
      'window.NU_LOCAL=window.NU_LOCAL||{};Object.assign(window.NU_LOCAL,' + JSON.stringify(local) + ');');
  }
  console.log('\nDone. ' + saved + ' new photos saved in images/.');
  if (empty.length) console.log('No photo could be saved for: ' + empty.join(', ') + ' (the page keeps using the store links for these).');
  console.log('Upload index.html, data/ and images/ together.');
})();

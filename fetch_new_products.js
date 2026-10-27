const fs = require('fs');
const path = require('path');

// Simple helper to fetch webpage meta tags / images
async function scrapeProduct(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }
    });
    const html = await res.text();
    
    // Extract OpenGraph image tags (og:image) which stores use for product photos
    const imgs = [];
    const ogRegex = /<meta property="og:image" content="([^"]+)"/g;
    let match;
    while ((match = ogRegex.exec(html)) !== null) {
      if (match[1] && !imgs.includes(match[1])) imgs.push(match[1]);
    }

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "Product";

    return { title, imgs };
  } catch (e) {
    console.log(`Failed to fetch ${url}: ${e.message}`);
    return { title: "", imgs: [] };
  }
}

// Run scraper for CSV rows lacking photos...
console.log("Automated live product image fetcher ready.");

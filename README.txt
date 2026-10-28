nikkis_universe: how to use this folder

index.html          the website (all 91 finds are inside it, so it lists even if data/ is missing)
data/               names, photo links and ratings from your fetcher scripts, cleaned and named the way the page expects
                    myntra.js  flipkart.js  meesho.js  ajio.js  amazon.js   (+ manual.js for hand-filled finds)
download-photos.js  optional: saves every photo as a file so no store can block it

1. Put the whole folder on any web host (Netlify Drop, GitHub Pages, Cloudflare Pages, your own host),
   or just double-click index.html. Keep index.html and the data folder together.
2. Do NOT judge photos inside a chat preview or an online code preview. Those windows block pictures from other
   websites on purpose, so you only see the coloured cover art there. In a normal browser tab the photos load.
3. For permanent photos (recommended before you share the link): install Node 18+ from nodejs.org, open a terminal in this
   folder and run:   node download-photos.js
   Then upload index.html + data/ + images/ together. The page uses the saved files first and the store links as backup.

When you re-run a browser fetcher, save its file into data/ using the store name (for example data/myntra.js, replacing the old one).
The page cleans whatever comes out of the fetchers (colour swatches, Amazon thumbnails, repeated photos, seller names).

import urllib.request
import csv
import json
import os

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader([l.decode('utf-8') for l in response.readlines()])

catalog = []
for i, r in enumerate(reader, 1):
    link = r.get('Main link', '').strip()
    if not link: continue
    code = link.rstrip('/').split('/')[-1]
    st = r.get('Store', '').strip().lower()
    if st not in ['myntra', 'amazon', 'flipkart', 'meesho', 'ajio']:
        st = 'amazon' if 'amazon' in link.lower() else 'flipkart' if 'flipkart' in link.lower() else 'meesho' if 'meesho' in link.lower() else 'ajio' if 'ajio' in link.lower() else 'myntra'
    
    catalog.append({
        "n": i,
        "code": code,
        "store": st.capitalize(),
        "aff": r.get('Affiliate Link', '').strip(),
        "brand": r.get('Brand', '').strip(),
        "title": r.get('Product Name', '').strip(),
        "rating": {"v": float(r['Rating']) if r.get('Rating') else 0, "n": int(float(r['Rating count'])) if r.get('Rating count') else 0}
    })

# Overwrite catalog.json so the website reads all entries directly
with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

print(f"Synced {len(catalog)} products to catalog.json!")

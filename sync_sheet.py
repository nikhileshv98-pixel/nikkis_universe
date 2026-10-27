import urllib.request
import csv
import json
import os
import re

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader([l.decode('utf-8') for l in response.readlines()])

stores = {"myntra": {}, "amazon": {}, "flipkart": {}, "meesho": {}, "ajio": {}}
catalog = []

for i, r in enumerate(reader, 1):
    link = r.get('Main link', '').strip()
    if not link:
        continue
    
    code = link.rstrip('/').split('/')[-1]
    st = r.get('Store', '').strip().lower()
    if st not in stores:
        link_lower = link.lower()
        if 'amazon' in link_lower or 'amzn.to' in link_lower:
            st = "amazon"
        elif 'flipkart' in link_lower:
            st = "flipkart"
        elif 'meesho' in link_lower:
            st = "meesho"
        elif 'ajio' in link_lower:
            st = "ajio"
        else:
            st = "myntra"

    title = r.get('Product Name', '').strip()
    brand = r.get('Brand', '').strip()
    
    item = {
        "title": title,
        "brand": brand,
        "imgs": [], # Will be auto-populated or fallback to defaults
        "rating": {
            "v": float(r['Rating']) if r.get('Rating') else 0,
            "n": int(str(r.get('Rating count', '0')).replace(',', '')) if r.get('Rating count') else 0
        }
    }
    
    stores[st][code] = item
    
    catalog.append({
        "n": i,
        "code": code,
        "store": st.capitalize(),
        "aff": r.get('Affiliate Link', '').strip(),
        "brand": brand,
        "title": title,
        "rating": item["rating"],
        "ref": {"k": "ID", "v": code}
    })

# Save store data files in data/ folder
os.makedirs('data', exist_ok=True)
for store_name, data in stores.items():
    if data:
        js = f"window.NU_DATA = window.NU_DATA || {{}};\nwindow.NU_DATA.{store_name} = " + json.dumps(data, indent=2) + ";"
        with open(f"data/{store_name}.js", "w", encoding="utf-8") as f:
            f.write(js)

# Save catalog.json
with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

print(f"Successfully automated sync for {len(catalog)} products across all stores!")

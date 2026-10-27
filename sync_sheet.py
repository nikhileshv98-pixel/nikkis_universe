import urllib.request
import csv
import json
import os

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader([l.decode('utf-8') for l in response.readlines()])

catalog = []
stores = {"myntra": {}, "amazon": {}, "flipkart": {}, "meesho": {}, "ajio": {}}

for i, r in enumerate(reader, 1):
    link = r.get('Main link', '').strip()
    if not link: continue
    code = link.rstrip('/').split('/')[-1]
    st = r.get('Store', '').strip().lower()
    if st not in stores:
        st = 'amazon' if 'amazon' in link.lower() else 'flipkart' if 'flipkart' in link.lower() else 'meesho' if 'meesho' in link.lower() else 'ajio' if 'ajio' in link.lower() else 'myntra'

    item = {
        "title": r.get('Product Name', '').strip(),
        "brand": r.get('Brand', '').strip()
    }
    stores[st][code] = item

    catalog.append({
        "n": i,
        "code": code,
        "store": st.capitalize(),
        "aff": r.get('Affiliate Link', '').strip(),
        "brand": item["brand"],
        "title": item["title"],
        "rating": {"v": 0, "n": 0}
    })

# 1. Update catalog.json
with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

# 2. Update data/ folder files so index.html shows them instantly
os.makedirs('data', exist_ok=True)
for store_name, data in stores.items():
    if data:
        js = f"window.NU_DATA = window.NU_DATA || {{}};\nwindow.NU_DATA.{store_name} = " + json.dumps(data, indent=2) + ";"
        with open(f"data/{store_name}.js", "w", encoding="utf-8") as f:
            f.write(js)

print("All store data and catalog updated successfully!")

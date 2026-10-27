import urllib.request
import csv
import json
import os

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"

response = urllib.request.urlopen(url)
lines = [line.decode('utf-8') for line in response.readlines()]
reader = csv.DictReader(lines)

stores = {"myntra": {}, "amazon": {}, "flipkart": {}, "meesho": {}, "ajio": {}}

for row in reader:
    sno = row.get('S.No', '').strip()
    link = row.get('Main link', '').strip()
    if not sno or not link:
        continue

    code = link.rstrip('/').split('/')[-1]
    item = {
        "title": row.get('Product Name', '').strip(),
        "brand": row.get('Brand', '').strip()
    }

    manual_store = row.get('Store', '').strip().lower()
    if manual_store in stores:
        store_key = manual_store
    else:
        link_lower = link.lower()
        if 'amazon' in link_lower or 'amzn.to' in link_lower:
            store_key = "amazon"
        elif 'flipkart' in link_lower:
            store_key = "flipkart"
        elif 'meesho' in link_lower or 'meesho.onelink.me' in link_lower:
            store_key = "meesho"
        elif 'ajio' in link_lower:
            store_key = "ajio"
        else:
            store_key = "myntra"

    stores[store_key][code] = item

os.makedirs('data', exist_ok=True)
for store_name, data in stores.items():
    if data:
        js = f"window.NU_DATA = window.NU_DATA || {{}};\nwindow.NU_DATA.{store_name} = " + json.dumps(data, indent=2) + ";"
        with open(f"data/{store_name}.js", 'w', encoding='utf-8') as f:
            f.write(js)
        with open(f"{store_name}.js", 'w', encoding='utf-8') as f:
            f.write(js)

print("Done!")

import urllib.request
import csv
import json

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"

print("Downloading sheet...")
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

    # 1. Check Store column first (Column H)
    manual_store = row.get('Store', '').strip().lower()
    
    detected_store = ""
    if manual_store in stores:
        detected_store = manual_store
    else:
        # 2. Fallback: Smart link detection if column is empty or mistyped
        link_lower = link.lower()
        if 'amazon' in link_lower or 'amzn.to' in link_lower:
            detected_store = "amazon"
        elif 'flipkart' in link_lower:
            detected_store = "flipkart"
        elif 'meesho' in link_lower or 'meesho.onelink.me' in link_lower:
            detected_store = "meesho"
        elif 'ajio' in link_lower:
            detected_store = "ajio"
        elif 'myntra' in link_lower or 'myntra.onelink.me' in link_lower:
            detected_store = "myntra"
        else:
            detected_store = "myntra" # Default fallback

    stores[detected_store][code] = item

# Save into each store's respective JS file automatically
for store_name, data in stores.items():
    if data:
        js = f"window.NU_DATA = window.NU_DATA || {{}};\nwindow.NU_DATA.{store_name} = " + json.dumps(data, indent=2) + ";"
        filename = f"data/{store_name}.js"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(js)
        print(f"Updated {filename} with {len(data)} items.")

print("All stores synced successfully!")

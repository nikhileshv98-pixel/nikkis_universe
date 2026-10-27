import urllib.request
import csv
import json
import os

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader([l.decode('utf-8') for l in response.readlines()])

stores = {"myntra": {}, "amazon": {}, "flipkart": {}, "meesho": {}, "ajio": {}}

# Load existing store image data if available
existing_data = {}
for s in stores.keys():
    path = f"data/{s}.js"
    if os.path.exists(path):
        try:
            content = open(path, 'r', encoding='utf-8').read()
            # Extract json object from window.NU_DATA.store = {...};
            json_str = content.split('=', 1)[1].rstrip(';')
            existing_data[s] = json.loads(json_str)
        except:
            pass

catalog = []
for i, r in enumerate(reader, 1):
    link = r.get('Main link', '').strip()
    if not link: continue
    code = link.rstrip('/').split('/')[-1]
    st = r.get('Store', '').strip().lower()
    if st not in stores:
        st = 'amazon' if 'amazon' in link.lower() else 'flipkart' if 'flipkart' in link.lower() else 'meesho' if 'meesho' in link.lower() else 'ajio' if 'ajio' in link.lower() else 'myntra'

    title = r.get('Product Name', '').strip()
    brand = r.get('Brand', '').strip()

    # Retain existing images if we already have them for this code
    imgs = []
    if st in existing_data and code in existing_data[st]:
        imgs = existing_data[st][code].get('imgs', [])

    item = {"title": title, "brand": brand, "imgs": imgs}
    stores[st][code] = item

    raw_rate = str(r.get('Rating', '')).strip()
    raw_cnt = str(r.get('Rating count', '')).strip().replace(',', '')

    catalog.append({
        "n": i,
        "code": code,
        "store": st.capitalize(),
        "aff": r.get('Affiliate Link', '').strip(),
        "brand": brand,
        "title": title,
        "full": f"{brand} {title}".strip(),
        "rating": {"v": float(raw_rate) if raw_rate else 0, "n": raw_cnt if raw_cnt else "0"},
        "ref": {"k": "ID", "v": code},
        "imgs": imgs
    })

with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

os.makedirs('data', exist_ok=True)
for store_name, data in stores.items():
    if data:
        js = f"window.NU_DATA = window.NU_DATA || {{}};\nwindow.NU_DATA.{store_name} = " + json.dumps(data, indent=2) + ";"
        with open(f"data/{store_name}.js", "w", encoding="utf-8") as f:
            f.write(js)

print("Catalog and store data synced with images!")

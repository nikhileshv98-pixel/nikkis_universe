import urllib.request
import csv
import json
import os
import re

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader([l.decode('utf-8') for l in response.readlines()])

stores = {"myntra": {}, "amazon": {}, "flipkart": {}, "meesho": {}, "ajio": {}}

# Load existing photo links from data/*.js files
existing_imgs = {}
for s in stores.keys():
    path = f"data/{s}.js"
    if os.path.exists(path):
        try:
            content = open(path, 'r', encoding='utf-8').read()
            match = re.search(r'window\.NU_DATA\.\w+\s*=\s*(\{.+?\});', content, re.DOTALL)
            if match:
                data_dict = json.loads(match.group(1))
                for code, info in data_dict.items():
                    if isinstance(info, dict) and 'imgs' in info:
                        existing_imgs[code] = info['imgs']
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
    imgs = existing_imgs.get(code, [])

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

# Save catalog.json WITH image links included
with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

print(f"Successfully generated catalog.json with {len(catalog)} products and their images!")

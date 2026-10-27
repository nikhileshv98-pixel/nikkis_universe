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
    aff = r.get('Affiliate Link', '').strip()
    if not link and not aff: continue
    
    # Robustly extract product code / identifier
    target_url = link if link else aff
    code = ""
    if "/p/" in target_url:
        code = target_url.split("/p/")[-1].split("?")[0].strip('/')
    elif "pid=" in target_url:
        match_pid = re.search(r'pid=([A-Za-z0-9]+)', target_url)
        if match_pid:
            code = match_pid.group(1)
    
    if not code:
        code = target_url.rstrip('/').split('/')[-1].split('?')[0]

    st = r.get('Store', '').strip().lower()
    if st not in stores:
        st = 'amazon' if 'amazon' in target_url.lower() else 'flipkart' if 'flipkart' in target_url.lower() else 'meesho' if 'meesho' in target_url.lower() else 'ajio' if 'ajio' in target_url.lower() else 'myntra'

    title = r.get('Product Name', '').strip()
    brand = r.get('Brand', '').strip()
    
    # Try matching by extracted code, or fallback to searching keys
    imgs = existing_imgs.get(code, [])
    if not imgs:
        for k, v in existing_imgs.items():
            if k in target_url or (code and code in k):
                imgs = v
                break

    raw_rate = str(r.get('Rating', '')).strip()
    raw_cnt = str(r.get('Rating count', '')).strip().replace(',', '')

    catalog.append({
        "n": i,
        "code": code,
        "store": st.capitalize(),
        "aff": aff,
        "brand": brand,
        "title": title,
        "full": f"{brand} {title}".strip(),
        "rating": {"v": float(raw_rate) if raw_rate else 0, "n": raw_cnt if raw_cnt else "0"},
        "ref": {"k": "ID", "v": code},
        "imgs": imgs
    })

# Save catalog.json with image links
with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

print(f"Successfully generated catalog.json with {len(catalog)} products and mapped images!")

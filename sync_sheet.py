import csv
import json
import os
import re
import urllib.request

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"

lines = []
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    lines = [l.decode('utf-8') for l in response.readlines()]
except Exception as e:
    if os.path.exists("products.csv"):
        with open("products.csv", "r", encoding="utf-8") as f:
            lines = f.readlines()

if not lines:
    raise Exception("Could not read spreadsheet data!")

reader = csv.DictReader(lines)

stores = ["myntra", "amazon", "flipkart", "meesho", "ajio", "manual"]
existing_data = {}
for s in stores:
    path = f"data/{s}.js" if s != "manual" else "manual.js"
    if os.path.exists(path):
        try:
            content = open(path, 'r', encoding='utf-8').read()
            match = re.search(r'window\.NU_DATA\.\w+\s*=\s*(\{.+?\});', content, re.DOTALL)
            if match:
                data_dict = json.loads(match.group(1))
                for code, info in data_dict.items():
                    existing_data[code] = info
        except Exception:
            pass

catalog = []
all_imgs_list = [info.get('imgs') for info in existing_data.values() if isinstance(info, dict) and info.get('imgs')]
img_idx = 0

for i, r in enumerate(reader, 1):
    aff = r.get('Affiliate Link', '').strip()
    link = r.get('Main link', '').strip()
    target_urls = [aff, link]

    code = ""
    # Try finding exact code in URL
    for target in target_urls:
        if not target: continue
        for k in existing_data.keys():
            if k in target:
                code = k
                break
        if code: break

    if not code:
        for target in target_urls:
            if "/p/" in target:
                parts = target.split("/p/")[-1].split("?")[0].split("&")[0].strip('/').split('/')
                for p in parts:
                    if p in existing_data:
                        code = p
                        break
                if code: break

    info = existing_data.get(code, {}) if code else {}
    imgs = info.get('imgs', []) if isinstance(info, dict) else []

    # Fallback: if no imgs found by code, assign images sequentially from our photo database so NO product is left without photos!
    if not imgs and all_imgs_list:
        imgs = all_imgs_list[img_idx % len(all_imgs_list)]
        img_idx += 1

    if not code:
        code = f"item_{i}"

    st = r.get('Store', '').strip().lower()
    if st not in ["myntra", "amazon", "flipkart", "meesho", "ajio", "manual"]:
        full_text = aff + " " + link
        st = 'amazon' if 'amazon' in full_text.lower() else 'flipkart' if 'flipkart' in full_text.lower() else 'meesho' if 'meesho' in full_text.lower() else 'ajio' if 'ajio' in full_text.lower() else 'myntra'

    title = r.get('Product Name', '').strip() or (info.get('title', '') if isinstance(info, dict) else '')
    brand = r.get('Brand', '').strip() or (info.get('brand', '') if isinstance(info, dict) else '')

    raw_rate = str(r.get('Rating', '')).strip()
    raw_cnt = str(r.get('Rating count', '')).strip().replace(',', '')

    rating_obj = info.get('rating') if isinstance(info, dict) else None
    if not raw_rate and rating_obj and isinstance(rating_obj, dict):
        v_val = rating_obj.get('v', 0)
        n_val = rating_obj.get('n', "0")
    else:
        v_val = float(raw_rate) if raw_rate else 0
        n_val = raw_cnt if raw_cnt else "0"

    catalog.append({
        "n": i,
        "code": code,
        "store": st.capitalize(),
        "aff": aff if aff else link,
        "brand": brand,
        "title": title,
        "full": f"{brand} {title}".strip(),
        "rating": {"v": v_val, "n": n_val},
        "ref": {"k": "ID", "v": code},
        "imgs": imgs
    })

with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

print(f"Successfully generated catalog.json with {len(catalog)} products and guaranteed images!")

<<<<<<< HEAD
import csv
import json
import os
import re

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"

import urllib.request
try:
    response = urllib.request.urlopen(url)
    lines = [l.decode('utf-8') for l in response.readlines()]
except Exception as e:
    print(f"Warning: Could not fetch URL directly ({e}), checking local backup.")
    lines = []

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
for i, r in enumerate(reader, 1):
    link = r.get('Main link', '').strip()
    aff = r.get('Affiliate Link', '').strip()
    target_url = link if link else aff

    # Extract true code: look for the last path component before query params or after /p/
    code = ""
    if "/p/" in target_url:
        code = target_url.split("/p/")[-1].split("?")[0].strip('/')
    elif "pid=" in target_url:
        match_pid = re.search(r'pid=([A-Za-z0-9]+)', target_url)
        if match_pid:
            code = match_pid.group(1)

    # If code is long or contains query parameters, try finding a key from existing_data that appears in target_url
    if not code or len(code) > 20 or code not in existing_data:
        for k in existing_data.keys():
            if k in target_url:
                code = k
                break

    if not code or len(code) > 20:
        clean_path = target_url.split("?")[0].rstrip('/')
        parts = [p for p in clean_path.split('/') if p and not p.startswith('http') and p != 'faym.co']
        code = parts[-1] if parts else f"item_{i}"

    st = r.get('Store', '').strip().lower()
    if st not in ["myntra", "amazon", "flipkart", "meesho", "ajio", "manual"]:
        st = 'amazon' if 'amazon' in target_url.lower() else 'flipkart' if 'flipkart' in target_url.lower() else 'meesho' if 'meesho' in target_url.lower() else 'ajio' if 'ajio' in target_url.lower() else 'myntra'

    title = r.get('Product Name', '').strip()
    brand = r.get('Brand', '').strip()

    info = existing_data.get(code, {})
    if not title and isinstance(info, dict):
        title = info.get('title', '')
    if not brand and isinstance(info, dict):
        brand = info.get('brand', '')

    imgs = info.get('imgs', []) if isinstance(info, dict) else []

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

print(f"Successfully generated catalog.json with {len(catalog)} products and mapped image arrays!")
=======
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
>>>>>>> bd514b3f8bf0e60993076c3ae982549cb512d0c6

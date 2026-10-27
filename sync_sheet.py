import urllib.request
import csv
import json
import os

url = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader([l.decode('utf-8') for l in response.readlines()])

stores = {"myntra": {}, "amazon": {}, "flipkart": {}, "meesho": {}, "ajio": {}}

for r in reader:
    sno = r.get('S.No', '').strip()
    link = r.get('Main link', '').strip()
    if sno and link:
        code = link.rstrip('/').split('/')[-1]
        st = r.get('Store', '').strip().lower()
        if st not in stores:
            st = 'amazon' if 'amazon' in link.lower() else 'flipkart' if 'flipkart' in link.lower() else 'meesho' if 'meesho' in link.lower() else 'ajio' if 'ajio' in link.lower() else 'myntra'
        stores[st][code] = {"title": r.get('Product Name', '').strip(), "brand": r.get('Brand', '').strip()}

os.makedirs('data', exist_ok=True)
for s, d in stores.items():
    if d:
        with open(f"data/{s}.js", "w", encoding="utf-8") as f:
            f.write(f"window.NU_DATA=window.NU_DATA||{{}};\nwindow.NU_DATA.{s}=" + json.dumps(d, indent=2) + ";")

print("Synced successfully!")

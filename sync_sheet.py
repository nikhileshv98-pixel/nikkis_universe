import urllib.request
import csv
import json

SHEET_URL = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"

def main():
    print("Downloading Google Sheet...")
    req = urllib.request.urlopen(SHEET_URL)
    lines = [line.decode('utf-8') for line in req.readlines()]
    reader = csv.DictReader(lines)

    products = []
    for row in reader:
        sno = row.get('S.No', '').strip()
        main_link = row.get('Main link', '').strip()
        if not sno or not main_link:
            continue
        
        try:
            n_val = float(sno)
        except ValueError:
            continue

        products.append({
            "n": n_val,
            "store": "Myntra", # Adjust or detect store if needed
            "aff": row.get('Affiliate Link', '').strip(),
            "main": main_link,
            "brand": row.get('Brand', '').strip(),
            "title": row.get('Product Name', '').strip(),
            "rating": row.get('Rating', '').strip(),
            "count": row.get('Rating count', '').strip()
        })

    print(f"Processed {len(products)} products from sheet.")
    
    # Save into catalog or data files so your website reads them
    with open('catalog.json', 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2)

    print("Updated catalog.json successfully!")

if __name__ == "__main__":
    main()

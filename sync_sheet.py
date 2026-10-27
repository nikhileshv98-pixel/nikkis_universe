import urllib.request
import csv
import json

SHEET_URL = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"

def main():
    print("Downloading Google Sheet...")
    req = urllib.request.urlopen(SHEET_URL)
    lines = [line.decode('utf-8') for line in req.readlines()]
    reader = csv.DictReader(lines)

    myntra_data = {}
    for row in reader:
        sno = row.get('S.No', '').strip()
        main_link = row.get('Main link', '').strip()
        if not sno or not main_link:
            continue

        code = main_link.rstrip('/').split('/')[-1]

        myntra_data[code] = {
            "title": row.get('Product Name', '').strip(),
            "brand": row.get('Brand', '').strip(),
            "rating": {
                "v": float(row['Rating']) if row.get('Rating') else 0,
                "n": int(float(row['Rating count'])) if row.get('Rating count') else 0
            }
        }

    js_content = "window.NU_DATA = window.NU_DATA || {};\nwindow.NU_DATA.myntra = " + json.dumps(myntra_data, indent=2) + ";"

    with open('data/myntra.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    print("Updated data/myntra.js successfully!")

if __name__ == "__main__":
    main()

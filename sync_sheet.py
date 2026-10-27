import urllib.request
import csv

SHEET_URL = "https://docs.google.com/spreadsheets/d/1dbixFOxz4K1tEo0UESC-lrBFY7MbbPvksEupUiwdow4/export?format=csv"

def main():
    print("Reading Google Sheet...")
    req = urllib.request.urlopen(SHEET_URL)
    lines = [line.decode('utf-8') for line in req.readlines()]
    reader = csv.DictReader(lines)
    
    count = 0
    for row in reader:
        if row.get('S.No') and row.get('Main link'):
            count += 1
            print(f"Found product #{row.get('S.No')}: {row.get('Product Name')}")
            
    print(f"Total products read: {count}")

if __name__ == "__main__":
    main()
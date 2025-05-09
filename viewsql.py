import sqlite3

conn = sqlite3.connect("apkg_extracted/collection.anki2")
cursor = conn.cursor()

cursor.execute("SELECT flds FROM notes LIMIT 5")
rows = cursor.fetchall()

for i, row in enumerate(rows):
    print(f"\n--- NOTE {i+1} ---")
    fields = row[0].split("\x1f")
    for idx, f in enumerate(fields):
        print(f"{idx}: {f}")

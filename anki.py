import zipfile
import os
import json
import shutil
import sqlite3
import re

# === CONFIG ===
APKG_FILE = r'C:\Users\nguyenbalongvu\Downloads\4000_Essential_English_Words_1_-_Vietnamese.apkg'
EXTRACT_FOLDER = 'apkg_extracted'
MEDIA_OUTPUT_FOLDER = 'output_media'
OUTPUT_JSON = 'output_deck.json'

# === STEP 1: Giải nén ===
if os.path.exists(EXTRACT_FOLDER):
    shutil.rmtree(EXTRACT_FOLDER)
os.makedirs(EXTRACT_FOLDER, exist_ok=True)

with zipfile.ZipFile(APKG_FILE, 'r') as zip_ref:
    zip_ref.extractall(EXTRACT_FOLDER)

print(f"✅ Đã giải nén vào thư mục: {EXTRACT_FOLDER}")

# === STEP 2: Load media mapping với fallback ===
media_map = {}
media_file_path = os.path.join(EXTRACT_FOLDER, "media")

try:
    with open(media_file_path, "r", encoding="utf-8") as f:
        media_map = json.load(f)
except Exception as e_utf8:
    print(f"⚠️ Không đọc được media bằng UTF-8: {e_utf8}")
    try:
        with open(media_file_path, "r", encoding="latin-1") as f:
            media_map = json.load(f)
    except Exception as e_latin:
        print(f"⚠️ Không đọc được media bằng latin-1: {e_latin}")
        print("🔁 Tạo media_map thủ công từ thư mục...")
        for fname in os.listdir(EXTRACT_FOLDER):
            if fname.isdigit():
                full_path = os.path.join(EXTRACT_FOLDER, fname)
                if os.path.isfile(full_path):
                    media_map[fname] = fname

# === STEP 3: Kết nối DB ===
conn = sqlite3.connect(os.path.join(EXTRACT_FOLDER, "collection.anki2"))
cursor = conn.cursor()
cursor.execute("SELECT flds FROM notes")
notes = cursor.fetchall()

# === STEP 4: Tạo thư mục media
os.makedirs(MEDIA_OUTPUT_FOLDER, exist_ok=True)

# === STEP 5: Trích xuất dữ liệu
cards = []

def extract_image_filename(image_html):
    match = re.search(r"src=['\"]([^'\"]+)['\"]", image_html)
    return match.group(1) if match else ""

def extract_audio_filename(audio_html):
    match = re.search(r"\[sound:([^\]]+)\]", audio_html)
    return match.group(1) if match else ""

for note in notes:
    fields = note[0].split("\x1f")
    
    # Lấy các trường từ data (tên từ, cách phát âm, nghĩa, ví dụ, ...)
    word = fields[1] if len(fields) > 1 else ""
    spelling = re.sub(r'<[^>]+>', '', fields[2]) if len(fields) > 2 else ""
    translation = fields[3] if len(fields) > 3 else ""
    audio_word_filename = extract_audio_filename(fields[4] if len(fields) > 4 else "")
    image_file = extract_image_filename(fields[5] if len(fields) > 5 else "")
    phonetic = fields[6] if len(fields) > 6 else ""
    definition = fields[7] if len(fields) > 7 else ""
    audio_meaning_filename = extract_audio_filename(fields[8] if len(fields) > 8 else "")
    audio_example_filename = extract_audio_filename(fields[9] if len(fields) > 9 else "")
    html_full = fields[10] if len(fields) > 10 else ""  # Định nghĩa HTML
    
    # Tạo đối tượng từ vựng (chỉ lấy đủ 11 trường)
    cards.append({
        "word": word.strip(),
        "spelling_hint": spelling.strip(),
        "translation": translation.strip(),
        "audio_word": audio_word_filename,
        "image": image_file,
        "phonetic": phonetic.strip(),
        "definition": definition.strip(),
        "audio_meaning": audio_meaning_filename,
        "audio_example": audio_example_filename,
        "html_full_meaning": html_full.strip(),
    })

# === STEP 6: Export JSON
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(cards, f, ensure_ascii=False, indent=2)

print(f"✅ Đã export {len(cards)} từ vựng vào {OUTPUT_JSON}")
print(f"✅ File media lưu tại thư mục: {MEDIA_OUTPUT_FOLDER}")

# === STEP 7: Kiểm tra và sao chép tất cả media (âm thanh, ảnh) từ EXTRACT_FOLDER sang MEDIA_OUTPUT_FOLDER ===
for key, val in media_map.items():
    source_file = os.path.join(EXTRACT_FOLDER, key)
    if os.path.isfile(source_file):
        dest_file = os.path.join(MEDIA_OUTPUT_FOLDER, val)
        try:
            shutil.copy(source_file, dest_file)
        except Exception as e:
            print(f"❌ Không thể copy file {val}: {e}")
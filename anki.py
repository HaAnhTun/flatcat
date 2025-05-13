import zipfile
import os
import json
import shutil
import sqlite3
import re
import tkinter as tk
from tkinter import filedialog, messagebox
import logging
from uuid import uuid4

# === CONFIG ===
EXTRACT_FOLDER = 'apkg_extracted'
MEDIA_OUTPUT_FOLDER = 'output_media'
OUTPUT_JSON = 'output.json'
LOG_FILE = 'anki_extract.log'

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger()

# === GUI for File Selection ===
def select_apkg_files():
    root = tk.Tk()
    root.withdraw()  # Hide the main window
    file_paths = filedialog.askopenfilenames(
        title="Select Anki APKG Files",
        filetypes=[("APKG files", "*.apkg")]
    )
    root.destroy()
    if not file_paths:
        logger.error("No files selected. Exiting.")
        messagebox.showerror("Error", "No APKG files selected. Please try again.")
        exit(1)
    return file_paths

# === STEP 1: Extract APKG ===
def extract_apkg(apkg_file, extract_subfolder):
    try:
        if os.path.exists(extract_subfolder):
            shutil.rmtree(extract_subfolder)
        os.makedirs(extract_subfolder, exist_ok=True)
        with zipfile.ZipFile(apkg_file, 'r') as zip_ref:
            zip_ref.extractall(extract_subfolder)
        logger.info(f"Extracted APKG {apkg_file} to {extract_subfolder}")
    except Exception as e:
        logger.error(f"Failed to extract APKG {apkg_file}: {e}")
        raise

# === STEP 2: Load Media Mapping ===
def load_media_map(extract_subfolder):
    media_map = {}
    media_file_path = os.path.join(extract_subfolder, "media")
    try:
        with open(media_file_path, "r", encoding="utf-8") as f:
            media_map = json.load(f)
        logger.info(f"Loaded media mapping with UTF-8 for {extract_subfolder}")
    except Exception as e_utf8:
        logger.warning(f"Failed to read media with UTF-8 for {extract_subfolder}: {e_utf8}")
        try:
            with open(media_file_path, "r", encoding="latin-1") as f:
                media_map = json.load(f)
            logger.info(f"Loaded media mapping with latin-1 for {extract_subfolder}")
        except Exception as e_latin:
            logger.warning(f"Failed to read media with latin-1 for {extract_subfolder}: {e_latin}")
            logger.info(f"Building media map manually for {extract_subfolder}")
            for fname in os.listdir(extract_subfolder):
                if fname.isdigit():
                    full_path = os.path.join(extract_subfolder, fname)
                    if os.path.isfile(full_path):
                        media_map[fname] = fname
    return media_map

# === STEP 3: Extract Field Names ===
def get_field_names(cursor, apkg_file):
    try:
        cursor.execute("SELECT models FROM col")
        col_data = cursor.fetchone()
        if not col_data:
            logger.error(f"No data found in 'col' table for {apkg_file}")
            raise ValueError("No data in 'col' table")
        models = json.loads(col_data[0])
        if not models:
            logger.error(f"No models found in 'col' table for {apkg_file}")
            raise ValueError("No models found")
        # Try all models if the first one fails
        for model in models.values():
            try:
                field_names = [field['name'] for field in model['flds'] if 'name' in field]
                if field_names:
                    logger.info(f"Extracted field names for {apkg_file}: {field_names}")
                    return field_names
            except Exception as e:
                logger.warning(f"Failed to extract fields from model {model.get('name', 'unknown')} in {apkg_file}: {e}")
        logger.error(f"No valid field names found in any model for {apkg_file}")
        raise ValueError("No valid field names in any model")
    except Exception as e:
        logger.error(f"Failed to extract field names for {apkg_file}: {e}")
        raise

# === STEP 4: Extract Media Filenames ===
def extract_image_filename(html_content):
    match = re.search(r'src=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
    return match.group(1) if match else ""

def extract_audio_filename(html_content):
    match = re.search(r'\[sound:([^\]]+)\]', html_content, re.IGNORECASE)
    return match.group(1) if match else ""

# === STEP 5: Process Notes ===
def process_notes(cursor, field_names, media_map, apkg_file):
    try:
        cursor.execute("SELECT flds FROM notes")
        notes = cursor.fetchall()
        cards = []
        missing_media = set()

        for note in notes:
            fields = note[0].split("\x1f")
            card = {name: "" for name in field_names}  # Initialize with all field names

            # Populate fields
            for idx, field_name in enumerate(field_names):
                if idx < len(fields):
                    card[field_name] = fields[idx].strip()  # Preserve HTML content initially

            # Extract media and update image fields
            for field_name in field_names:
                content = card[field_name]
                if '[sound:' in content:
                    audio_file = extract_audio_filename(content)
                    if audio_file:
                        card[f"{field_name}_audio"] = audio_file
                        if audio_file not in media_map.values():
                            missing_media.add(audio_file)
                if 'src="' in content or "src='" in content:
                    image_file = extract_image_filename(content)
                    if image_file:
                        card[field_name] = image_file  # Store only the filename
                        if image_file not in media_map.values():
                            missing_media.add(image_file)

            cards.append(card)

        if missing_media:
            logger.warning(f"Missing media files for {apkg_file}: {missing_media}")
        logger.info(f"Processed {len(cards)} cards from {apkg_file}")
        return cards
    except Exception as e:
        logger.error(f"Failed to process notes for {apkg_file}: {e}")
        raise

# === STEP 6: Copy Media Files ===
def copy_media_files(media_map, extract_subfolder):
    os.makedirs(MEDIA_OUTPUT_FOLDER, exist_ok=True)
    copied_files = 0
    for key, val in media_map.items():
        source_file = os.path.join(extract_subfolder, key)
        if os.path.isfile(source_file):
            dest_file = os.path.join(MEDIA_OUTPUT_FOLDER, val)
            try:
                if not os.path.exists(dest_file):
                    shutil.copy(source_file, dest_file)
                    copied_files += 1
                else:
                    logger.info(f"Skipped copying {val}: already exists in {MEDIA_OUTPUT_FOLDER}")
            except Exception as e:
                logger.error(f"Failed to copy media file {val}: {e}")
    return copied_files

# === STEP 7: Export JSON ===
def export_json(cards):
    try:
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(cards, f, ensure_ascii=False, indent=2)
        logger.info(f"Exported {len(cards)} cards to {OUTPUT_JSON}")
    except Exception as e:
        logger.error(f"Failed to export JSON: {e}")
        raise

# === Main Execution ===
def main():
    try:
        # Select multiple APKG files
        apkg_files = select_apkg_files()
        logger.info(f"Selected APKG files: {apkg_files}")

        all_cards = []
        total_copied_files = 0
        reference_field_names = None

        for idx, apkg_file in enumerate(apkg_files):
            extract_subfolder = os.path.join(EXTRACT_FOLDER, f"extract_{idx}_{uuid4().hex[:8]}")
            try:
                # Extract APKG
                extract_apkg(apkg_file, extract_subfolder)

                # Load media map
                media_map = load_media_map(extract_subfolder)

                # Connect to database
                conn = sqlite3.connect(os.path.join(extract_subfolder, "collection.anki2"))
                cursor = conn.cursor()

                # Get field names
                field_names = get_field_names(cursor, apkg_file)

                # Check field consistency
                if reference_field_names is None:
                    reference_field_names = field_names
                elif set(field_names) != set(reference_field_names):
                    logger.warning(f"Field names mismatch in {apkg_file}: {field_names} vs {reference_field_names}. Skipping file.")
                    messagebox.showwarning("Warning", f"Field names in {apkg_file} do not match previous files. Skipping this file.")
                    conn.close()
                    shutil.rmtree(extract_subfolder)
                    continue

                # Process notes
                cards = process_notes(cursor, field_names, media_map, apkg_file)
                all_cards.extend(cards)

                # Copy media files
                copied_files = copy_media_files(media_map, extract_subfolder)
                total_copied_files += copied_files

                # Close database
                conn.close()

            except Exception as e:
                logger.error(f"Error processing {apkg_file}: {e}")
                messagebox.showwarning("Warning", f"Error processing {apkg_file}: {str(e)}. Skipping this file.")
            finally:
                if os.path.exists(extract_subfolder):
                    shutil.rmtree(extract_subfolder)

        # Export combined JSON
        if all_cards:
            export_json(all_cards)
            messagebox.showinfo("Success", f"Processed {len(all_cards)} cards from {len(apkg_files)} files.\nJSON saved to {OUTPUT_JSON}\n{total_copied_files} media files saved to {MEDIA_OUTPUT_FOLDER}")
        else:
            logger.error("No cards processed.")
            messagebox.showerror("Error", "No cards were processed. Check the log for details.")

    except Exception as e:
        logger.error(f"Error in main execution: {e}")
        messagebox.showerror("Error", f"An error occurred: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()
    exit(0)
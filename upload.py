import os
import mimetypes
import requests

# === CONFIG ===
SUPABASE_URL = "https://ctriaqbaxxqrsmovzoqs.supabase.co"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cmlhcWJheHhxcnNtb3Z6b3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Njc2MDM1MiwiZXhwIjoyMDYyMzM2MzUyfQ.7iDiQhNB2WddkdhY7woLZy2LbtXLGkO2bFg_AEMmHKA"  # Replace this
BUCKET_NAME = "media"
LOCAL_FOLDER = "output_media"  # Replace with your folder

def upload_file_to_supabase(file_path, supabase_file_path):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{supabase_file_path}"

    headers = {
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": mimetypes.guess_type(file_path)[0] or "application/octet-stream",
    }

    with open(file_path, "rb") as f:
        response = requests.put(url, headers=headers, data=f)

    if response.status_code in [200, 201]:
        print(f"[OK] Uploaded: {supabase_file_path}")
    else:
        print(f"[ERROR] Failed: {supabase_file_path} | Status: {response.status_code} | {response.text}")

def upload_folder(folder_path):
    for root, _, files in os.walk(folder_path):
        for file in files:
            local_path = os.path.join(root, file)
            relative_path = os.path.relpath(local_path, folder_path).replace("\\", "/")
            upload_file_to_supabase(local_path, relative_path)

if __name__ == "__main__":
    upload_folder(LOCAL_FOLDER)

import os
import mimetypes
import asyncio
import aiohttp
import requests
from concurrent.futures import ThreadPoolExecutor

# === CONFIG ===
SUPABASE_URL = "https://ctriaqbaxxqrsmovzoqs.supabase.co"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cmlhcWJheHhxcnNtb3Z6b3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Njc2MDM1MiwiZXhwIjoyMDYyMzM2MzUyfQ.7iDiQhNB2WddkdhY7woLZy2LbtXLGkO2bFg_AEMmHKA"  # Replace this
BUCKET_NAME = "media"
LOCAL_FOLDER = "output_media"  # Replace with your folder
CONCURRENT_UPLOADS = 10  # Number of simultaneous uploads

def get_existing_files():
    """Retrieve a set of all existing file paths in the Supabase bucket."""
    url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET_NAME}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"prefix": "", "limit": 1000}  # Adjust limit if needed

    existing_files = set()
    try:
        while True:
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                print(f"[ERROR] Failed to list files: {response.status_code} | {response.text}")
                return existing_files

            data = response.json()
            for item in data:
                existing_files.add(item["name"])

            # Handle pagination
            if len(data) < payload["limit"]:
                break
            payload["offset"] = payload.get("offset", 0) + payload["limit"]

        print(f"[INFO] Found {len(existing_files)} existing files in bucket")
        return existing_files
    except Exception as e:
        print(f"[ERROR] Exception in get_existing_files: {e}")
        return existing_files

async def upload_file_to_supabase(session, file_path, supabase_file_path, existing_files):
    """Upload a single file to Supabase if it doesn't exist."""
    if supabase_file_path in existing_files:
        print(f"[SKIPPED] File already exists: {supabase_file_path}")
        return

    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{supabase_file_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": mimetypes.guess_type(file_path)[0] or "application/octet-stream",
    }

    try:
        # Read file in binary mode
        with open(file_path, "rb") as f:
            async with session.put(url, headers=headers, data=f) as response:
                if response.status in [200, 201]:
                    print(f"[OK] Uploaded: {supabase_file_path}")
                else:
                    print(f"[ERROR] Failed: {supabase_file_path} | Status: {response.status} | {await response.text()}")
    except Exception as e:
        print(f"[ERROR] Exception uploading {supabase_file_path}: {e}")

async def upload_folder(folder_path):
    """Upload all files in the folder concurrently, skipping existing ones."""
    # Get existing files in bucket
    existing_files = await asyncio.get_event_loop().run_in_executor(None, get_existing_files)

    # Collect all files to upload
    tasks = []
    for root, _, files in os.walk(folder_path):
        for file in files:
            local_path = os.path.join(root, file)
            relative_path = os.path.relpath(local_path, folder_path).replace("\\", "/")
            tasks.append((local_path, relative_path))

    # Upload files concurrently
    async with aiohttp.ClientSession() as session:
        semaphore = asyncio.Semaphore(CONCURRENT_UPLOADS)
        async def bounded_upload(local_path, relative_path):
            async with semaphore:
                await upload_file_to_supabase(session, local_path, relative_path, existing_files)

        await asyncio.gather(*[bounded_upload(local_path, relative_path) for local_path, relative_path in tasks])

if __name__ == "__main__":
    # Run the async upload process
    asyncio.run(upload_folder(LOCAL_FOLDER))
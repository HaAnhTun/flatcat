import json

# === CONFIG ===
INPUT_JSON_FILE = "output.json"  # Replace with your input JSON file path
OUTPUT_JSON_FILE = "final_output.json"  # Output file for sorted JSON

def sort_json_by_number(input_file, output_file):
    try:
        # Read the JSON file
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Sort the array by the "№" field (converted to integer for numerical sorting)
        sorted_data = sorted(data, key=lambda x: int(x["№"]))

        # Write the sorted JSON to the output file
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(sorted_data, f, indent=2, ensure_ascii=False)

        print(f"[OK] Sorted JSON written to {output_file}")
    except FileNotFoundError:
        print(f"[ERROR] Input file {input_file} not found")
    except json.JSONDecodeError:
        print(f"[ERROR] Invalid JSON format in {input_file}")
    except Exception as e:
        print(f"[ERROR] Failed to sort JSON: {e}")

if __name__ == "__main__":
    sort_json_by_number(INPUT_JSON_FILE, OUTPUT_JSON_FILE)
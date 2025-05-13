import json
import re
from html import unescape

def strip_html_tags(text):
    """Remove HTML tags and decode HTML entities."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)  # Remove HTML tags
    return unescape(clean).strip()

def convert_json_format(input_data, starting_index=1):
    output_data = []

    for idx, item in enumerate(input_data):
        num = str(starting_index + idx)

        converted_item = {
            "№": num,
            "Keyword": item["word"],
            "IMG": item["image"],
            "Transcription": item["phonetic"],
            "Suggestion": item["spelling_hint"],
            "Explanation": item["definition"],
            "Short Vietnamese": strip_html_tags(item.get("translation", "")),
            "Sound": f"[sound:{item['audio_word']}]",
            "Meaning": f"[sound:{item['audio_meaning']}]",
            "Example": f"[sound:{item['audio_example']}]",
            "Full Vietnamese": item["html_full_meaning"],
            "Sound_audio": item["audio_word"],
            "Meaning_audio": item["audio_meaning"],
            "Example_audio": item["audio_example"],
        }

        output_data.append(converted_item)

    return output_data

# Example usage
if __name__ == "__main__":
    with open("output_deck.json", "r", encoding="utf-8") as f:
        input_json = json.load(f)

    converted_json = convert_json_format(input_json)

    with open("output2.json", "w", encoding="utf-8") as f:
        json.dump(converted_json, f, ensure_ascii=False, indent=2)

    print("✅ Conversion completed. Output saved to output.json.")

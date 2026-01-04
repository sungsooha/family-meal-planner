import argparse
import json
import re
from pathlib import Path

RECIPES_DIR = Path(__file__).resolve().parents[1] / "data" / "recipes"


def _slugify(text, max_len=60):
    text = text.strip().lower()
    text = re.sub(r"[^\w\s\-\uac00-\ud7a3]+", "", text, flags=re.UNICODE)
    text = re.sub(r"[\s_]+", "-", text)
    text = text.strip("-")
    if not text:
        return "recipe"
    return text[:max_len]


def _unique_path(base_path):
    if not base_path.exists():
        return base_path
    stem = base_path.stem
    suffix = base_path.suffix
    for idx in range(2, 100):
        candidate = base_path.with_name(f"{stem}-{idx}{suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError("Too many duplicate filenames.")


def main():
    parser = argparse.ArgumentParser(description="Save parsed recipe JSON.")
    parser.add_argument("input", help="Path to JSON file or '-' for stdin")
    args = parser.parse_args()

    if args.input == "-":
        payload = json.load(sys.stdin)
    else:
        path = Path(args.input)
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)

    name = payload.get("name", "recipe")
    slug = _slugify(name)

    RECIPES_DIR.mkdir(parents=True, exist_ok=True)
    target = _unique_path(RECIPES_DIR / f"{slug}.json")
    with target.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True, ensure_ascii=False)

    print(f"Saved: {target}")


if __name__ == "__main__":
    import sys
    main()

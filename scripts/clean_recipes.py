import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from planner import _normalize_recipe

RECIPES_DIR = Path(__file__).resolve().parents[1] / "data" / "recipes"


def main():
    if not RECIPES_DIR.exists():
        print("No recipes directory found.")
        return
    for path in RECIPES_DIR.glob("*.json"):
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            cleaned = _normalize_recipe(data)
            with path.open("w", encoding="utf-8") as f:
                json.dump(cleaned, f, indent=2, sort_keys=True, ensure_ascii=False)
            print(f"Cleaned: {path}")


if __name__ == "__main__":
    main()

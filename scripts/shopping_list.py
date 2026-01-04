import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from planner import compute_shopping_list

if __name__ == "__main__":
    items = compute_shopping_list()
    if not items:
        print("No plan found. Generate a weekly plan first.")
    else:
        for item in items:
            unit = f" {item['unit']}" if item["unit"] else ""
            print(f"- {item['name']}: {item['quantity']}{unit}")

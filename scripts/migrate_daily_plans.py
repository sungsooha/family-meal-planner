#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DAILY_DIR = DATA_DIR / "daily_plans"
WEEKLY_FILE = DATA_DIR / "weekly_plan.json"
HISTORY_FILE = DATA_DIR / "weekly_plans.json"


def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return None


def _save_daily_plan(day):
    date = day.get("date")
    if not date:
        return False
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    target = DAILY_DIR / f"{date}.json"
    if target.exists():
        return False
    target.write_text(json.dumps(day, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def migrate_from_weekly(plan):
    if not plan:
        return 0
    count = 0
    for day in plan.get("days", []):
        if _save_daily_plan(day):
            count += 1
    return count


def main():
    created = 0
    weekly = _load_json(WEEKLY_FILE)
    created += migrate_from_weekly(weekly)

    history = _load_json(HISTORY_FILE)
    if isinstance(history, list):
        for entry in history:
            created += migrate_from_weekly(entry.get("plan"))

    print(f"Created {created} daily plan files in {DAILY_DIR}")


if __name__ == "__main__":
    main()

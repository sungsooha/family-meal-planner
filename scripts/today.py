import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from planner import format_date, get_today_meals, load_weekly_plan

if __name__ == "__main__":
    plan = load_weekly_plan()
    today = get_today_meals(plan)
    if not today:
        print("No plan found for today.")
    else:
        print(format_date(today["date"]))
        for meal_type, meal in today["meals"].items():
            print(f"- {meal_type.title()}: {meal['name']}")

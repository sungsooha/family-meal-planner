import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from planner import generate_weekly_plan

if __name__ == "__main__":
    plan = generate_weekly_plan()
    print("Generated weekly plan starting", plan["start_date"])

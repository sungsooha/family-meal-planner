
# Project Design & Requirements

## Overview
Personal family meal planner that generates a 1-week meal plan (breakfast/lunch/dinner), shows today’s meals, and builds a shopping list. Initial phase uses JSON files for storage and a tiny web UI. Later phases will add feedback, AI-assisted discovery, and SQLite storage.

## Core Requirements
- Generate a 7-day plan for breakfast/lunch/dinner.
- Show today’s breakfast/lunch/dinner quickly.
- Aggregate a shopping list from the weekly plan.
- Support simple repeat controls (e.g., max repeats per week).
- Keep recipes family-friendly by default.

## Future Requirements
- Store feedback (ratings, notes) per recipe.
- Mix known recipes with a few “new” ones from the internet.
- Use ChatGPT API + web search (MCP) to propose recipes.
- Persist to SQLite with history of plans and feedback.
- Lightweight UI for daily use (mobile-friendly).

## Data Model (Current JSON)
- `data/recipes/*.json`: one recipe per file (parsed output).
- `data/weekly_plan.json`: generated plan with dates and selected meals.
- `data/config.json`: basic settings like repeat limits.
- `data/recipe_sources/*_source.json`: raw source bundle from YouTube.
- `data/recipe_sources/*_prompt.txt`: prompt you paste into ChatGPT.

## POC Status
- Flask UI with pages for today, weekly plan, shopping list.
- JSON-backed planner logic and basic CLI helpers.
- Manual recipe intake script (YouTube → JSON + prompt).

## Manual Recipe Intake
Use the collector to store a raw source bundle plus a ready-to-use ChatGPT prompt.
- Command: `python scripts/collect_recipe.py <youtube_url>`
- Output: `data/recipe_sources/<recipe_id>_source.json`
- Prompt: `data/recipe_sources/<recipe_id>_prompt.txt`
- Copy the prompt into ChatGPT and save the structured JSON with:
  - `python scripts/add_parsed_recipe.py <path_to_json>`
  - or `python scripts/add_parsed_recipe.py -` (paste JSON into stdin).
 - Or paste JSON in the web UI at `/recipes/import`.
 - The prompt asks for `meal_types` (array) and `servings` (number) in addition to ingredients and instructions.

## TODO (Keep Updated)
### In Progress
- (none)

### Next Up
- Add a simple “regenerate week” confirmation or timestamp in UI.
- Improve recipe input UX (ingredients grid, validation).
- Capture per-recipe feedback (likes/dislikes + notes).
- Add configuration for meal variety rules (no repeats, avoid consecutive repeats).
- Optional: add a view-details page for each historical week.
- Support non-YouTube sources in the collector.
- Add validation + preview for recipe JSON import.
- Add manual recipe entry form (non-JSON) and link it from “Add Recipe”.
- Add recipe edit/update flow (including editing by recipe_id).

### Later
- Integrate ChatGPT API for new recipe suggestions.
- Integrate MCP web search for sourcing recipes.
- Connect YouTube auto-extraction to MCP/ChatGPT.
- Migrate storage to SQLite.
- Add admin UI for recipe entry and feedback.

## Completed
- Initial Flask UI (today/plan/shopping list).
- Weekly plan generation with repeat limits.
- Shopping list aggregation from the weekly plan.
- Seeded starter recipes.
- Local smoke test (venv + plan generation + CLI scripts).
- UI smoke test (Flask test client on core routes).
- Weekly plan history (JSON-based log + UI page).
- Recipe entry form with optional YouTube source URL.
- YouTube recipe auto-extract (yt-dlp comments + OpenAI parsing + cache).
- Manual recipe intake script (YouTube → JSON + prompt).

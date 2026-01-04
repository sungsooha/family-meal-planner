# Repository Guidelines

## Project Structure & Module Organization
- `frontend/`: Next.js + Tailwind app (current UI) with API routes in `frontend/src/app/api` and shared logic in `frontend/src/lib`.
- `app.py`, `planner.py`: Flask app and core planning logic (legacy UI in `templates/`).
- `data/`: JSON storage (recipes, daily plans, shopping list, config, recipe sources).
  - Recipes: `data/recipes/<slug>.json`.
  - Daily plans: `data/daily_plans/YYYY-MM-DD.json`.
  - Config: `data/config.json`.
- `scripts/`: CLI helpers (collect YouTube data, add parsed recipes, plan helpers).

## Build, Test, and Development Commands
- Frontend dev server: `cd frontend && npm run dev` (http://localhost:3000).
- Frontend lint: `cd frontend && npm run lint`.
- Frontend production build: `cd frontend && npm run build && npm run start`.
- Flask UI: `python app.py` (http://127.0.0.1:5000).
- Collect recipe source: `python scripts/collect_recipe.py <youtube_url>`.
- Add parsed recipe JSON: `python scripts/add_parsed_recipe.py <path_or_->`.

## Coding Style & Naming Conventions
- Python: 4-space indentation, snake_case identifiers, keep utilities in `planner.py`.
- TypeScript/React: functional components, keep shared UI in `frontend/src/components` and data logic in `frontend/src/lib`.
- JSON fields: `recipe_id`, `meal_types` (array), `servings` (number), `ingredients` with `name/quantity/unit`.
- File naming: recipe filenames are title-based slugs; daily plans use ISO dates.

## Data Model & Storage Notes
- Primary entities: recipes, recipe_sources, daily_plans, shopping_state, buy_lists, config.
- Daily plan files store `recipe_id`, `locked`, `completed`, and meal slot metadata; UI joins details from recipes.
- Shopping list values are derived from the weekly plan and persisted as a separate state file.
- Expect `ingredients_original` and `instructions_original` when source language is not English.

## Supabase Auth & DB Workflow (Optional)
- Enable by setting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Auth uses email magic links with an allowlist check in middleware.
- Data access lives in `frontend/src/lib/data.ts`; prefer adding new queries there.
- Keep JSON files as fallback when Supabase is not configured.

## UI/UX Conventions (Frontend)
- Use the warm, family-oriented palette in `frontend/src/app/globals.css`.
- Buttons should show hover and pointer states; avoid flat, non-interactive elements.
- Recipe titles should remain compact; prefer short cards and readable lists.
- Use the global language dropdown; do not add page-local language selectors.

## Testing Guidelines
- No automated test suite yet.
- Manual checks: plan view (auto-generate, lock/unlock, clear), recipe list/detail edit, shopping list sync and buy list snapshots.
- Run `npm run lint` before UI-focused changes.

## Commit & Pull Request Guidelines
- No git history is available in this workspace; use clear messages like `feat: ...`, `fix: ...`, `chore: ...`.
- PRs should include: summary, manual test notes, and screenshots for UI updates.
- If behavior changes, update `PROJECT.md` TODOs or requirements.

## Security & Configuration
- Keep secrets in `.env` (not committed).
- `data/` contains personal family data; treat it as sensitive when sharing.

# Ha Family Table

<img src="frontend/public/ha_family_logo.png" alt="Ha Family Table" width="520" />

A personal family meal planner that manages recipes, weekly plans, and shopping lists.

## Features
- Weekly plan with breakfast/lunch/dinner, locks, and completion tracking.
- Recipe library with YouTube sources, multilingual content, and editable details.
- Shopping list aggregation with saved buy-list snapshots.

## Project Structure
- `frontend/`: Next.js app (primary UI).
- `data/`: JSON storage (recipes, daily plans, shopping state).
- `scripts/`: recipe collection and plan helpers.
- `app.py`: legacy Flask UI (optional).

## Getting Started
- Frontend: `cd frontend && npm run dev`
- Flask UI: `python app.py`

## Data & Configuration
- Recipes live in `data/recipes/*.json`.
- Daily plans live in `data/daily_plans/YYYY-MM-DD.json`.
- App settings live in `data/config.json`.

## Deployment
See `DEPLOYMENT_PLAN.md` for GitHub + Vercel + Supabase setup.

## Notes
This repository contains personal family data. Keep it private.

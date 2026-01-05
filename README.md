# Ha Family Table

<img src="frontend/public/ha_family_logo.png" alt="Ha Family Table" width="520" />

A personal family meal planner that manages recipes, weekly plans, and shopping lists.

## Features
- Weekly plan with breakfast/lunch/dinner, locks, and completion tracking.
- Recipe library with YouTube sources, multilingual content, and editable details.
- Shopping list aggregation with saved buy-list snapshots.
- Magic-link sign-in with a family email allowlist.

## Project Structure
- `frontend/`: Next.js app (primary UI).
- `data/`: JSON storage (recipes, daily plans, shopping state).
- `scripts/`: recipe collection and plan helpers.
- `supabase/`: database schema for hosted storage.
- `app.py`: legacy Flask UI (optional).

## Getting Started
- Install frontend deps: `cd frontend && npm install`
- Run the app: `npm run dev`
- Optional legacy Flask UI: `python app.py`

## Local Auth Setup
1. Create `frontend/.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_EMAILS=you@example.com,partner@example.com
```

2. In Supabase Auth settings, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<vercel-app>.vercel.app/auth/callback`

3. Start the app and sign in from `/login`.

## Data Migration (Local JSON → Supabase)
1. Configure `frontend/.env.local` (see above).
2. Run the migration:

```bash
cd frontend
node scripts/migrate_to_supabase.mjs
```

Schema reference: `supabase/schema.sql`.

## Data & Configuration
- Recipes live in `data/recipes/*.json`.
- Daily plans live in `data/daily_plans/YYYY-MM-DD.json`.
- App settings live in `data/config.json`.

## Deployment
See `DEPLOYMENT_PLAN.md` for GitHub + Vercel + Supabase setup.

## Notes
This repository contains personal family data. Keep it private.

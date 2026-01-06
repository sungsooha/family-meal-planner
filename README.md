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

## Cache Configuration
Client-side cache behavior (SWR) is controlled via `frontend/src/lib/cacheConfig.ts`.
Each value can be overridden with environment variables:

- `NEXT_PUBLIC_SWR_DEDUPING_INTERVAL` (ms, default: 300000)
  - Collapses repeated fetches for the same key within this window.
  - Increase to reduce network chatter when navigating frequently.
- `NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS` (`true`/`false`, default: false)
  - When true, SWR refetches data whenever the tab regains focus.
  - Good for collaborative scenarios; can increase auth/API traffic.
- `NEXT_PUBLIC_SWR_REVALIDATE_ON_RECONNECT` (`true`/`false`, default: false)
  - When true, SWR refetches after the browser reconnects to the network.
  - Useful for flaky connections; off by default to reduce noise.
- `NEXT_PUBLIC_SWR_KEEP_PREVIOUS_DATA` (`true`/`false`, default: true)
  - Keeps previous data visible while new data loads.
  - Improves UI stability at the cost of briefly showing stale data.

Server-side auth cache (proxy) is controlled via `frontend/src/lib/serverCacheConfig.ts`:

- `AUTH_CACHE_TTL_MS` (ms, default: 300000)
  - Caches the result of `supabase.auth.getUser()` per session.
  - Increase to cut `/auth/v1/user` volume; lower to enforce faster revocation.

### Recommended settings
| Environment | Deduping (ms) | Focus revalidate | Reconnect revalidate | Auth cache TTL (ms) |
| --- | --- | --- | --- | --- |
| Local dev | 30000 | false | false | 60000 |
| Production | 300000 | false | false | 300000 |

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

# Deployment Plan: GitHub + Vercel + Supabase

## 1) GitHub Repo Setup
1. Initialize git in the repo root:
   - `git init`
2. Create a private GitHub repo (e.g., `ha-family-table`).
3. Add remote and push:
   - `git remote add origin <github_repo_url>`
   - `git add . && git commit -m "chore: initial commit"`
   - `git push -u origin main`

## 2) Supabase Setup (Database + Auth)
1. Create a new Supabase project.
2. In **Project Settings → API**, note:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `Anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `Service role key` → `SUPABASE_SERVICE_ROLE_KEY`
3. Enable email magic link auth in **Authentication → Providers**.
4. Set **Site URL** to your Vercel URL (later) and add **Redirect URLs**:
   - `https://<vercel-app>.vercel.app/auth/callback`
5. Create tables (recipes, recipe_sources, daily_plans, shopping_state, buy_lists, config).
   - If you add a SQL schema file, run it in **SQL Editor**.
6. Optional: set RLS policies or use service role for server-only writes.

## 3) Vercel Setup (Hosting)
1. Import the GitHub repo into Vercel.
2. Set **Root Directory** to `frontend/`.
3. Add environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Any other required vars
4. Deploy and copy the public URL.
5. Add the Vercel URL to Supabase **Site URL** and **Redirect URLs**.

## 4) Auth & Allowlist
1. Decide which emails are allowed (family emails).
2. Implement allowlist check in `frontend/middleware.ts`.
3. Confirm login page uses magic link flow and redirects to `/auth/callback`.

## 5) Data Migration (Local JSON → Supabase)
1. Add a migration script to read `data/` JSON and insert into Supabase.
2. Run locally after setting env vars in `.env`.
3. Verify recipes, daily plans, and shopping state in Supabase dashboard.

## 6) Ongoing Workflow
- Development: `cd frontend && npm run dev`
- Deployments: push to `main` → Vercel auto-deploys.
- Database updates: use Supabase SQL editor or migration scripts.

## Checklist
- [ ] GitHub repo created and pushed
- [ ] Supabase project created
- [ ] Tables created (schema loaded)
- [ ] Env vars set in Vercel
- [ ] Auth redirect URL configured
- [ ] Migration script run
- [ ] App accessible and login verified

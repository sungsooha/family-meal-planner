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
4. Set **Site URL** to your Vercel URL (production default) and add **Redirect URLs**:
   - `https://<vercel-app>.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (local dev)
5. Create tables (recipes, recipe_sources, daily_plans, shopping_state, buy_lists, config).
   - Run `supabase/schema.sql` in **SQL Editor** (Supabase dashboard).
   - RLS is off by default in this schema; enable policies later if needed.
6. Optional: set RLS policies or use service role for server-only writes.

## 3) Vercel Setup (Hosting)
1. Import the GitHub repo into Vercel.
2. Set **Root Directory** to `frontend/`.
3. Configure build settings:
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
4. Add environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_EMAILS` (comma-separated allowlist, optional)
   - Any other required vars
5. Deploy and copy the public URL.
6. Add the Vercel URL to Supabase **Site URL** and **Redirect URLs** (localhost stays allowed).

## 4) Auth & Allowlist
1. Decide which emails are allowed (family emails).
2. Set `ALLOWED_EMAILS` (comma-separated) in local `.env.local` and Vercel env vars.
3. Allowlist is enforced in `frontend/src/proxy.ts` and `frontend/src/app/api/auth/request-link/route.ts`.
4. Confirm login page uses magic link flow and redirects to `/auth/callback`.

## 4.1) Auth Redirect Notes
- **Site URL** only accepts one value; keep it as production.
- Local dev works because the app passes `redirectTo=http://localhost:3000/auth/callback`, which must be in **Redirect URLs**.

## 5) Data Migration (Local JSON → Supabase)
1. Use the migration script in `frontend/scripts/migrate_to_supabase.mjs`.
2. Run locally after setting env vars in `.env` or `.env.local`:
   - `cd frontend`
   - `node scripts/migrate_to_supabase.mjs`
3. Verify recipes, daily plans, and shopping state in Supabase dashboard.

## 6) Ongoing Workflow
- Development: `cd frontend && npm run dev`
- Deployments: push to `main` → Vercel auto-deploys.
- Database updates: use Supabase SQL editor or migration scripts.

## Post-Deploy Smoke Test
1. Visit the Vercel URL and confirm it redirects to `/login`.
2. Sign in with an allowlisted email and confirm redirect back to `/`.
3. Check `/recipes` and `/shopping` load data.
4. Click a recipe and confirm details + video render.
5. Create a buy list snapshot from Shopping and confirm it appears in `/shopping/saved`.

## Checklist
- [x] GitHub repo created and pushed
- [x] Supabase project created
- [x] Tables created (schema loaded)
- [ ] Env vars set in Vercel
- [ ] Auth redirect URL configured
- [x] Migration script run
- [ ] App accessible and login verified

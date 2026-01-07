# Frontend Migration (Next.js + Tailwind + shadcn/ui)

## Goal
Modernize the UI using Next.js with Tailwind and shadcn/ui while keeping the current Python backend and local JSON storage during the transition.

## Prerequisites
- Node.js 20+ (includes npm)

## Bootstrap the app (run from repo root)
1) Install Node (if not installed):
   - macOS (Homebrew): `brew install node`
2) Scaffold Next.js:
   - `npx create-next-app@latest frontend --ts --eslint --tailwind --app --src-dir --use-npm --no-import-alias`
3) Initialize shadcn/ui:
   - `cd frontend`
   - `npx shadcn-ui@latest init`

## Suggested first screens
- Weekly plan view
- Recipe detail drawer
- Shopping list (two-pane)

## Data approach (for now)
- Read JSON from the existing Python app or mock with local JSON files.
- Persist shopping list state in localStorage (or keep using `data/shopping_list.json` via API later).

## Next steps (when ready)
- Add API routes or a small backend proxy to read/write:
  - `data/weekly_plan.json`
  - `data/recipes/*.json`
  - `data/shopping_list.json`
- Replace Flask templates with Next.js pages.

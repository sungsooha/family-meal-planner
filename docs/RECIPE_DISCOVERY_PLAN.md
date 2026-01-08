# Recipe Discovery Plan (No Paid LLM)

## Goal
Make manual recipe upload easier by searching the web for recipes using a name, extracting structured data, ranking candidates, and letting the user pick/edit.

## Proposed Flow
1) User enters a recipe name.
2) Backend search (MCP web search) for recipe pages matching the name.
3) Extract structured data from each candidate:
   - Prefer `application/ld+json` with `@type: "Recipe"`.
   - Capture: title, ingredients, instructions, servings, image, source URL.
4) Rank candidates:
   - Title similarity to query (exact/partial match).
   - Presence of ingredients + instructions.
   - Source quality (whitelist boost).
5) UI shows a short list (5–10) with title + thumbnail + source.
6) User selects a recipe; form is prefilled.
7) User edits and saves.

## MCP Web Search
Use MCP web search as the search backend:
- Input: query string (recipe name + “recipe”).
- Output: list of candidate URLs.
- Then fetch each URL and parse JSON‑LD.

## YouTube Strategy
YouTube is preferred but often missing ingredients/instructions in text:
- Still allow YouTube URLs as candidates.
- If video has a description with ingredients/instructions, parse it.
- Otherwise, show the video with a “Paste recipe text” helper and keep manual edit.

## Alternative Search Backends (Korean-friendly)
Option 1) YouTube Data API (recommended)
- Pros: great Korean recipe coverage, thumbnails, stable results.
- Cons: requires Google API key + quota.
- Env: `YOUTUBE_API_KEY`

### YouTube API Key Setup (Quick Steps)
1) Go to Google Cloud Console: https://console.cloud.google.com/
2) Create a project (or reuse one).
3) Enable **YouTube Data API v3**.
4) Create an API key (Credentials → Create Credentials → API key).
5) Add to `frontend/.env.local`:
   ```
   YOUTUBE_API_KEY=your_key_here
   ```

### MCP Search Provider vs. Next.js API
- For this project, the Next.js API route (`/api/recipes/search`) acts as the search backend.
- `MCP_WEB_SEARCH_URL` is only needed if you want an external MCP search provider.
- If `MCP_WEB_SEARCH_URL` is not set, we fall back to YouTube search.

Option 2) Naver/Daum Search API
- Pros: Korean blog/recipe coverage.
- Cons: requires API keys + server proxy work.

## Data to Store
- `source_url` (for provenance)
- `thumbnail_url` (from JSON‑LD image or YouTube thumbnail)
- `name_original` if original language detected

## Incremental Implementation Plan
Phase 1
- Add backend MCP search endpoint.
- Parse JSON‑LD recipes for structured data.
- Add UI: search box + candidate list + prefill manual form.

Phase 2
- Add site whitelist/blacklist + relevance scoring tweaks.
- Add YouTube description parsing + fallback UI.
- Optional: cache search results (short TTL).

## Open Questions
- Which recipe sites to prioritize?
- Any language preference default?
- Should we auto‑translate if JSON‑LD language is not English?

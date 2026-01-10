# Recommendation System Design

## Goals
- Generate daily/weekly plans that balance family feedback, recency, and variety.
- Support preferences (meal type, cuisine, avoid list, novelty ratio).
- Optionally bring in new recipes via YouTube + Gemini.

## Inputs
- Plan history (daily_plans + completed flags).
- Family feedback (recipes.family_feedback).
- Preferences (config value).
- Recipe metadata (meal_types, cuisine tags if added later).
- Timezone setting (for daily generation at local midnight).

## Scoring (baseline)
- like_score: thumbs up/down aggregate per recipe.
- recency_score: prefer recipes not used recently.
- repeat_penalty: respect max_repeat_per_week.

## Pipeline Options
1) Local-only planner: rank existing recipes, fill slots with constraints.
2) Hybrid (recommended):
   - Rank existing recipes.
   - Ask Gemini for new recipe ideas based on preferences + liked items.
   - Search YouTube for each idea.
   - Merge and re-rank; fill remaining slots.

## Flow (ASCII)
```
Preferences + History + Feedback
              |
              v
      Local Recipe Scoring
              |
     +--------+--------+
     |                 |
     v                 v
Existing Picks     Gemini Ideas
     |                 |
     |           YouTube Search
     |                 |
     +--------+--------+
              v
        Merge & Rank
              |
        Weekly Plan
              |
      Save + UI Review
```

## LLM Prompt Output
- JSON list of ideas: { title, cuisine, meal_types, keywords, reason, confidence }.
- Titles must be YouTube-search friendly and short.

## YouTube Filtering
- Prefer longer videos (not Shorts) when include_shorts is false.
- Score by title match, channel quality (future), and recipe keywords.
- Cache results by query to reduce API usage.
- Optional medium-cost upgrade: fetch stats (views/likes/comments) for top N search results only.

### YouTube Selection Flow
```
Idea Title/Keywords
       |
       v
  YouTube Search
       |
       v
  Low-cost Rank
  (title match,
   keywords,
   shorts filter)
       |
   Top N results
       |
   +---+---+
   |       |
   v       v
Use now  (Optional)
         Stats fetch
         (views/likes)
             |
             v
         Re-rank
```

## Constraints
- No duplicate in same day.
- max_repeat_per_week.
- Respect locked meals.
- Leave blank when insufficient inventory.

## UI
- New “Generate with recommendations” button (daily/weekly).
- Recommendation reason is shown only inside the recommendation modal.

## Daily Recommendations UX (Proposed)
- Generate on demand via a “Generate daily recommendations” button.
- Show a dedicated “Daily” chip alongside past-day chips.
- Clicking chip opens a modal with:
  - Top row: date chips for each daily batch
  - Each item: meal type (guidance only), natural-language reason, Accept / Discard
  - Accept flow: choose target date + meal (breakfast/lunch/dinner), then add to local recipes
- Old batches auto-expire once max chips exceeded or after N days.

### Defaults (Proposed)
- Max daily chips: 3
- Auto-expire after: 7 days
- Store as recommendation_runs + recommendation_candidates with `source=daily`
- Default daily candidates: 6 (3 local + 3 new)

### Daily Recommendations Flow (ASCII)
```
00:00 daily job
      |
      v
 Generate daily ideas
      |
      v
  Save daily batch
      |
      v
  "Daily" chip appears
      |
      v
   Open modal
      |
   +--+--+--+
   | date chips |
   +--+--+--+
      |
      v
  Recommendation cards
 (meal type + reason)
      |
   +--+--+
   |Accept|
   |Discard|
   +--+--+
      |
      v
 Accept -> choose date/meal -> add recipe -> assign to plan
 Discard -> remove from batch
```

## Phased Implementation
1) Local-only scorer + planner.
2) Preference UI and config storage.
3) Gemini idea generation + YouTube search merge.
4) Snapshot runs + analytics.

## Daily Recommendations Implementation Plan
1) Data layer
   - Add config defaults (max chips, expiration days).
   - Store daily batches in recommendation_runs + recommendation_candidates.
   - v1 simplification: store daily batches under config (single JSON) before adding tables.
2) Generator
   - On-demand generation with a last_run guard.
   - Use local scoring + optional Gemini/YouTube.
3) UI
   - “Daily” chip in plan view.
   - Modal with date chips and recommendation cards.
   - Accept -> add recipe -> assign to selected day/meal.
   - Discard -> remove candidate.
4) Limits & cleanup
   - Auto-expire old batches by date/limit.
   - Remove discarded items on save.
   - Keep accepted candidates for metrics.

### Suggested API Routes
- `POST /api/recommendations/daily/run`
  - Input: { date, force?: boolean }
  - Output: { run_id, created, candidates }
- `GET /api/recommendations/daily`
  - Output: { runs: [{ id, date, candidates }] }
- `POST /api/recommendations/daily/:runId/accept`
  - Input: { candidate_id, target_date, meal }
  - Output: { ok, recipe_id }
- `POST /api/recommendations/daily/:runId/discard`
  - Input: { candidate_id }
  - Output: { ok }

### Data Shapes (Candidate)
```
{
  id: string,
  run_id: string,
  source: "local" | "gemini" | "youtube",
  title: string,
  source_url?: string,
  recipe_id?: string,
  meal_types?: string[],
  keywords?: string[],
  reason?: string,
  score?: number,
  rank?: number,
  status?: "new" | "accepted" | "discarded"
}
```

### Notes
- Daily generator can be triggered lazily on page load if last run < today.
- Accept flow should insert into recipes only if the source is new; otherwise link to the existing recipe.
- Mark accepted recipes with a recommendation flag and source run id.
- Track acceptance rate and post-cook feedback rate over a period.
- If generation fails (quota/API/runtime), return no recommendations with a clear reason message.
- If new candidates are unavailable, fill the batch with local-only picks and mark the run as local-only.

## Metrics (Future)
- Acceptance rate: accepted / total candidates in period.
- Cooked rate: cooked accepted / accepted in period.
- Feedback rate: feedback provided / cooked accepted.

## Data Schema Updates (Proposed)
- recipes: add recommendation metadata
  - `recommended_source` (text)
  - `recommended_run_id` (text)
  - `recommended_at` (timestamptz)
- recommendation_runs:
  - add `timezone` (text) and `generated_at` (timestamptz)
- recommendation_candidates:
  - add `keywords` (jsonb), `rank` (int), `status` (text)

## Config Keys (Proposed)
- `daily_reco_enabled` (bool)
- `daily_reco_max_chips` (int)
- `daily_reco_expire_days` (int)
- `daily_reco_candidates` (int)
- `daily_reco_new_ratio` (float)

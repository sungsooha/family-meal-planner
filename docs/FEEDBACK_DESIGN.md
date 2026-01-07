# Family Feedback Design

## Goal
Collect lightweight per-person feedback for each recipe using thumbs up/down (neutral by default).

## Data Model (Simple, No History)
Store feedback directly on each recipe JSON.

```json
"family_feedback": {
  "dad": 1,
  "mom": 0,
  "daughter_5": 1,
  "daughter_2": -1
}
```

Rating values:
- `1` = thumbs up
- `0` = neutral (default / no input)
- `-1` = thumbs down

## Family Member IDs and Labels
Add members to the app config (currently stored in `data/config.json` for local JSON mode, or the `config` table in Supabase mode):

```json
"family_members": [
  { "id": "dad", "label": "Dad" },
  { "id": "mom", "label": "Mom" },
  { "id": "daughter_5", "label": "Daughter (5)" },
  { "id": "daughter_2", "label": "Daughter (2)" }
]
```

### ID Rules
- Lowercase, snake_case (letters, numbers, underscores only).
- Stable (do not change once assigned).
- Use role-based IDs for adults, age-based for kids.

## UI Placement
Show a small feedback row per family member:
- Recipe detail page.
- Plan view drawer (optional, later).

Each row shows:
- Member label
- Three buttons: thumbs down / neutral / thumbs up

## API / Persistence
Reuse existing `PUT /api/recipes/[id]` to update:
- `family_feedback` field on each recipe

Supabase: `recipes.family_feedback` (jsonb)

## Future Extensions
- Optional history (date-based feedback).
- Tags (e.g., spicy, kid-friendly).
- Weekly recap view.

## TODO
- Add a small UI to edit app configuration (family members, family size, repeat rules).

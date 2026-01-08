# Cache Behavior Notes

## Current Strategy (Hybrid)
### Server/API
- API responses use short CDN cache: `s-maxage=5, stale-while-revalidate=60`.
- Key endpoints:
  - `/api/recipes` and `/api/recipes?view=summary` use the shared cache headers.
  - `/api/plan` and `/api/plan/dates` also use shared cache headers.

### Client (SWR)
- Most lists use SWR with a long `dedupingInterval`.
- Plan view explicitly enables revalidation on focus/reconnect.
- Optimistic UI updates are applied immediately for create/edit flows.

### Optimistic Merge
- Newly added recipes are stored in `sessionStorage` (key: `optimisticRecipes`).
- The list merges optimistic entries into fetched results to avoid “disappearing” items during cache lag.
- Optimistic entries are pruned once the API returns them.
- TTL: 5 minutes, max 10 entries.

## Why This Helps
- Fast UI (optimistic updates) + short server cache (reduces stale data).
- Prevents the “added recipe disappears after navigation” symptom.

## Known Edge Cases
- Multi-device edits: another device’s updates may appear after the cache window or focus revalidate.
- Deletes from another device can linger until revalidate (no optimistic delete yet).
- If the API is down, optimistic entries may stay visible until TTL expires.

## Possible Improvements
1) **Supabase Realtime**
   - Push changes to all clients instantly.
2) **SWR Focus + Polling**
   - Add an optional short polling interval for plan/recipes.
3) **Optimistic Delete/Update Registry**
   - Track removals/edits in session storage to reduce flicker.
4) **Server-side ETags**
   - Use ETag + conditional requests to cut payload size.
5) **Conflict Resolution**
   - Compare `updated_at` timestamps to pick latest on merge.

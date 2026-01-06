# Optimization Ideas

## Caching & Data Reuse
- [x] Seed recipe detail cache from the recipe list so `/recipes/[id]` can render instantly.
- [x] Provide a shared `useRecipes()` hook that exposes a cached list + `recipesById` map.
- [x] Warm cache on hover for recipe cards to make detail navigation instantaneous.

## Image & Asset Loading
- [x] Use `next/image` (or consistent `loading="lazy"`) for thumbnails.
- [x] Reuse browser cache by keeping thumbnail URLs stable (avoid query churn).

## API & Network
- [x] Add cache headers to API responses (`s-maxage` + `stale-while-revalidate`) to reduce cold-start latency.
- [x] Consider lightweight response shape for list vs detail endpoints.

## UX Perceived Performance
- [x] Skeleton loaders for first-time loads (plan, recipes, shopping).
- Preserve list scroll and focus state between navigations.
- Enable revalidate-on-focus to refresh cross-device updates. (implemented)

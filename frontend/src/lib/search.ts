const SOURCE_BOOST: Record<string, number> = {
  "allrecipes.com": 2,
  "bbcgoodfood.com": 2,
  "seriouseats.com": 2,
  "foodnetwork.com": 1,
  "thekitchn.com": 1,
  "youtube.com": 1,
  "youtu.be": 1,
};

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function scoreTitleQueryMatch(title: string, query: string, host?: string): number {
  const normalizedTitle = title.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (!normalizedTitle || !normalizedQuery) return 0;
  let score = 0;
  if (normalizedTitle.includes(normalizedQuery)) score += 5;
  normalizedQuery.split(" ").forEach((token) => {
    if (token && normalizedTitle.includes(token)) score += 1;
  });
  if (host) {
    score += SOURCE_BOOST[host] ?? 0;
  }
  return score;
}

export function scoreRecipeMatch(
  query: string,
  recipe: { name?: string; name_original?: string | null; notes?: string | null; meal_types?: string[] },
): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const name = (recipe.name ?? "").toLowerCase();
  const original = (recipe.name_original ?? "").toLowerCase();
  const notes = (recipe.notes ?? "").toLowerCase();
  const mealTypes = Array.isArray(recipe.meal_types) ? recipe.meal_types.join(" ").toLowerCase() : "";
  let score = 0;
  if (name.includes(normalized) || original.includes(normalized)) score += 6;
  for (const token of tokens) {
    if (name.includes(token)) score += 3;
    if (original.includes(token)) score += 3;
    if (notes.includes(token)) score += 1;
    if (mealTypes.includes(token)) score += 1;
  }
  return score;
}

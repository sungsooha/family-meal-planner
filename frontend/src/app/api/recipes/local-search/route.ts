import { NextResponse } from "next/server";
import { getRecipes } from "@/lib/data";
import { getSupabaseAdmin, isSupabaseEnabled } from "@/lib/supabase";
import { jsonWithCache } from "@/lib/cache";

type LocalResult = {
  recipe_id: string;
  name: string;
  name_original?: string | null;
  source_url?: string | null;
  thumbnail_url?: string | null;
};

function scoreRecipe(query: string, recipe: any) {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") ?? "").trim();
  if (!query) {
    return jsonWithCache([]);
  }
  const limit = Math.min(10, Math.max(1, Number(searchParams.get("limit") ?? 8)));

  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("recipes")
      .select("recipe_id,name,name_original,source_url,thumbnail_url,notes,meal_types")
      .or(`name.ilike.%${query}%,name_original.ilike.%${query}%,notes.ilike.%${query}%`)
      .limit(limit);
    if (error || !data) {
      return jsonWithCache([]);
    }
    const scored = data
      .map((row) => ({
        recipe: row,
        score: scoreRecipe(query, row),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.recipe)
      .slice(0, limit);
    const results: LocalResult[] = scored.map((row) => ({
      recipe_id: row.recipe_id,
      name: row.name,
      name_original: row.name_original ?? null,
      source_url: row.source_url ?? null,
      thumbnail_url: row.thumbnail_url ?? null,
    }));
    return jsonWithCache(results);
  }

  const recipes = await getRecipes();
  const scored = recipes
    .map((recipe) => ({
      recipe,
      score: scoreRecipe(query, recipe),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.recipe)
    .slice(0, limit);

  const results: LocalResult[] = scored.map((recipe) => ({
    recipe_id: recipe.recipe_id,
    name: recipe.name,
    name_original: recipe.name_original ?? null,
    source_url: recipe.source_url ?? null,
    thumbnail_url: recipe.thumbnail_url ?? null,
  }));
  return jsonWithCache(results);
}

import { NextResponse } from "next/server";
import { getRecipes } from "@/lib/data";
import { getSupabaseAdmin, isSupabaseEnabled } from "@/lib/supabase";
import { jsonWithCache } from "@/lib/cache";
import type { LocalRecipeResult, LocalSearchResponse } from "@/lib/types";
import { scoreRecipeMatch } from "@/lib/search";

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
        score: scoreRecipeMatch(query, row),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.recipe)
      .slice(0, limit);
    const results: LocalRecipeResult[] = scored.map((row) => ({
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
      score: scoreRecipeMatch(query, recipe),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.recipe)
    .slice(0, limit);

  const results: LocalRecipeResult[] = scored.map((recipe) => ({
    recipe_id: recipe.recipe_id,
    name: recipe.name,
    name_original: recipe.name_original ?? null,
    source_url: recipe.source_url ?? null,
    thumbnail_url: recipe.thumbnail_url ?? null,
  }));
  return jsonWithCache(results);
}

import { NextResponse } from "next/server";
import { addRecipe, getRecipeSourceById, getRecipes } from "@/lib/data";
import { jsonWithCache } from "@/lib/cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const recipes = await getRecipes();
  const enriched = await Promise.all(
    recipes.map(async (recipe) => {
      const source = await getRecipeSourceById(recipe.recipe_id);
      return {
        ...recipe,
        thumbnail_url: recipe.thumbnail_url ?? source?.thumbnail_url ?? null,
      };
    }),
  );
  if (view === "summary") {
    const summary = enriched.map((recipe) => ({
      recipe_id: recipe.recipe_id,
      name: recipe.name,
      name_original: recipe.name_original ?? null,
      meal_types: recipe.meal_types ?? [],
      meal_type: recipe.meal_type ?? null,
      servings: recipe.servings ?? null,
      source_url: recipe.source_url ?? null,
      thumbnail_url: recipe.thumbnail_url ?? null,
      notes: recipe.notes ?? null,
      family_feedback_score: recipe.family_feedback_score ?? null,
      family_feedback: recipe.family_feedback ?? null,
    }));
    return jsonWithCache(summary);
  }
  return jsonWithCache(enriched);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const result = await addRecipe(payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Unable to add recipe." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

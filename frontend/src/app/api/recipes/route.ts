import { NextResponse } from "next/server";
import { addRecipe, getRecipeSourceById, getRecipes } from "@/lib/data";

export async function GET() {
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
  return NextResponse.json(enriched);
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

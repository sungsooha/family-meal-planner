import { NextResponse } from "next/server";
import {
  getRecipeById,
  getRecipeSourceById,
  getWeeklyPlanForDate,
  listDailyPlans,
  saveDailyPlan,
  updateRecipe,
} from "@/lib/data";
import { getYouTubeId } from "@/lib/youtube";
import { computeShoppingList, syncShoppingState } from "@/lib/shopping";
import { jsonWithCache } from "@/lib/cache";
import type { RecipeDetailResponse, RecipeUpdateRequest, RecipesCreateResponse } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) {
    return NextResponse.json<RecipesCreateResponse>(
      { ok: false, error: "Recipe not found." },
      { status: 404 },
    );
  }
  const source = await getRecipeSourceById(id);
  let thumbnailUrl = recipe.thumbnail_url ?? source?.thumbnail_url ?? null;
  if (!thumbnailUrl && recipe.source_url) {
    const videoId = getYouTubeId(recipe.source_url);
    if (videoId) {
      thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }
  return jsonWithCache({
    ...recipe,
    source_url: recipe.source_url ?? source?.source_url ?? null,
    thumbnail_url: thumbnailUrl,
    name_original: recipe.name_original ?? null,
    source_title: source?.title ?? null,
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as RecipeUpdateRequest | null;
  if (!payload) {
    return NextResponse.json<RecipesCreateResponse>(
      { ok: false, error: "Invalid payload." },
      { status: 400 },
    );
  }
  const success = await updateRecipe(id, payload);
  if (!success) {
    return NextResponse.json<RecipesCreateResponse>(
      { ok: false, error: "Recipe not found." },
      { status: 404 },
    );
  }
  const dailyPlans = await listDailyPlans();
  for (const day of dailyPlans) {
    let updated = false;
    Object.entries(day.meals).forEach(([mealKey, mealValue]) => {
      if (mealValue && mealValue.recipe_id === id) {
        day.meals[mealKey] = {
          recipe_id: id,
          locked: mealValue.locked ?? false,
          completed: mealValue.completed ?? false,
        };
        updated = true;
      }
    });
    if (updated) {
      await saveDailyPlan(day);
    }
  }
  if (dailyPlans.length) {
    const today = new Date().toISOString().split("T")[0];
    const currentWeek = await getWeeklyPlanForDate(today);
    const weeklyEn = await computeShoppingList(currentWeek, "en");
    await syncShoppingState(weeklyEn, "en");
    const weeklyOriginal = await computeShoppingList(currentWeek, "original");
    await syncShoppingState(weeklyOriginal, "original");
  }
  return NextResponse.json<RecipesCreateResponse>({ ok: true });
}

import { NextResponse } from "next/server";
import { getWeeklyPlanForDate, getRecipeById } from "@/lib/data";
import { assignMeal } from "@/lib/plan";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const { date, meal, recipe_id: recipeId, start_date: startDate } = payload as {
    date?: string;
    meal?: string;
    recipe_id?: string;
    start_date?: string;
  };
  if (!date || !meal || !recipeId) {
    return NextResponse.json({ error: "Missing payload fields." }, { status: 400 });
  }
  const plan = await getWeeklyPlanForDate(startDate ?? date);
  const recipe = await getRecipeById(recipeId);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  }
  const updated = await assignMeal(plan, date, meal, recipe);
  return NextResponse.json(updated);
}

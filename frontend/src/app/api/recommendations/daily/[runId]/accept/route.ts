import { NextResponse } from "next/server";
import {
  addRecipe,
  getDailyRecommendations,
  saveDailyRecommendations,
  getRecipeById,
  getRecipeBySourceUrl,
  getWeeklyPlanForDate,
  updateRecipe,
} from "@/lib/data";
import { assignMeal } from "@/lib/plan";
import { parseIngredients, parseInstructions } from "@/lib/recipeForm";

type Params = { params: Promise<{ runId: string }> };

type AutoFillResult = {
  attempted: boolean;
  ok: boolean;
  model?: string;
  cached?: boolean;
  error?: string;
};

async function tryAutoFillRecipe(recipe: any, request: Request): Promise<AutoFillResult> {
  if (!recipe?.source_url) {
    return { attempted: false, ok: false, error: "Missing source URL." };
  }
  try {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/recipes/prefill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_url: recipe.source_url }),
    });
    const payload = await response.json().catch(() => ({}));
    const model = payload?.model ? String(payload.model) : undefined;
    const cached = Boolean(payload?.cached);
    if (!response.ok) {
      return {
        attempted: true,
        ok: false,
        model,
        cached,
        error: payload?.error ?? "Auto-fill failed.",
      };
    }
    const prefill = payload?.prefill;
    if (!prefill) {
      return { attempted: true, ok: false, model, cached, error: "Auto-fill returned no data." };
    }
    const patch: any = { ...recipe };
    if (!patch.name_original && prefill.name_original) patch.name_original = prefill.name_original;
    if ((!patch.meal_types || patch.meal_types.length === 0) && prefill.meal_types?.length) {
      patch.meal_types = prefill.meal_types;
    }
    if (!patch.servings && prefill.servings) patch.servings = Number(prefill.servings) || prefill.servings;
    if ((!patch.ingredients || patch.ingredients.length === 0) && prefill.ingredients_text) {
      patch.ingredients = parseIngredients(prefill.ingredients_text);
    }
    if (
      (!patch.ingredients_original || patch.ingredients_original.length === 0) &&
      prefill.ingredients_original_text
    ) {
      patch.ingredients_original = parseIngredients(prefill.ingredients_original_text);
    }
    if ((!patch.instructions || patch.instructions.length === 0) && prefill.instructions_text) {
      patch.instructions = parseInstructions(prefill.instructions_text);
    }
    if (
      (!patch.instructions_original || patch.instructions_original.length === 0) &&
      prefill.instructions_original_text
    ) {
      patch.instructions_original = parseInstructions(prefill.instructions_original_text);
    }
    if (!patch.thumbnail_url && prefill.thumbnail_url) patch.thumbnail_url = prefill.thumbnail_url;
    await updateRecipe(recipe.recipe_id, patch);
    return { attempted: true, ok: true, model, cached };
  } catch {
    return { attempted: true, ok: false, error: "Auto-fill failed." };
  }
}

export async function POST(request: Request, { params }: Params) {
  const debugEnabled = process.env.RECO_DEBUG === "1";
  const { runId } = await params;
  const payload = await request.json().catch(() => ({}));
  const candidateId = String(payload?.candidate_id ?? "");
  const targetDate = String(payload?.target_date ?? "");
  const meal = String(payload?.meal ?? "");
  const assign = payload?.assign !== false;
  const startDate = payload?.start_date ? String(payload.start_date) : undefined;

  if (!candidateId || (assign && (!targetDate || !meal))) {
    return NextResponse.json({ error: "Missing payload fields." }, { status: 400 });
  }
  if (debugEnabled) {
    console.log("[daily-reco] accept", { runId, candidateId, targetDate, meal });
  }

  const store = await getDailyRecommendations();
  const run = store.runs.find((entry) => entry.id === runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  const candidate = run.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  let recipeId = candidate.recipe_id;
  if (!recipeId && candidate.source_url) {
    const existing = await getRecipeBySourceUrl(candidate.source_url);
    if (existing) {
      recipeId = existing.recipe_id;
    }
  }
  let recipe = recipeId ? await getRecipeById(recipeId) : null;
  if (!recipe && candidate.source_url) {
    const newRecipeId = crypto.randomUUID().replace(/-/g, "");
    const payload = {
      recipe_id: newRecipeId,
      name: candidate.title,
      meal_types: candidate.meal_types ?? [],
      source_url: candidate.source_url,
      ingredients: [],
      instructions: [],
    };
    const created = await addRecipe(payload as any);
    if (created.ok) {
      recipeId = newRecipeId;
      recipe = await getRecipeById(newRecipeId);
    }
  }
  if (!recipeId || !recipe) {
    return NextResponse.json({ error: "Recipe not found for this recommendation." }, { status: 404 });
  }

  candidate.recipe_id = recipeId;
  candidate.status = "accepted";
  candidate.assignment_status = assign ? "assigned" : "added";
  const autoFill = await tryAutoFillRecipe(recipe, request);
  candidate.autofill_status = autoFill.attempted
    ? autoFill.ok
      ? "success"
      : "failed"
    : "skipped";
  candidate.autofill_model = autoFill.model;
  candidate.autofill_cached = autoFill.cached;
  candidate.autofill_error = autoFill.ok ? undefined : autoFill.error;
  await saveDailyRecommendations(store);

  if (!assign) {
    return NextResponse.json({ ok: true, recipe_id: recipeId, run, autofill: autoFill });
  }

  const plan = await getWeeklyPlanForDate(startDate ?? targetDate);
  const updated = await assignMeal(plan, targetDate, meal, recipe);

  return NextResponse.json({ ok: true, recipe_id: recipeId, plan: updated, run, autofill: autoFill });
}

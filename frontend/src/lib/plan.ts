import { getConfig, getRecipes, saveDailyPlan } from "./data";
import { formatLocalDate } from "./calendar";
import type { Recipe, WeeklyPlan } from "./types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseIsoDate(dateText: string): Date {
  return new Date(`${dateText}T00:00:00`);
}

export function initializePlan(startDate: string): WeeklyPlan {
  const start = parseIsoDate(startDate);
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(start);
    date.setDate(start.getDate() + idx);
    return {
      date: formatLocalDate(date),
      meals: {
        breakfast: null,
        lunch: null,
        dinner: null,
      },
    };
  });
  return { start_date: formatLocalDate(start), days };
}

function mealTypesForRecipe(recipe: Recipe): string[] {
  const types = recipe.meal_types ?? [];
  if (!types.length && recipe.meal_type) return [recipe.meal_type];
  return types;
}

export async function autoGeneratePlan(plan: WeeklyPlan, startDate?: string): Promise<WeeklyPlan> {
  const config = await getConfig();
  const recipes = await getRecipes();
  const maxRepeat = config.max_repeat_per_week ?? 2;

  if (startDate && plan.start_date !== startDate) {
    plan = initializePlan(startDate);
  }

  const byMeal: Record<string, Recipe[]> = { breakfast: [], lunch: [], dinner: [] };
  recipes.forEach((recipe) => {
    mealTypesForRecipe(recipe).forEach((type) => {
      if (byMeal[type]) {
        byMeal[type].push(recipe);
      }
    });
  });

  const usage: Record<string, number> = {};
  plan.days.forEach((day) => {
    MEAL_TYPES.forEach((meal) => {
      const entry = day.meals[meal];
      if (entry?.locked && entry.recipe_id) {
        usage[entry.recipe_id] = (usage[entry.recipe_id] ?? 0) + 1;
      }
    });
  });

  plan.days.forEach((day) => {
    const usedIds = new Set<string>();
    MEAL_TYPES.forEach((meal) => {
      const entry = day.meals[meal];
      if (entry?.locked) {
        if (entry.recipe_id) usedIds.add(entry.recipe_id);
        return;
      }
      const candidates = byMeal[meal] ?? [];
      const available = candidates.filter((recipe) => {
        const count = usage[recipe.recipe_id] ?? 0;
        return count < maxRepeat && !usedIds.has(recipe.recipe_id);
      });
      if (!available.length) {
        day.meals[meal] = null;
        return;
      }
      const choice = shuffle(available)[0];
      usage[choice.recipe_id] = (usage[choice.recipe_id] ?? 0) + 1;
      usedIds.add(choice.recipe_id);
      day.meals[meal] = {
        recipe_id: choice.recipe_id,
        completed: false,
        locked: false,
      };
    });
  });

  for (const day of plan.days) {
    await saveDailyPlan(day);
  }
  return plan;
}

export async function assignMeal(plan: WeeklyPlan, date: string, meal: string, recipe: Recipe): Promise<WeeklyPlan> {
  for (const day of plan.days) {
    if (day.date !== date) continue;
    const used = Object.values(day.meals)
      .filter(Boolean)
      .map((entry) => entry?.recipe_id);
    if (used.includes(recipe.recipe_id)) return plan;
    day.meals[meal] = {
      recipe_id: recipe.recipe_id,
      completed: false,
      locked: false,
    };
    await saveDailyPlan(day);
    break;
  }
  return plan;
}

export async function toggleLock(plan: WeeklyPlan, date: string, meal: string): Promise<WeeklyPlan> {
  for (const day of plan.days) {
    if (day.date !== date) continue;
    const entry = day.meals[meal];
    if (entry) {
      entry.locked = !entry.locked;
    }
    await saveDailyPlan(day);
  }
  return plan;
}

export async function toggleComplete(plan: WeeklyPlan, date: string, meal: string): Promise<WeeklyPlan> {
  for (const day of plan.days) {
    if (day.date !== date) continue;
    const entry = day.meals[meal];
    if (entry) {
      entry.completed = !entry.completed;
    }
    await saveDailyPlan(day);
  }
  return plan;
}

export async function clearMeal(plan: WeeklyPlan, date: string, meal: string): Promise<WeeklyPlan> {
  for (const day of plan.days) {
    if (day.date !== date) continue;
    day.meals[meal] = null;
    await saveDailyPlan(day);
  }
  return plan;
}

export async function lockAll(plan: WeeklyPlan, locked: boolean): Promise<WeeklyPlan> {
  plan.days.forEach((day) => {
    MEAL_TYPES.forEach((meal) => {
      const entry = day.meals[meal];
      if (entry) entry.locked = locked;
    });
  });
  for (const day of plan.days) {
    await saveDailyPlan(day);
  }
  return plan;
}

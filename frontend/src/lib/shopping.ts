import { getConfig, getRecipes, getWeeklyPlanForDate, saveShoppingState, getShoppingState, Recipe, WeeklyPlan } from "./data";

type ShoppingItem = {
  name: string;
  unit: string;
  quantity: number | string;
  recipes_count: number;
  recipe_ids: string[];
  key: string;
};

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  킬로그램: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  밀리리터: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  리터: "l",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  큰술: "tbsp",
  스푼: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  작은술: "tsp",
  t: "tbsp",
  count: "count",
  piece: "count",
  pieces: "count",
  pcs: "count",
  ea: "count",
};

function normalizeUnit(unit?: string): string {
  const key = (unit ?? "").trim().toLowerCase();
  return UNIT_ALIASES[key] ?? key;
}

function normalizeQuantityUnit(quantity: number, unit: string): [number, string] {
  const normalized = normalizeUnit(unit);
  if (normalized === "kg") return [quantity * 1000, "g"];
  if (normalized === "l") return [quantity * 1000, "ml"];
  if (normalized === "tsp") return [quantity / 3, "tbsp"];
  return [quantity, normalized];
}

function unitGroup(unit: string): string {
  if (unit === "g") return "weight";
  if (unit === "ml") return "volume";
  if (unit === "tbsp") return "spoon";
  if (unit === "count" || unit === "") return "count";
  return unit;
}

function roundQuantity(value: number | string): number | string {
  if (typeof value === "number") return Math.round(value * 100) / 100;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return Math.round(parsed * 100) / 100;
}

export function itemKey(name: string, unit: string, language?: string): string {
  if (language) return `${language}|${name}|${unit}`;
  return `${name}|${unit}`;
}

function mealIngredients(recipe: Recipe, language: string): Recipe["ingredients"] {
  if (language === "original") return recipe.ingredients_original ?? recipe.ingredients ?? [];
  return recipe.ingredients ?? recipe.ingredients_original ?? [];
}

export async function computeShoppingList(plan?: WeeklyPlan | null, language = "en"): Promise<ShoppingItem[]> {
  const activePlan = plan ?? (await getWeeklyPlanForDate(new Date().toISOString().split("T")[0]));
  if (!activePlan) return [];

  const config = await getConfig();
  const targetServings = config.family_size ?? 4;
  const recipesById = new Map((await getRecipes()).map((recipe) => [recipe.recipe_id, recipe]));

  const totals: Record<
    string,
    { quantity: number; unit: string; groups: Set<string>; recipes: Set<string>; display_name: string; key_unit: string }
  > = {};

  for (const day of activePlan.days) {
    for (const meal of Object.values(day.meals)) {
      if (!meal || !meal.recipe_id) continue;
      const recipe = recipesById.get(meal.recipe_id);
      const ingredients = recipe ? mealIngredients(recipe, language) : meal.ingredients ?? [];
      const servings = recipe?.servings;
      let scale = 1;
      if (servings) {
        const parsed = Number(servings);
        if (!Number.isNaN(parsed) && parsed > 0) {
          scale = targetServings / parsed;
        }
      }

      for (const ingredient of ingredients) {
        const displayName = ingredient.name;
        if (!displayName) continue;
        const unit = ingredient.unit ?? "";
        let qty = Number(ingredient.quantity ?? 0);
        if (Number.isNaN(qty)) qty = 0;
        qty *= scale;
        let normalizedQty = qty;
        let normalizedUnit = unit;
        [normalizedQty, normalizedUnit] = normalizeQuantityUnit(normalizedQty, normalizedUnit);

        const [_, keyUnit] = normalizeQuantityUnit(1, normalizedUnit);
        const key = itemKey(displayName, keyUnit, language);
        const group = unitGroup(normalizedUnit);

        if (!totals[key]) {
          totals[key] = {
            quantity: 0,
            unit: normalizedUnit,
            groups: new Set([group]),
            recipes: new Set(),
            display_name: displayName,
            key_unit: keyUnit,
          };
        }
        totals[key].quantity += normalizedQty;
        totals[key].groups.add(group);
        if (meal.recipe_id) totals[key].recipes.add(meal.recipe_id);
        if (totals[key].groups.size > 1) {
          totals[key].unit = "mixed";
        }
      }
    }
  }

  return Object.keys(totals)
    .sort()
    .map((key) => {
      const entry = totals[key];
      return {
        name: entry.display_name,
        unit: entry.unit,
        quantity: roundQuantity(entry.quantity),
        recipes_count: entry.recipes.size,
        recipe_ids: Array.from(entry.recipes).sort(),
        key,
      };
    });
}

export async function syncShoppingState(weeklyItems: ShoppingItem[], language?: string) {
  const state = await getShoppingState();
  if (!weeklyItems.length) return state;
  const weeklyKeys = new Set(weeklyItems.map((item) => itemKey(item.name, item.unit, language)));
  const legacyKeys = new Set(weeklyItems.map((item) => itemKey(item.name, item.unit)));
  const updated: Record<string, typeof state[string]> = {};

  Object.entries(state).forEach(([key, value]) => {
    if (language && value.lang && value.lang !== language) {
      updated[key] = value;
    } else if (value.manual) {
      updated[key] = value;
    } else if (weeklyKeys.has(key) || legacyKeys.has(key)) {
      updated[key] = value;
    }
  });

  if (JSON.stringify(updated) !== JSON.stringify(state)) {
    await saveShoppingState(updated);
  }
  return updated;
}

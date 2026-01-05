import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseEnabled } from "./supabase";

export type Ingredient = {
  name: string;
  quantity: number | string;
  unit: string;
};

export type Recipe = {
  recipe_id: string;
  name: string;
  meal_types?: string[];
  meal_type?: string;
  servings?: number;
  source_url?: string | null;
  thumbnail_url?: string | null;
  notes?: string;
  family_feedback_score?: number;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};

export type Meal = {
  recipe_id?: string;
  name?: string;
  ingredients?: Ingredient[];
  source_url?: string | null;
  meal_types?: string[];
  completed?: boolean;
  locked?: boolean;
} | null;

export type WeeklyPlan = {
  start_date: string;
  days: Array<{ date: string; meals: Record<string, Meal> }>;
};

export type DailyPlan = {
  date: string;
  meals: Record<string, Meal>;
};

export type ShoppingStateItem = {
  name: string;
  unit: string;
  quantity: string | number;
  manual?: boolean;
  lang?: string;
};

export type BuyListItem = {
  name: string;
  unit: string;
  quantity: string | number;
  key?: string;
};

export type BuyList = {
  id: string;
  week_start: string;
  week_end: string;
  saved_at: string;
  status: "open" | "locked";
  lang: string;
  items: BuyListItem[];
};

const DATA_DIR = path.resolve(process.cwd(), "..", "data");
const RECIPES_DIR = path.join(DATA_DIR, "recipes");
const RECIPE_SOURCES_DIR = path.join(DATA_DIR, "recipe_sources");
const DAILY_PLANS_DIR = path.join(DATA_DIR, "daily_plans");
const BUY_LISTS_DIR = path.join(DATA_DIR, "buy_lists");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const SHOPPING_FILE = path.join(DATA_DIR, "shopping_list.json");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, payload: T): Promise<void> {
  const data = JSON.stringify(payload, null, 2);
  await fs.writeFile(filePath, data, "utf-8");
}

function normalizeRecipe(recipe: Recipe): Recipe {
  const normalized: Recipe = { ...recipe };
  if (!normalized.recipe_id) {
    normalized.recipe_id = normalized.name?.toLowerCase().replace(/\W+/g, "-") ?? "recipe";
  }
  if (!normalized.meal_types || normalized.meal_types.length === 0) {
    const legacy = normalized.meal_type;
    normalized.meal_types = legacy ? [legacy] : [];
  }
  return normalized;
}

function youtubeIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "");
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/shorts/")[1]?.split("/")[0];
    return null;
  } catch {
    return null;
  }
}

function deriveThumbnailUrl(sourceUrl?: string | null): string | null {
  const id = youtubeIdFromUrl(sourceUrl);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

export async function getRecipes(): Promise<Recipe[]> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("recipes").select("*").order("name", { ascending: true });
    if (error || !data) return [];
    return data.map((row) => {
      const recipe = recipeFromRow(row);
      if (!recipe.thumbnail_url && recipe.source_url) {
        recipe.thumbnail_url = deriveThumbnailUrl(recipe.source_url);
      }
      return recipe;
    });
  }
  let entries: Recipe[] = [];
  try {
    const files = await fs.readdir(RECIPES_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = await readJson<Recipe>(path.join(RECIPES_DIR, file), null as never);
      if (data) {
        const normalized = normalizeRecipe(data);
        if (!normalized.thumbnail_url && normalized.source_url) {
          const derived = deriveThumbnailUrl(normalized.source_url);
          if (derived) {
            normalized.thumbnail_url = derived;
            await writeJson(path.join(RECIPES_DIR, file), normalized);
          }
        }
        entries.push(normalized);
      }
    }
  } catch {
    entries = [];
  }
  return entries.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function getRecipeById(recipeId: string): Promise<Recipe | null> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("recipes").select("*").eq("recipe_id", recipeId).maybeSingle();
    if (!data) return null;
    const recipe = recipeFromRow(data);
    if (!recipe.thumbnail_url && recipe.source_url) {
      recipe.thumbnail_url = deriveThumbnailUrl(recipe.source_url);
    }
    return recipe;
  }
  const recipes = await getRecipes();
  return recipes.find((recipe) => recipe.recipe_id === recipeId) ?? null;
}

function safeFilename(value: string): string {
  const cleaned = value
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return cleaned || "recipe";
}

export async function addRecipe(payload: Recipe): Promise<{ ok: boolean; error?: string }> {
  if (!payload.recipe_id || !payload.name) {
    return { ok: false, error: "Missing recipe_id or name." };
  }
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const row = recipeToRow(normalizeRecipe(payload));
    const { error } = await admin.from("recipes").insert(row);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
  const existing = await getRecipeById(payload.recipe_id);
  if (existing) {
    return { ok: false, error: "Recipe ID already exists." };
  }
  const files = await fs.readdir(RECIPES_DIR).catch(() => [] as string[]);
  let baseName = safeFilename(payload.name);
  if (!baseName.endsWith(".json")) baseName = `${baseName}.json`;
  let fileName = baseName;
  if (files.includes(fileName)) {
    fileName = `${safeFilename(payload.name)}-${payload.recipe_id.slice(0, 6)}.json`;
  }
  await writeJson(path.join(RECIPES_DIR, fileName), normalizeRecipe(payload));
  return { ok: true };
}

export async function updateRecipe(recipeId: string, payload: Recipe): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const row = recipeToRow(normalizeRecipe(payload));
    const { error } = await admin.from("recipes").update(row).eq("recipe_id", recipeId);
    return !error;
  }
  try {
    const files = await fs.readdir(RECIPES_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(RECIPES_DIR, file);
      const data = await readJson<Recipe>(filePath, null as never);
      if (data && data.recipe_id === recipeId) {
        const normalized = normalizeRecipe(payload);
        if (!normalized.thumbnail_url && normalized.source_url) {
          normalized.thumbnail_url = deriveThumbnailUrl(normalized.source_url);
        }
        await writeJson(filePath, normalized);
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function parseIsoDate(dateText: string): Date {
  return new Date(`${dateText}T00:00:00`);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function ensureDailyPlansDir(): Promise<void> {
  await fs.mkdir(DAILY_PLANS_DIR, { recursive: true });
}

function dailyPlanPath(date: string): string {
  return path.join(DAILY_PLANS_DIR, `${date}.json`);
}

async function ensureBuyListsDir(): Promise<void> {
  await fs.mkdir(BUY_LISTS_DIR, { recursive: true });
}

function buyListPath(id: string): string {
  return path.join(BUY_LISTS_DIR, `${id}.json`);
}

export async function getDailyPlan(date: string): Promise<DailyPlan | null> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("daily_plans").select("*").eq("date", date).maybeSingle();
    if (!data) return null;
    return {
      date: data.date,
      meals: data.meals ?? {
        breakfast: null,
        lunch: null,
        dinner: null,
      },
    };
  }
  await ensureDailyPlansDir();
  return readJson<DailyPlan | null>(dailyPlanPath(date), null);
}

export async function saveDailyPlan(day: DailyPlan): Promise<void> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    await admin.from("daily_plans").upsert({
      date: day.date,
      meals: day.meals,
      updated_at: new Date().toISOString(),
    });
    return;
  }
  await ensureDailyPlansDir();
  await writeJson(dailyPlanPath(day.date), day);
}

export async function getWeeklyPlanForDate(startDate: string): Promise<WeeklyPlan> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const start = parseIsoDate(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endIso = formatLocalDate(end);
    const { data } = await admin
      .from("daily_plans")
      .select("*")
      .gte("date", startDate)
      .lte("date", endIso);
    const map = new Map<string, DailyPlan>();
    (data ?? []).forEach((row) => {
      map.set(row.date, { date: row.date, meals: row.meals ?? {} });
    });
    const days: WeeklyPlan["days"] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const iso = formatLocalDate(date);
      days.push(
        map.get(iso) ?? {
          date: iso,
          meals: {
            breakfast: null,
            lunch: null,
            dinner: null,
          },
        },
      );
    }
    return { start_date: startDate, days };
  }
  const start = parseIsoDate(startDate);
  const days: WeeklyPlan["days"] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = formatLocalDate(date);
    const stored = await getDailyPlan(iso);
    days.push(
      stored ?? {
        date: iso,
        meals: {
          breakfast: null,
          lunch: null,
          dinner: null,
        },
      },
    );
  }
  return { start_date: startDate, days };
}

export async function listDailyPlans(): Promise<DailyPlan[]> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("daily_plans").select("*").order("date", { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({ date: row.date, meals: row.meals ?? {} }));
  }
  await ensureDailyPlansDir();
  const entries: DailyPlan[] = [];
  const files = await fs.readdir(DAILY_PLANS_DIR);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const data = await readJson<DailyPlan>(path.join(DAILY_PLANS_DIR, file), null as never);
    if (data) entries.push(data);
  }
  return entries;
}

export async function listBuyLists(): Promise<BuyList[]> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("buy_lists").select("*").order("saved_at", { ascending: false });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      week_start: row.week_start,
      week_end: row.week_end,
      saved_at: row.saved_at,
      status: row.status,
      lang: row.lang,
      items: row.items ?? [],
    }));
  }
  await ensureBuyListsDir();
  const entries: BuyList[] = [];
  const files = await fs.readdir(BUY_LISTS_DIR);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const data = await readJson<BuyList>(path.join(BUY_LISTS_DIR, file), null as never);
    if (data) entries.push(data);
  }
  return entries.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

export async function getBuyListById(id: string): Promise<BuyList | null> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("buy_lists").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      week_start: data.week_start,
      week_end: data.week_end,
      saved_at: data.saved_at,
      status: data.status,
      lang: data.lang,
      items: data.items ?? [],
    };
  }
  await ensureBuyListsDir();
  return readJson<BuyList | null>(buyListPath(id), null);
}

export async function saveBuyList(list: BuyList): Promise<void> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    await admin.from("buy_lists").upsert({
      id: list.id,
      week_start: list.week_start,
      week_end: list.week_end,
      saved_at: list.saved_at,
      status: list.status,
      lang: list.lang,
      items: list.items,
    });
    return;
  }
  await ensureBuyListsDir();
  await writeJson(buyListPath(list.id), list);
}

export async function deleteBuyList(id: string): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("buy_lists").delete().eq("id", id);
    return !error;
  }
  await ensureBuyListsDir();
  try {
    await fs.unlink(buyListPath(id));
    return true;
  } catch {
    return false;
  }
}

export async function getConfig(): Promise<{ family_size?: number; max_repeat_per_week?: number }> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("config").select("value").eq("key", "default").maybeSingle();
    if (data?.value) return data.value;
    return { family_size: 4, max_repeat_per_week: 2 };
  }
  return readJson(CONFIG_FILE, { family_size: 4, max_repeat_per_week: 2 });
}

export async function getShoppingState(): Promise<Record<string, ShoppingStateItem>> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("shopping_state").select("*");
    if (error || !data) return {};
    const state: Record<string, ShoppingStateItem> = {};
    data.forEach((row) => {
      state[row.key] = row.data;
    });
    return state;
  }
  return readJson<Record<string, ShoppingStateItem>>(SHOPPING_FILE, {});
}

export async function saveShoppingState(state: Record<string, ShoppingStateItem>): Promise<void> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    await admin.from("shopping_state").delete().neq("key", "");
    const rows = Object.entries(state).map(([key, value]) => ({
      key,
      data: value,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      await admin.from("shopping_state").insert(rows);
    }
    return;
  }
  await writeJson(SHOPPING_FILE, state);
}

export function getWeekStart(targetDate?: Date): Date {
  const date = targetDate ?? new Date();
  return date;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export type RecipeSource = {
  recipe_id: string;
  source: string;
  source_url?: string;
  thumbnail_url?: string;
  title?: string;
  top_comment?: string;
  description?: string;
};

export async function getRecipeSourceById(recipeId: string): Promise<RecipeSource | null> {
  if (isSupabaseEnabled()) {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("recipe_sources")
      .select("*")
      .eq("recipe_id", recipeId)
      .maybeSingle();
    if (!data) return null;
    return {
      recipe_id: data.recipe_id,
      source: data.source ?? "youtube",
      source_url: data.source_url ?? undefined,
      thumbnail_url: data.thumbnail_url ?? undefined,
      title: data.title ?? undefined,
      top_comment: data.top_comment ?? undefined,
      description: data.description ?? undefined,
    };
  }
  try {
    const files = await fs.readdir(RECIPE_SOURCES_DIR);
    const target = files.find((file) => file.startsWith(recipeId) && file.endsWith("_source.json"));
    if (!target) return null;
    return readJson<RecipeSource>(path.join(RECIPE_SOURCES_DIR, target), null as never);
  } catch {
    return null;
  }
}

function recipeFromRow(row: any): Recipe {
  return normalizeRecipe({
    recipe_id: row.recipe_id,
    name: row.name,
    meal_types: row.meal_types ?? [],
    servings: row.servings ?? undefined,
    source_url: row.source_url ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    notes: row.notes ?? undefined,
    family_feedback_score: row.family_feedback_score ?? undefined,
    ingredients: row.ingredients ?? [],
    ingredients_original: row.ingredients_original ?? [],
    instructions: row.instructions ?? [],
    instructions_original: row.instructions_original ?? [],
  });
}

function recipeToRow(recipe: Recipe) {
  return {
    recipe_id: recipe.recipe_id,
    name: recipe.name,
    meal_types: recipe.meal_types ?? [],
    servings: recipe.servings ?? null,
    source_url: recipe.source_url ?? null,
    thumbnail_url: recipe.thumbnail_url ?? null,
    notes: recipe.notes ?? null,
    family_feedback_score: recipe.family_feedback_score ?? null,
    ingredients: recipe.ingredients ?? [],
    ingredients_original: recipe.ingredients_original ?? [],
    instructions: recipe.instructions ?? [],
    instructions_original: recipe.instructions_original ?? [],
    updated_at: new Date().toISOString(),
  };
}

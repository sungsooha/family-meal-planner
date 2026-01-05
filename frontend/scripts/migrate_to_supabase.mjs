import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

const loadEnvFile = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value.replace(/^\"|\"$/g, "");
      }
    });
  } catch {
    // ignore missing env files
  }
};

await loadEnvFile(path.resolve(process.cwd(), ".env.local"));
await loadEnvFile(path.resolve(process.cwd(), ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const resolveDataDir = async () => {
  const cwd = process.cwd();
  const direct = path.resolve(cwd, "data");
  const parent = path.resolve(cwd, "..", "data");
  try {
    await fs.access(direct);
    return direct;
  } catch {
    await fs.access(parent);
    return parent;
  }
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
};

const listJsonFiles = async (dirPath) => {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.filter((entry) => entry.endsWith(".json")).map((entry) => path.join(dirPath, entry));
  } catch {
    return [];
  }
};

const migrateRecipes = async (dataDir) => {
  const recipesDir = path.join(dataDir, "recipes");
  const files = await listJsonFiles(recipesDir);
  if (!files.length) return 0;
  const rows = [];
  for (const file of files) {
    const recipe = await readJson(file);
    if (!recipe?.recipe_id) continue;
    rows.push({
      recipe_id: recipe.recipe_id,
      name: recipe.name,
      meal_types: recipe.meal_types ?? null,
      servings: recipe.servings ?? null,
      source_url: recipe.source_url ?? null,
      thumbnail_url: recipe.thumbnail_url ?? null,
      notes: recipe.notes ?? null,
      family_feedback_score: recipe.family_feedback_score ?? null,
      ingredients: recipe.ingredients ?? null,
      ingredients_original: recipe.ingredients_original ?? null,
      instructions: recipe.instructions ?? null,
      instructions_original: recipe.instructions_original ?? null,
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from("recipes").upsert(rows, { onConflict: "recipe_id" });
  if (error) throw error;
  return rows.length;
};

const migrateRecipeSources = async (dataDir) => {
  const sourcesDir = path.join(dataDir, "recipe_sources");
  const files = await listJsonFiles(sourcesDir);
  if (!files.length) return 0;
  const rows = [];
  for (const file of files) {
    if (!file.endsWith("_source.json")) continue;
    const source = await readJson(file);
    if (!source?.recipe_id) continue;
    rows.push({
      recipe_id: source.recipe_id,
      source: source.source ?? "unknown",
      source_url: source.source_url ?? null,
      thumbnail_url: source.thumbnail_url ?? null,
      title: source.title ?? null,
      top_comment: source.top_comment ?? null,
      description: source.description ?? null,
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from("recipe_sources").upsert(rows, { onConflict: "recipe_id" });
  if (error) throw error;
  return rows.length;
};

const migrateDailyPlans = async (dataDir) => {
  const plansDir = path.join(dataDir, "daily_plans");
  const files = await listJsonFiles(plansDir);
  if (!files.length) return 0;
  const rows = [];
  for (const file of files) {
    const plan = await readJson(file);
    if (!plan?.date) continue;
    rows.push({
      date: plan.date,
      meals: plan.meals ?? {},
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from("daily_plans").upsert(rows, { onConflict: "date" });
  if (error) throw error;
  return rows.length;
};

const migrateShoppingState = async (dataDir) => {
  const file = path.join(dataDir, "shopping_list.json");
  try {
    const state = await readJson(file);
    const rows = Object.entries(state).map(([key, value]) => ({
      key,
      data: value,
      updated_at: new Date().toISOString(),
    }));
    if (!rows.length) return 0;
    const { error } = await supabase.from("shopping_state").upsert(rows, { onConflict: "key" });
    if (error) throw error;
    return rows.length;
  } catch {
    return 0;
  }
};

const migrateBuyLists = async (dataDir) => {
  const listsDir = path.join(dataDir, "buy_lists");
  const files = await listJsonFiles(listsDir);
  if (!files.length) return 0;
  const rows = [];
  for (const file of files) {
    const list = await readJson(file);
    if (!list?.id) continue;
    rows.push({
      id: list.id,
      week_start: list.week_start,
      week_end: list.week_end,
      saved_at: list.saved_at,
      status: list.status,
      lang: list.lang,
      items: list.items ?? [],
    });
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from("buy_lists").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return rows.length;
};

const migrateConfig = async (dataDir) => {
  const file = path.join(dataDir, "config.json");
  try {
    const config = await readJson(file);
    const { error } = await supabase.from("config").upsert(
      {
        key: "default",
        value: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw error;
    return 1;
  } catch {
    return 0;
  }
};

const main = async () => {
  const dataDir = await resolveDataDir();
  const results = [];

  results.push(["recipes", await migrateRecipes(dataDir)]);
  results.push(["recipe_sources", await migrateRecipeSources(dataDir)]);
  results.push(["daily_plans", await migrateDailyPlans(dataDir)]);
  results.push(["shopping_state", await migrateShoppingState(dataDir)]);
  results.push(["buy_lists", await migrateBuyLists(dataDir)]);
  results.push(["config", await migrateConfig(dataDir)]);

  console.log("Migration complete:");
  results.forEach(([name, count]) => console.log(`- ${name}: ${count}`));
};

main().catch((error) => {
  console.error("Migration failed:", error.message || error);
  process.exit(1);
});

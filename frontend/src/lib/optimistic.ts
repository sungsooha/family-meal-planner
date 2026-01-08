export type OptimisticEntry<T> = {
  timestamp: number;
  data: T;
};

const STORAGE_KEY = "optimisticRecipes";
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_ITEMS = 10;

function readEntries<T>(): OptimisticEntry<T>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OptimisticEntry<T>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries<T>(entries: OptimisticEntry<T>[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function registerOptimisticRecipe<T extends { recipe_id: string }>(recipe: T) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const entries = readEntries<T>()
    .filter((entry) => now - entry.timestamp < MAX_AGE_MS && entry.data.recipe_id !== recipe.recipe_id);
  entries.unshift({ timestamp: now, data: recipe });
  writeEntries(entries.slice(0, MAX_ITEMS));
}

export function mergeOptimisticRecipes<T extends { recipe_id: string }>(recipes: T[]): T[] {
  if (typeof window === "undefined") return recipes;
  const now = Date.now();
  const entries = readEntries<T>().filter((entry) => now - entry.timestamp < MAX_AGE_MS);
  const ids = new Set(recipes.map((recipe) => recipe.recipe_id));
  const merged = [...recipes];
  entries.forEach((entry) => {
    if (!ids.has(entry.data.recipe_id)) {
      merged.push(entry.data);
    }
  });
  return merged;
}

export function pruneOptimisticRecipes<T extends { recipe_id: string }>(recipes: T[]) {
  if (typeof window === "undefined") return;
  const ids = new Set(recipes.map((recipe) => recipe.recipe_id));
  const entries = readEntries<T>().filter((entry) => !ids.has(entry.data.recipe_id));
  writeEntries(entries);
}

export function getOptimisticIds<T extends { recipe_id: string }>(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const now = Date.now();
  const entries = readEntries<T>().filter((entry) => now - entry.timestamp < MAX_AGE_MS);
  return new Set(entries.map((entry) => entry.data.recipe_id));
}

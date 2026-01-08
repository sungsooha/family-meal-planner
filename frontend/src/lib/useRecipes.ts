"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { mergeOptimisticRecipes, pruneOptimisticRecipes } from "./optimistic";

const OPTIMISTIC_STORAGE_KEY = "optimisticRecipes";
const OPTIMISTIC_MAX_AGE_MS = 5 * 60 * 1000;

function readOptimisticIds<T extends { recipe_id: string }>(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(OPTIMISTIC_STORAGE_KEY);
    if (!raw) return new Set();
    const entries = JSON.parse(raw) as Array<{ timestamp: number; data: T }>;
    const now = Date.now();
    return new Set(
      (entries ?? [])
        .filter((entry) => now - entry.timestamp < OPTIMISTIC_MAX_AGE_MS)
        .map((entry) => entry.data.recipe_id),
    );
  } catch {
    return new Set();
  }
}

export type RecipeBase = {
  recipe_id: string;
};

export function useRecipes<T extends RecipeBase = RecipeBase>(view: "summary" | "full" = "summary") {
  const endpoint = view === "summary" ? "/api/recipes?view=summary" : "/api/recipes";
  const { data, mutate, isLoading } = useSWR<T[]>(endpoint);
  const baseRecipes = data ?? [];
  const recipes = useMemo(() => mergeOptimisticRecipes(baseRecipes), [baseRecipes]);
  const optimisticIds = useMemo(() => readOptimisticIds<T>(), [recipes]);
  useEffect(() => {
    pruneOptimisticRecipes(baseRecipes);
  }, [baseRecipes]);
  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.recipe_id, recipe])), [recipes]);

  return { recipes, recipesById, optimisticIds, mutateRecipes: mutate, isLoading };
}

"use client";

import { useMemo } from "react";
import useSWR from "swr";

export type RecipeBase = {
  recipe_id: string;
};

export function useRecipes<T extends RecipeBase = RecipeBase>(view: "summary" | "full" = "summary") {
  const endpoint = view === "summary" ? "/api/recipes?view=summary" : "/api/recipes";
  const { data, mutate, isLoading } = useSWR<T[]>(endpoint);
  const recipes = data ?? [];
  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.recipe_id, recipe])), [recipes]);

  return { recipes, recipesById, mutateRecipes: mutate, isLoading };
}

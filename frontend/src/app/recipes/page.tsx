"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { useRecipes } from "@/lib/useRecipes";
import { getFeedbackSummary } from "@/lib/feedback";
import { BLUR_DATA_URL } from "@/lib/image";
import { Filter, Upload } from "lucide-react";
import ActionMenu from "@/components/ActionMenu";
import ManualRecipeModal from "@/components/ManualRecipeModal";
import RecipeImportModal from "@/components/RecipeImportModal";

type Ingredient = { name: string; quantity: number | string; unit: string };
type Recipe = {
  recipe_id: string;
  name: string;
  meal_types?: string[];
  servings?: number;
  source_url?: string | null;
  thumbnail_url?: string | null;
  notes?: string;
  family_feedback_score?: number;
  family_feedback?: Record<string, number>;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function RecipesPage() {
  const searchParams = useSearchParams();
  const { recipes, mutateRecipes, isLoading } = useRecipes<Recipe>();
  const { mutate } = useSWRConfig();
  const prefetchedRecipes = useRef(new Set<string>());
  const prefetchRecipe = useCallback((recipeId: string) => {
    if (prefetchedRecipes.current.has(recipeId)) return;
    prefetchedRecipes.current.add(recipeId);
    mutate(
      `/api/recipes/${recipeId}`,
      fetch(`/api/recipes/${recipeId}`).then((res) => res.json()),
      { populateCache: true, revalidate: false },
    );
  }, [mutate]);
  const [filters, setFilters] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (searchParams?.get("import") === "1") {
      setShowImport(true);
    }
    if (searchParams?.get("manual") === "1") {
      setShowManual(true);
    }
  }, [searchParams]);

  const visibleRecipes = useMemo(() => {
    if (!filters.length) return recipes;
    return recipes.filter((recipe) => (recipe.meal_types ?? []).some((meal) => filters.includes(meal)));
  }, [recipes, filters]);

  const toggleFilter = (meal: string) => {
    setFilters((prev) => (prev.includes(meal) ? prev.filter((item) => item !== meal) : [...prev, meal]));
  };

  const handleManualCreated = async () => {
    await mutateRecipes();
  };

  return (
    <div className="space-y-6">
      <section className="sticky top-[calc(var(--header-height)+0.5rem)] z-20 scroll-mt-[calc(var(--header-height)+2rem)] rounded-3xl border border-white/70 bg-white/95 p-4 text-xs shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recipe Library</p>
            <h2 className="text-lg font-semibold text-slate-900">Browse every saved recipe</h2>
            <p className="mt-1 text-xs text-slate-500">
              {filters.length ? `Filters: ${filters.join(", ")}` : "Filters: All meals"}
            </p>
          </div>
          <ActionMenu>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => setShowManual(true)}
            >
              Add recipe
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-4 w-4" /> Import JSON
            </button>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <Filter className="h-3.5 w-3.5" /> Filters
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {MEAL_TYPES.map((meal) => (
                  <button
                    key={meal}
                    className={`rounded-full px-3 py-1 text-xs ${
                      filters.includes(meal)
                        ? "bg-emerald-700 text-white"
                        : "border border-slate-200 text-slate-500"
                    }`}
                    onClick={() => toggleFilter(meal)}
                  >
                    {meal}
                  </button>
                ))}
                {filters.length > 0 && (
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                    onClick={() => setFilters([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </ActionMenu>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && recipes.length === 0
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3 border-b border-dashed border-slate-200 pb-2">
                  <div className="h-16 w-16 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded-full bg-slate-100" />
                    <div className="h-4 w-40 rounded-full bg-slate-100" />
                    <div className="h-3 w-16 rounded-full bg-slate-100" />
                  </div>
                </div>
              </div>
            ))
          : visibleRecipes.map((recipe) => (
              <Link
                key={recipe.recipe_id}
                href={`/recipes/${recipe.recipe_id}`}
                className="rounded-2xl border border-white/70 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70"
                onMouseEnter={() => {
                  prefetchRecipe(recipe.recipe_id);
                }}
              >
                <div className="flex items-start gap-3 border-b border-dashed border-slate-200 pb-2">
                  {recipe.thumbnail_url ? (
                    <Image
                      src={recipe.thumbnail_url}
                      alt={recipe.name}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-xl object-cover"
                      sizes="64px"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-slate-100" />
                  )}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                      <span>{(recipe.meal_types ?? []).join(", ") || "Flexible"}</span>
                      {recipe.family_feedback && Object.keys(recipe.family_feedback).length > 0 && (() => {
                        const summary = getFeedbackSummary(recipe.family_feedback);
                        if (!summary.total) return null;
                        return (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                            👍 {summary.up} · 👎 {summary.down}
                          </span>
                        );
                      })()}
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">{recipe.name}</h3>
                  </div>
                </div>
              </Link>
            ))}
      </section>

      {showImport && (
        <RecipeImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onImported={mutateRecipes}
        />
      )}

      {showManual && (
        <ManualRecipeModal
          open={showManual}
          onClose={() => setShowManual(false)}
          onCreated={handleManualCreated}
        />
      )}

    </div>
  );
}

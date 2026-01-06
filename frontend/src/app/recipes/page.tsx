"use client";

import Link from "next/link";
import Image from "next/image";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useRecipes } from "@/lib/useRecipes";
import { BLUR_DATA_URL } from "@/lib/image";
import { Filter, Upload, X, Shuffle } from "lucide-react";
import ActionMenu from "@/components/ActionMenu";

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
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function RecipesPage() {
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
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonSuccess, setJsonSuccess] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [recipeIdInput, setRecipeIdInput] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "1") {
      setShowImport(true);
    }
  }, []);

  const visibleRecipes = useMemo(() => {
    if (!filters.length) return recipes;
    return recipes.filter((recipe) => (recipe.meal_types ?? []).some((meal) => filters.includes(meal)));
  }, [recipes, filters]);

  const toggleFilter = (meal: string) => {
    setFilters((prev) => (prev.includes(meal) ? prev.filter((item) => item !== meal) : [...prev, meal]));
  };

  const handleJsonFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonInput(text);
  };

  const handleImport = async () => {
    setJsonError("");
    setJsonSuccess("");
    let parsed: Recipe;
    try {
      parsed = JSON.parse(jsonInput) as Recipe;
    } catch {
      setJsonError("Invalid JSON format.");
      return;
    }
    const finalRecipeId = parsed.recipe_id || recipeIdInput.trim();
    const finalSourceUrl = parsed.source_url || sourceUrlInput.trim();
    if (!finalRecipeId) {
      setJsonError("Missing recipe_id.");
      return;
    }
    parsed.recipe_id = finalRecipeId;
    if (finalSourceUrl) {
      parsed.source_url = finalSourceUrl;
    }
    if (!parsed.name) {
      setJsonError("Missing name.");
      return;
    }
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setJsonError(data.error ?? "Failed to import recipe.");
      return;
    }
    setJsonSuccess("Recipe imported.");
    setJsonInput("");
    setRecipeIdInput("");
    setSourceUrlInput("");
    setShowImport(false);
    await mutateRecipes();
  };

  const generateRecipeId = () => {
    const id = crypto.randomUUID().replace(/-/g, "");
    setRecipeIdInput(id);
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
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {(recipe.meal_types ?? []).join(", ") || "Flexible"}
                    </p>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">{recipe.name}</h3>
                    <p className="mt-1 text-xs text-slate-600">Serves {recipe.servings ?? "?"}</p>
                    {typeof recipe.family_feedback_score === "number" && (
                      <p className="mt-1 text-xs text-amber-600">Family score: {recipe.family_feedback_score}/5</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
      </section>

      {showImport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                <Upload className="h-4 w-4" />
                Import from JSON
              </div>
              <button onClick={() => setShowImport(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
        <p className="mt-2 text-sm text-slate-600">
              Paste the JSON returned by ChatGPT or upload a JSON file. You can provide an optional
              recipe ID and source URL.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                placeholder="Recipe ID (optional)"
                value={recipeIdInput}
                onChange={(event) => setRecipeIdInput(event.target.value)}
              />
              <button
                className="flex items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
                onClick={generateRecipeId}
              >
                <Shuffle className="h-3 w-3" /> Generate
              </button>
            </div>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              placeholder="Source URL (optional)"
              value={sourceUrlInput}
              onChange={(event) => setSourceUrlInput(event.target.value)}
            />
            <textarea
              className="mt-3 min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700"
              placeholder='{"recipe_id":"...","name":"..."}'
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input type="file" accept="application/json" onChange={handleJsonFile} />
              <button
              className="rounded-full bg-emerald-700 px-4 py-2 text-xs text-white hover:bg-emerald-600"
              onClick={handleImport}
            >
                Add recipe
              </button>
              {jsonError && <span className="text-xs text-rose-500">{jsonError}</span>}
              {jsonSuccess && <span className="text-xs text-emerald-600">{jsonSuccess}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

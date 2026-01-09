"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { useRecipes } from "@/lib/useRecipes";
import { getFeedbackSummary } from "@/lib/feedback";
import { BLUR_DATA_URL } from "@/lib/image";
import { Filter, Upload } from "lucide-react";
import ActionMenu from "@/components/ActionMenu";
import ManualRecipeModal, { ManualRecipePrefill } from "@/components/ManualRecipeModal";
import RecipeImportModal, { ImportedRecipe } from "@/components/RecipeImportModal";
import RecipeSearchModal from "@/components/RecipeSearchModal";
import { registerOptimisticRecipe } from "@/lib/optimistic";
import { useLanguage } from "@/components/LanguageProvider";

type Ingredient = { name: string; quantity: number | string; unit: string };
type Recipe = {
  recipe_id: string;
  name: string;
  name_original?: string;
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

function RecipesPageClient() {
  const searchParams = useSearchParams();
  const { recipes, optimisticIds, mutateRecipes, isLoading } = useRecipes<Recipe>();
  const { mutate } = useSWRConfig();
  const { language } = useLanguage();
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
  const [showSearch, setShowSearch] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<ManualRecipePrefill | null>(null);
  const [manualFromSearch, setManualFromSearch] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualLoadingModel, setManualLoadingModel] = useState<string | null>(null);
  const [manualNotice, setManualNotice] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualSourceUrl, setManualSourceUrl] = useState<string | null>(null);
  const [manualThumbnailUrl, setManualThumbnailUrl] = useState<string | null>(null);

  const PREFILL_CACHE_KEY = "recipe_prefill_cache";
  const PREFILL_TTL_MS = 1000 * 60 * 60 * 6;
  const PREFILL_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash"];

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

  const handleManualCreated = async (recipe: Recipe) => {
    registerOptimisticRecipe(recipe);
    await mutateRecipes(
      (current = []) => {
        const exists = current.some((item) => item.recipe_id === recipe.recipe_id);
        return exists ? current : [...current, recipe];
      },
      { revalidate: false },
    );
    mutate(
      "/api/recipes",
      (current?: Recipe[]) => {
        if (!current) return [recipe];
        return current.some((item) => item.recipe_id === recipe.recipe_id) ? current : [...current, recipe];
      },
      { revalidate: false },
    );
    setManualFromSearch(false);
    setManualPrefill(null);
  };

  const handleImportedRecipe = async (recipe: ImportedRecipe) => {
    registerOptimisticRecipe(recipe);
    await mutateRecipes(
      (current = []) => {
        const exists = current.some((item) => item.recipe_id === recipe.recipe_id);
        return exists ? current : [...current, recipe];
      },
      { revalidate: false },
    );
    mutate(
      "/api/recipes",
      (current?: Recipe[]) => {
        if (!current) return [recipe];
        return current.some((item) => item.recipe_id === recipe.recipe_id) ? current : [...current, recipe];
      },
      { revalidate: false },
    );
  };

  const loadPrefillCache = (sourceUrl: string) => {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(PREFILL_CACHE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const entry = parsed?.[sourceUrl];
      if (!entry || !entry.prefill || !entry.expiresAt) return null;
      if (Date.now() > entry.expiresAt) return null;
      return entry;
    } catch {
      return null;
    }
  };

  const savePrefillCache = (sourceUrl: string, data: { prefill: ManualRecipePrefill; model?: string }) => {
    if (typeof sessionStorage === "undefined") return;
    try {
      const stored = sessionStorage.getItem(PREFILL_CACHE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[sourceUrl] = {
        prefill: data.prefill,
        model: data.model ?? null,
        expiresAt: Date.now() + PREFILL_TTL_MS,
      };
      sessionStorage.setItem(PREFILL_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore cache write errors.
    }
  };

  const runPrefill = async (sourceUrl: string, thumbnailUrl: string | null, force: boolean) => {
    setManualLoading(true);
    setManualError("");
    setManualNotice("");
    setManualLoadingModel(null);
    if (!force) {
      const cached = loadPrefillCache(sourceUrl);
      if (cached?.prefill) {
        setManualPrefill(cached.prefill as ManualRecipePrefill);
        setManualNotice(
          cached.model
            ? `Using cached auto-fill result (${cached.model}).`
            : "Using cached auto-fill result.",
        );
        setManualLoadingModel(cached.model ?? null);
        setManualLoading(false);
        return;
      }
    }
    let lastError = "";
    for (const model of PREFILL_MODELS) {
      setManualLoadingModel(model);
      try {
        const response = await fetch("/api/recipes/prefill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_url: sourceUrl,
            thumbnail_url: thumbnailUrl,
            force,
            model,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Auto-fill failed.");
        }
        if (payload.prefill) {
          setManualPrefill(payload.prefill as ManualRecipePrefill);
          savePrefillCache(sourceUrl, { prefill: payload.prefill, model: payload.model ?? model });
        }
        if (payload.cached) {
          setManualNotice(
            payload.model
              ? `Using cached auto-fill result (${payload.model}).`
              : "Using cached auto-fill result.",
          );
        } else if (payload.model || model) {
          setManualNotice(`Auto-fill completed with ${payload.model ?? model}.`);
        }
        setManualLoading(false);
        return;
      } catch (error) {
        lastError = (error as Error).message ?? "Auto-fill failed.";
        continue;
      }
    }
    if (lastError.toLowerCase().includes("quota")) {
      setManualNotice("Auto-fill unavailable: Gemini quota exceeded. Please check billing/quota.");
    } else {
      setManualError(lastError || "Auto-fill failed.");
    }
    setManualLoading(false);
  };

  const handleSearchCandidate = (candidate: {
    title: string;
    source_url: string;
    servings?: number | string | null;
    ingredients?: string[];
    instructions?: string[];
    source_host?: string;
    thumbnail_url?: string | null;
  }) => {
    setShowSearch(false);
    setManualFromSearch(true);
    setManualError("");
    setManualNotice("");
    setManualLoading(true);
    setManualSourceUrl(candidate.source_url);
    setManualThumbnailUrl(candidate.thumbnail_url ?? null);
    setManualPrefill({
      name: candidate.title,
      name_original: candidate.title,
      servings: candidate.servings ?? "",
      source_url: candidate.source_url,
      thumbnail_url: candidate.thumbnail_url ?? null,
      ingredients_text: candidate.ingredients?.join("\n") ?? "",
      ingredients_original_text: candidate.ingredients?.join("\n") ?? "",
      instructions_text: candidate.instructions?.join("\n") ?? "",
      instructions_original_text: candidate.instructions?.join("\n") ?? "",
    });
    setShowManual(true);
    void runPrefill(candidate.source_url, candidate.thumbnail_url ?? null, false);
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
              onClick={() => {
                setManualPrefill(null);
                setManualFromSearch(false);
                setManualError("");
                setManualNotice("");
                setManualLoading(false);
                setManualLoadingModel(null);
                setManualSourceUrl(null);
                setManualThumbnailUrl(null);
                setShowManual(true);
              }}
            >
              Add recipe (manual)
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => setShowSearch(true)}
            >
              Search & add
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
                      {optimisticIds.has(recipe.recipe_id) ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          syncing
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">
                      {language === "original"
                        ? recipe.name_original || recipe.name
                        : recipe.name}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
      </section>

      {showImport && (
        <RecipeImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onImported={handleImportedRecipe}
        />
      )}

      {showManual && (
        <ManualRecipeModal
          open={showManual}
          onClose={() => {
            setShowManual(false);
            setManualFromSearch(false);
            setManualPrefill(null);
            setManualLoading(false);
            setManualLoadingModel(null);
            setManualError("");
            setManualNotice("");
            setManualSourceUrl(null);
            setManualThumbnailUrl(null);
          }}
          onCreated={handleManualCreated}
          prefill={manualPrefill}
          backLabel={manualFromSearch ? "Back to search results" : "Back"}
          onBack={
            manualFromSearch
              ? () => {
                  setShowManual(false);
                  setShowSearch(true);
                }
              : undefined
          }
          loading={manualLoading}
          loadingLabel="Auto-filling from YouTube with"
          loadingModel={manualLoadingModel ?? undefined}
          errorMessage={manualError}
          noticeMessage={manualNotice}
          onRetryPrefill={
            manualSourceUrl
              ? () => {
                  void runPrefill(manualSourceUrl, manualThumbnailUrl, true);
                }
              : undefined
          }
          retryLabel="Retry auto-fill"
        />
      )}

      {showSearch && (
        <RecipeSearchModal
          open={showSearch}
          onClose={() => setShowSearch(false)}
          onUseCandidate={handleSearchCandidate}
          initialQuery=""
        />
      )}

    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">Loading recipes...</div>}>
      <RecipesPageClient />
    </Suspense>
  );
}

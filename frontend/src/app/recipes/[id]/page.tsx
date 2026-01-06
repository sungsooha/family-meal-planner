"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useRecipes } from "@/lib/useRecipes";
import { ArrowLeft, ListChecks, ShoppingBasket, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/ToastProvider";

type Ingredient = { name: string; quantity: number | string; unit: string };
type Recipe = {
  recipe_id: string;
  name: string;
  meal_types?: string[];
  servings?: number;
  source_url?: string | null;
  notes?: string;
  family_feedback_score?: number;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};

export default function RecipeDetailPage() {
  const params = useParams();
  const idParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const { recipesById } = useRecipes<Recipe>();
  const fallbackRecipe = idParam ? recipesById.get(idParam) ?? undefined : undefined;
  const { data: recipe, mutate: mutateRecipe } = useSWR<Recipe | null>(
    idParam ? `/api/recipes/${idParam}` : null,
    { fallbackData: fallbackRecipe },
  );
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [actionHidden, setActionHidden] = useState(false);
  const [actionPinned, setActionPinned] = useState(false);
  const pinnedScroll = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      const atTop = current <= 120;
      if (atTop) {
        setActionHidden(false);
        if (actionPinned) setActionPinned(false);
        return;
      }
      if (actionPinned) {
        if (Math.abs(current - pinnedScroll.current) > 24) {
          setActionPinned(false);
          setActionHidden(true);
        } else {
          setActionHidden(false);
        }
        return;
      }
      setActionHidden(true);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [actionPinned]);

  useEffect(() => {
    if (recipe) {
      setDraft({ ...recipe });
    }
  }, [recipe]);

  const ingredients = language === "original" ? recipe?.ingredients_original : recipe?.ingredients;
  const instructions = language === "original" ? recipe?.instructions_original : recipe?.instructions;

  const formatIngredients = (items?: Ingredient[]) =>
    (items ?? [])
      .map((item) => `${item.name},${item.quantity ?? ""},${item.unit ?? ""}`.trim())
      .join("\n");

  const parseIngredients = (value: string): Ingredient[] => {
    if (!value.trim()) return [];
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, qty, unit] = line.split(",").map((part) => part.trim());
        const quantity = Number.isNaN(Number(qty)) ? qty ?? "" : Number(qty);
        return { name: name ?? "", quantity, unit: unit ?? "" };
      });
  };

  const formatInstructions = (items?: string[]) => (items ?? []).join("\n");

  const parseInstructions = (value: string): string[] => {
    if (!value.trim()) return [];
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  };

  const handleSave = async () => {
    if (!draft || !idParam) return;
    const response = await fetch(`/api/recipes/${idParam}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) return;
    setIsEditing(false);
    showToast("Saved. Weekly plan and shopping list refreshed.");
    await mutateRecipe();
  };

  const youtubeId = useMemo(() => {
    const url = recipe?.source_url;
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
  }, [recipe?.source_url]);

  if (!recipe) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm">
        <Link href="/recipes" className="text-sm text-slate-600">
          ← Back to recipes
        </Link>
        <p className="mt-4 text-sm text-slate-600">Recipe not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className={`sticky top-[calc(var(--header-height)+0.5rem)] z-20 scroll-mt-[calc(var(--header-height)+2rem)] rounded-3xl border bg-white/90 p-4 text-xs backdrop-blur transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70 ${
          actionHidden ? "-translate-y-20 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        } border-white/70 shadow-sm`}
      >
        <Link href="/recipes" className="flex items-center gap-2 text-sm text-slate-600">
          <ArrowLeft className="h-4 w-4" /> Back to recipes
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Recipe detail</p>
            <h2 className="text-lg font-semibold text-slate-900">{recipe.name}</h2>
            <p className="text-sm text-slate-600">
              {(recipe.meal_types ?? []).join(", ") || "Flexible"} · {recipe.servings ?? "?"} servings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-600">Language: {language === "en" ? "English" : "Original"}</p>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          </div>
        </div>
      </section>
      {actionHidden && (
        <button
          className="fixed left-4 top-[calc(var(--header-height)+0.5rem+env(safe-area-inset-top))] z-30 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg backdrop-blur hover:bg-rose-600 sm:left-6"
          onClick={() => {
            setActionHidden(false);
            setActionPinned(true);
            pinnedScroll.current = window.scrollY;
          }}
          aria-label="Show actions"
          title="Show actions"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      )}

      {youtubeId && (
        <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-sm">
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="Recipe video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70">
          <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
            <ListChecks className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Instructions</h3>
          </div>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            {(instructions ?? []).map((line, idx) => (
              <li key={`${line}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                {line}
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70">
          <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
            <ShoppingBasket className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Ingredients</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {(ingredients ?? []).map((item, idx) => (
              <li key={`${item.name}-${idx}`} className="flex justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <span>{item.name}</span>
                <span className="text-slate-400">
                  {item.quantity} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70">
          <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
          <p className="mt-2 text-sm text-slate-600">{recipe.notes || "No notes yet."}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70">
          <h3 className="text-sm font-semibold text-slate-900">Family feedback</h3>
          <p className="mt-2 text-xs text-rose-500">How did the family like it?</p>
          <p className="mt-1 text-sm text-slate-600">
            {typeof recipe.family_feedback_score === "number"
              ? `${recipe.family_feedback_score} / 5`
              : "Not rated yet."}
          </p>
        </div>
      </section>

      {isEditing && draft && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit recipe</h3>
              <button className="text-sm text-slate-500" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wide text-slate-400">Name</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
                <label className="text-xs uppercase tracking-wide text-slate-400">Meal types (comma-separated)</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={(draft.meal_types ?? []).join(", ")}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      meal_types: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <label className="text-xs uppercase tracking-wide text-slate-400">Servings</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={draft.servings ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, servings: Number(event.target.value) || undefined })
                  }
                />
                <label className="text-xs uppercase tracking-wide text-slate-400">Family feedback (0-5)</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={draft.family_feedback_score ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      family_feedback_score: Number(event.target.value) || undefined,
                    })
                  }
                />
                <label className="text-xs uppercase tracking-wide text-slate-400">Source URL</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={draft.source_url ?? ""}
                  onChange={(event) => setDraft({ ...draft, source_url: event.target.value })}
                />
                <label className="text-xs uppercase tracking-wide text-slate-400">Notes</label>
                <textarea
                  className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  value={draft.notes ?? ""}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wide text-slate-400">Ingredients (en)</label>
                <textarea
                  className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  value={formatIngredients(draft.ingredients)}
                  onChange={(event) =>
                    setDraft({ ...draft, ingredients: parseIngredients(event.target.value) })
                  }
                />
                <label className="text-xs uppercase tracking-wide text-slate-400">Ingredients (original)</label>
                <textarea
                  className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  value={formatIngredients(draft.ingredients_original)}
                  onChange={(event) =>
                    setDraft({ ...draft, ingredients_original: parseIngredients(event.target.value) })
                  }
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Instructions (en)</label>
                <textarea
                  className="min-h-[160px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  value={formatInstructions(draft.instructions)}
                  onChange={(event) =>
                    setDraft({ ...draft, instructions: parseInstructions(event.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Instructions (original)</label>
                <textarea
                  className="min-h-[160px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  value={formatInstructions(draft.instructions_original)}
                  onChange={(event) =>
                    setDraft({ ...draft, instructions_original: parseInstructions(event.target.value) })
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-500"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button className="rounded-full bg-emerald-700 px-4 py-2 text-xs text-white hover:bg-emerald-600" onClick={handleSave}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useRecipes } from "@/lib/useRecipes";
import FamilyFeedback from "@/components/FamilyFeedback";
import RecipeFormBody, {
  IngredientDraft,
  InstructionDraft,
} from "@/components/RecipeFormBody";
import { ArrowLeft, ListChecks, ShoppingBasket } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { getYouTubeId } from "@/lib/youtube";
import { useToast } from "@/components/ToastProvider";
import type { Recipe, Ingredient } from "@/lib/types";
import { parseMealTypes } from "@/lib/recipeForm";


type FamilyMember = {
  id: string;
  label: string;
};

type AppConfig = {
  family_members?: FamilyMember[];
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
  const { mutate } = useSWRConfig();
  const { data: configData } = useSWR<{ config: AppConfig }>("/api/config");
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [mealTypesInput, setMealTypesInput] = useState("");
  const [showOtherLanguage, setShowOtherLanguage] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSourceUrl, setShowSourceUrl] = useState(false);
  const [ingredientDraftEn, setIngredientDraftEn] = useState<IngredientDraft>({
    name: "",
    quantity: "",
    unit: "",
  });
  const [ingredientDraftOriginal, setIngredientDraftOriginal] = useState<IngredientDraft>({
    name: "",
    quantity: "",
    unit: "",
  });
  const [instructionDraftEn, setInstructionDraftEn] = useState<InstructionDraft>({ text: "" });
  const [instructionDraftOriginal, setInstructionDraftOriginal] = useState<InstructionDraft>({
    text: "",
  });
  const recipeRef = useRef<Recipe | null>(null);
  const feedbackVersionRef = useRef(0);
  const feedbackSavingRef = useRef(false);

  useEffect(() => {
    if (recipe) {
      setDraft({ ...recipe });
      setMealTypesInput((recipe.meal_types ?? []).join(", "));
      setIngredientDraftEn({ name: "", quantity: "", unit: "" });
      setIngredientDraftOriginal({ name: "", quantity: "", unit: "" });
      setInstructionDraftEn({ text: "" });
      setInstructionDraftOriginal({ text: "" });
      setShowOtherLanguage(false);
      setShowNotes(Boolean(recipe.notes));
      setShowSourceUrl(false);
    }
  }, [recipe]);

  useEffect(() => {
    recipeRef.current = recipe ?? null;
  }, [recipe]);

  const ingredients = language === "original" ? recipe?.ingredients_original : recipe?.ingredients;
  const instructions = language === "original" ? recipe?.instructions_original : recipe?.instructions;
  const recipeName =
    language === "original" ? recipe?.name_original || recipe?.name : recipe?.name;
  const members = configData?.config.family_members ?? [];
  const showEnglishPrimary = language === "en";
  const primaryLabel = showEnglishPrimary ? "Name (English)" : "Name (Original)";
  const secondaryLabel = showEnglishPrimary ? "Name (Original)" : "Name (English)";
  const primaryNameValue = showEnglishPrimary ? draft?.name ?? "" : draft?.name_original ?? "";
  const secondaryNameValue = showEnglishPrimary ? draft?.name_original ?? "" : draft?.name ?? "";
  const updateDraft = (patch: Partial<Recipe>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  const setPrimaryName = (value: string) =>
    updateDraft(showEnglishPrimary ? { name: value } : { name_original: value });
  const setSecondaryName = (value: string) =>
    updateDraft(showEnglishPrimary ? { name_original: value } : { name: value });
  const primaryIngredients = showEnglishPrimary
    ? draft?.ingredients ?? []
    : draft?.ingredients_original ?? [];
  const secondaryIngredients = showEnglishPrimary
    ? draft?.ingredients_original ?? []
    : draft?.ingredients ?? [];
  const primaryInstructions = showEnglishPrimary
    ? draft?.instructions ?? []
    : draft?.instructions_original ?? [];
  const secondaryInstructions = showEnglishPrimary
    ? draft?.instructions_original ?? []
    : draft?.instructions ?? [];
  const setPrimaryIngredients = (value: Ingredient[]) =>
    updateDraft(showEnglishPrimary ? { ingredients: value } : { ingredients_original: value });
  const setSecondaryIngredients = (value: Ingredient[]) =>
    updateDraft(showEnglishPrimary ? { ingredients_original: value } : { ingredients: value });
  const setPrimaryInstructions = (value: string[]) =>
    updateDraft(showEnglishPrimary ? { instructions: value } : { instructions_original: value });
  const setSecondaryInstructions = (value: string[]) =>
    updateDraft(showEnglishPrimary ? { instructions_original: value } : { instructions: value });
  const primaryIngredientDraft = showEnglishPrimary ? ingredientDraftEn : ingredientDraftOriginal;
  const secondaryIngredientDraft = showEnglishPrimary ? ingredientDraftOriginal : ingredientDraftEn;
  const setPrimaryIngredientDraft = showEnglishPrimary
    ? setIngredientDraftEn
    : setIngredientDraftOriginal;
  const setSecondaryIngredientDraft = showEnglishPrimary
    ? setIngredientDraftOriginal
    : setIngredientDraftEn;
  const primaryInstructionDraft = showEnglishPrimary ? instructionDraftEn : instructionDraftOriginal;
  const secondaryInstructionDraft = showEnglishPrimary
    ? instructionDraftOriginal
    : instructionDraftEn;
  const setPrimaryInstructionDraft = showEnglishPrimary
    ? setInstructionDraftEn
    : setInstructionDraftOriginal;
  const setSecondaryInstructionDraft = showEnglishPrimary
    ? setInstructionDraftOriginal
    : setInstructionDraftEn;

  const handleSave = async () => {
    if (!draft || !idParam) return;
    const payload = { ...draft, meal_types: parseMealTypes(mealTypesInput) };
    const response = await fetch(`/api/recipes/${idParam}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    setIsEditing(false);
    showToast("Saved. Weekly plan and shopping list refreshed.");
    mutateRecipe(payload, { revalidate: false });
    mutate(
      "/api/recipes?view=summary",
      (current?: Recipe[]) =>
        current?.map((item) => (item.recipe_id === idParam ? { ...item, ...payload } : item)),
      { revalidate: false },
    );
    mutate(
      "/api/recipes",
      (current?: Recipe[]) =>
        current?.map((item) => (item.recipe_id === idParam ? { ...item, ...payload } : item)),
      { revalidate: false },
    );
    await mutateRecipe();
  };

  const saveFeedback = async () => {
    if (feedbackSavingRef.current) return;
    feedbackSavingRef.current = true;
    const version = feedbackVersionRef.current;
    const snapshot = recipeRef.current;
    if (!snapshot || !idParam) {
      feedbackSavingRef.current = false;
      return;
    }
    const response = await fetch(`/api/recipes/${idParam}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    feedbackSavingRef.current = false;
    if (!response.ok) {
      showToast("Unable to save feedback.");
      await mutateRecipe();
      return;
    }
    showToast("Feedback saved.");
    await mutateRecipe();
    if (feedbackVersionRef.current !== version) {
      await saveFeedback();
    }
  };

  const handleFeedbackChange = async (memberId: string, value: number) => {
    if (!recipe || !idParam) return;
    const baseRecipe = recipeRef.current ?? recipe;
    const next = {
      ...baseRecipe,
      family_feedback: { ...(baseRecipe.family_feedback ?? {}), [memberId]: value },
    };
    recipeRef.current = next;
    mutateRecipe(next, { revalidate: false });
    mutate(
      "/api/recipes?view=summary",
      (current?: Recipe[]) =>
        current?.map((item) =>
          item.recipe_id === idParam ? { ...item, family_feedback: next.family_feedback } : item,
        ),
      { revalidate: false },
    );
    mutate(
      "/api/recipes",
      (current?: Recipe[]) =>
        current?.map((item) =>
          item.recipe_id === idParam ? { ...item, family_feedback: next.family_feedback } : item,
        ),
      { revalidate: false },
    );
    feedbackVersionRef.current += 1;
    await saveFeedback();
  };

  const youtubeId = useMemo(
    () => getYouTubeId(recipe?.source_url ?? null),
    [recipe?.source_url],
  );

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
      <section className="sticky top-[calc(var(--header-height)+0.5rem)] z-20 scroll-mt-[calc(var(--header-height)+2rem)] rounded-3xl border border-white/70 bg-white/95 p-4 text-xs shadow-sm backdrop-blur">
        <Link href="/recipes" className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to recipes
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{recipeName}</h2>
          </div>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:text-slate-900"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
        </div>
      </section>

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
        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm lg:col-span-2">
          <span className="font-medium text-slate-700">Meal types:</span>
          <span className="ml-2 inline-flex flex-wrap gap-2">
            {(recipe.meal_types ?? []).length
              ? (recipe.meal_types ?? []).map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-500"
                  >
                    {type}
                  </span>
                ))
              : "Flexible"}
          </span>
        </div>
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
            <span className="text-xs text-slate-500">
              {recipe.servings ?? "?"} servings
            </span>
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
          <div className="mt-3">
            <FamilyFeedback
              members={members}
              feedback={recipe.family_feedback}
              onChange={handleFeedbackChange}
            />
          </div>
        </div>
      </section>

      {isEditing && draft && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit recipe</h3>
              <button className="text-sm text-slate-500" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
            {draft && (
              <RecipeFormBody
                language={showEnglishPrimary ? "en" : "original"}
                primaryLabel={primaryLabel}
                secondaryLabel={secondaryLabel}
                primaryNameValue={primaryNameValue}
                setPrimaryName={setPrimaryName}
                secondaryNameValue={secondaryNameValue}
                setSecondaryName={setSecondaryName}
                mealTypesValue={mealTypesInput}
                setMealTypesValue={setMealTypesInput}
                servingsValue={draft.servings ? String(draft.servings) : ""}
                setServingsValue={(value) =>
                  updateDraft({ servings: value ? Number(value) : undefined })
                }
                primaryInstructions={primaryInstructions}
                setPrimaryInstructions={setPrimaryInstructions}
                secondaryInstructions={secondaryInstructions}
                setSecondaryInstructions={setSecondaryInstructions}
                primaryIngredients={primaryIngredients}
                setPrimaryIngredients={setPrimaryIngredients}
                secondaryIngredients={secondaryIngredients}
                setSecondaryIngredients={setSecondaryIngredients}
                primaryIngredientDraft={primaryIngredientDraft}
                setPrimaryIngredientDraft={setPrimaryIngredientDraft}
                secondaryIngredientDraft={secondaryIngredientDraft}
                setSecondaryIngredientDraft={setSecondaryIngredientDraft}
                primaryInstructionDraft={primaryInstructionDraft}
                setPrimaryInstructionDraft={setPrimaryInstructionDraft}
                secondaryInstructionDraft={secondaryInstructionDraft}
                setSecondaryInstructionDraft={setSecondaryInstructionDraft}
                showOtherLanguage={showOtherLanguage}
                onToggleOtherLanguage={() => setShowOtherLanguage((prev) => !prev)}
                showNotes={showNotes}
                onToggleNotes={() => setShowNotes((prev) => !prev)}
                notesValue={draft.notes ?? ""}
                setNotesValue={(value) => updateDraft({ notes: value })}
                showSourceUrl={showSourceUrl}
                onToggleSourceUrl={() => setShowSourceUrl((prev) => !prev)}
                sourceUrlValue={draft.source_url ?? ""}
                setSourceUrlValue={(value) => updateDraft({ source_url: value })}
              />
            )}
            <div className="mt-4">
              <label className="text-xs uppercase tracking-wide text-slate-400">Family feedback</label>
              <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <FamilyFeedback
                  members={members}
                  feedback={draft.family_feedback}
                  onChange={(memberId, value) =>
                    updateDraft({
                      family_feedback: { ...(draft.family_feedback ?? {}), [memberId]: value },
                    })
                  }
                  compact
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

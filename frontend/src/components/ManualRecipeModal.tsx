"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import RecipeFormBody, {
  IngredientDraft,
  InstructionDraft,
} from "@/components/RecipeFormBody";
import type { CreatedRecipe, Ingredient } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

export type ManualRecipePayload = CreatedRecipe;

export type ManualRecipePrefill = {
  name?: string;
  name_original?: string;
  servings?: number | string;
  source_url?: string | null;
  thumbnail_url?: string | null;
  meal_types?: string[];
  ingredients_text?: string;
  ingredients_original_text?: string;
  instructions_text?: string;
  instructions_original_text?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (recipe: CreatedRecipe) => void | Promise<void>;
  prefill?: ManualRecipePrefill | null;
  onBack?: () => void;
  backLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  loadingModel?: string;
  errorMessage?: string;
  onRetryPrefill?: () => void;
  retryLabel?: string;
  noticeMessage?: string;
};

const parseMealTypes = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

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

const parseInstructions = (value: string): string[] => {
  if (!value.trim()) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

export default function ManualRecipeModal({
  open,
  onClose,
  onCreated,
  prefill,
  onBack,
  backLabel,
  loading = false,
  loadingLabel = "Auto-filling from YouTube…",
  loadingModel,
  errorMessage = "",
  onRetryPrefill,
  retryLabel = "Retry auto-fill",
  noticeMessage = "",
}: Props) {
  const { language } = useLanguage();
  const [showOtherLanguage, setShowOtherLanguage] = useState(false);
  const [manualRecipeId, setManualRecipeId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualNameOriginal, setManualNameOriginal] = useState("");
  const [manualMealTypes, setManualMealTypes] = useState("");
  const [manualServings, setManualServings] = useState("");
  const [manualSourceUrl, setManualSourceUrl] = useState("");
  const [manualThumbnailUrl, setManualThumbnailUrl] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualIngredients, setManualIngredients] = useState<Ingredient[]>([]);
  const [manualIngredientsOriginal, setManualIngredientsOriginal] = useState<Ingredient[]>([]);
  const [manualInstructions, setManualInstructions] = useState<string[]>([]);
  const [manualInstructionsOriginal, setManualInstructionsOriginal] = useState<string[]>([]);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showSourceUrl, setShowSourceUrl] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [ingredientDraft, setIngredientDraft] = useState<IngredientDraft>({
    name: "",
    quantity: "",
    unit: "",
  });
  const [ingredientDraftOriginal, setIngredientDraftOriginal] = useState<IngredientDraft>({
    name: "",
    quantity: "",
    unit: "",
  });
  const [instructionDraft, setInstructionDraft] = useState<InstructionDraft>({ text: "" });
  const [instructionDraftOriginal, setInstructionDraftOriginal] = useState<InstructionDraft>({
    text: "",
  });
  const resetManualForm = () => {
    setManualRecipeId("");
    setManualName("");
    setManualNameOriginal("");
    setManualMealTypes("");
    setManualServings("");
    setManualSourceUrl("");
    setManualThumbnailUrl("");
    setManualNotes("");
    setShowNotes(false);
    setShowSourceUrl(false);
    setShowVideo(true);
    setManualIngredients([]);
    setManualIngredientsOriginal([]);
    setManualInstructions([]);
    setManualInstructionsOriginal([]);
    setManualError("");
    setManualSuccess("");
    setIngredientDraft({ name: "", quantity: "", unit: "" });
    setIngredientDraftOriginal({ name: "", quantity: "", unit: "" });
    setInstructionDraft({ text: "" });
    setInstructionDraftOriginal({ text: "" });
  };

  const applyPrefill = (data: ManualRecipePrefill) => {
    setManualName(data.name ?? "");
    setManualNameOriginal(data.name_original ?? data.name ?? "");
    setManualServings(data.servings ? String(data.servings) : "");
    setManualSourceUrl(data.source_url ?? "");
    setManualThumbnailUrl(data.thumbnail_url ?? "");
    setManualIngredients(parseIngredients(data.ingredients_text ?? ""));
    setManualIngredientsOriginal(
      parseIngredients(data.ingredients_original_text ?? data.ingredients_text ?? ""),
    );
    setManualInstructions(parseInstructions(data.instructions_text ?? ""));
    setManualInstructionsOriginal(
      parseInstructions(data.instructions_original_text ?? data.instructions_text ?? ""),
    );
    setManualMealTypes((data.meal_types ?? []).join(", "));
  };

  useEffect(() => {
    if (!open || !prefill) return;
    resetManualForm();
    applyPrefill(prefill);
  }, [open, prefill]);

  const handleSave = async () => {
    setManualError("");
    setManualSuccess("");
    const primaryName = manualName.trim() || manualNameOriginal.trim();
    if (!primaryName) {
      setManualError("Name is required.");
      return;
    }
    const finalRecipeId = manualRecipeId.trim() || crypto.randomUUID().replace(/-/g, "");
    const primaryIsEnglish = language === "en";
    const nameValue = primaryIsEnglish ? manualName.trim() || manualNameOriginal.trim() : manualNameOriginal.trim() || manualName.trim();
    const nameOriginalValue = primaryIsEnglish
      ? manualNameOriginal.trim() || undefined
      : manualName.trim() || undefined;
    const ingredientsPayload = manualIngredients;
    const ingredientsOriginalPayload =
      manualIngredientsOriginal.length > 0 ? manualIngredientsOriginal : manualIngredients;
    const instructionsPayload = manualInstructions;
    const instructionsOriginalPayload =
      manualInstructionsOriginal.length > 0 ? manualInstructionsOriginal : manualInstructions;
    const payload: ManualRecipePayload = {
      recipe_id: finalRecipeId,
      name: nameValue,
      name_original: nameOriginalValue,
      meal_types: parseMealTypes(manualMealTypes),
      servings: manualServings ? Number(manualServings) : undefined,
      source_url: manualSourceUrl.trim() || null,
      thumbnail_url: manualThumbnailUrl.trim() || null,
      notes: showNotes ? manualNotes.trim() || undefined : undefined,
      ingredients: ingredientsPayload,
      ingredients_original: ingredientsOriginalPayload,
      instructions: instructionsPayload,
      instructions_original: instructionsOriginalPayload,
    };
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setManualError(data.error ?? "Failed to add recipe.");
      return;
    }
    setManualSuccess("Recipe added.");
    resetManualForm();
    onClose();
    if (onCreated) {
      await onCreated(payload);
    }
  };

  if (!open) return null;

  const showEnglishPrimary = language === "en";
  const primaryLabel = showEnglishPrimary ? "Name (English)" : "Name (Original)";
  const secondaryLabel = showEnglishPrimary ? "Name (Original)" : "Name (English)";
  const primaryNameValue = showEnglishPrimary ? manualName : manualNameOriginal;
  const secondaryNameValue = showEnglishPrimary ? manualNameOriginal : manualName;
  const setPrimaryName = showEnglishPrimary ? setManualName : setManualNameOriginal;
  const setSecondaryName = showEnglishPrimary ? setManualNameOriginal : setManualName;
  const primaryIngredients = showEnglishPrimary ? manualIngredients : manualIngredientsOriginal;
  const secondaryIngredients = showEnglishPrimary ? manualIngredientsOriginal : manualIngredients;
  const setPrimaryIngredients = showEnglishPrimary ? setManualIngredients : setManualIngredientsOriginal;
  const setSecondaryIngredients = showEnglishPrimary ? setManualIngredientsOriginal : setManualIngredients;
  const primaryDraft = showEnglishPrimary ? ingredientDraft : ingredientDraftOriginal;
  const secondaryDraft = showEnglishPrimary ? ingredientDraftOriginal : ingredientDraft;
  const setPrimaryDraft = showEnglishPrimary ? setIngredientDraft : setIngredientDraftOriginal;
  const setSecondaryDraft = showEnglishPrimary ? setIngredientDraftOriginal : setIngredientDraft;
  const primaryInstructions = showEnglishPrimary ? manualInstructions : manualInstructionsOriginal;
  const secondaryInstructions = showEnglishPrimary ? manualInstructionsOriginal : manualInstructions;
  const setPrimaryInstructions = showEnglishPrimary
    ? setManualInstructions
    : setManualInstructionsOriginal;
  const setSecondaryInstructions = showEnglishPrimary
    ? setManualInstructionsOriginal
    : setManualInstructions;
  const primaryInstructionDraft = showEnglishPrimary ? instructionDraft : instructionDraftOriginal;
  const secondaryInstructionDraft = showEnglishPrimary ? instructionDraftOriginal : instructionDraft;
  const setPrimaryInstructionDraft = showEnglishPrimary
    ? setInstructionDraft
    : setInstructionDraftOriginal;
  const setSecondaryInstructionDraft = showEnglishPrimary
    ? setInstructionDraftOriginal
    : setInstructionDraft;
  const youtubeId = (() => {
    if (!manualSourceUrl) return null;
    try {
      const parsed = new URL(manualSourceUrl);
      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "");
      }
      if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1]?.split("/")[0];
      }
      return null;
    } catch {
      return null;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-slate-900/40 p-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {onBack && (
              <button
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-700"
                onClick={() => {
                  onClose();
                  onBack?.();
                }}
              >
                <span aria-hidden="true">←</span>
                {backLabel ?? "Back"}
              </button>
            )}
            {loading && (
              <div className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] text-amber-700">
                {loadingLabel}{" "}
                {loadingModel ? (
                  <span className="font-semibold text-amber-800">{loadingModel}</span>
                ) : null}
              </div>
            )}
            {noticeMessage && !loading && (
              <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600">
                {noticeMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] text-rose-700">
                {errorMessage}
                {onRetryPrefill && (
                  <button
                    className="ml-2 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:text-rose-700"
                    onClick={(event) => {
                      event.preventDefault();
                      onRetryPrefill();
                    }}
                  >
                    {retryLabel}
                  </button>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="mt-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Add recipe</p>
        </div>
        {youtubeId && (
          <div className="mt-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:text-slate-700"
                onClick={() => setShowVideo((prev) => !prev)}
              >
                {showVideo ? "Hide video" : "Show video"}
              </button>
            </div>
            {showVideo && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <iframe
                  title="YouTube preview"
                  className="h-52 w-full"
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
        <RecipeFormBody
          language={showEnglishPrimary ? "en" : "original"}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          primaryNameValue={primaryNameValue}
          setPrimaryName={setPrimaryName}
          secondaryNameValue={secondaryNameValue}
          setSecondaryName={setSecondaryName}
          mealTypesValue={manualMealTypes}
          setMealTypesValue={setManualMealTypes}
          servingsValue={manualServings}
          setServingsValue={setManualServings}
          primaryInstructions={primaryInstructions}
          setPrimaryInstructions={setPrimaryInstructions}
          secondaryInstructions={secondaryInstructions}
          setSecondaryInstructions={setSecondaryInstructions}
          primaryIngredients={primaryIngredients}
          setPrimaryIngredients={setPrimaryIngredients}
          secondaryIngredients={secondaryIngredients}
          setSecondaryIngredients={setSecondaryIngredients}
          primaryIngredientDraft={primaryDraft}
          setPrimaryIngredientDraft={setPrimaryDraft}
          secondaryIngredientDraft={secondaryDraft}
          setSecondaryIngredientDraft={setSecondaryDraft}
          primaryInstructionDraft={primaryInstructionDraft}
          setPrimaryInstructionDraft={setPrimaryInstructionDraft}
          secondaryInstructionDraft={secondaryInstructionDraft}
          setSecondaryInstructionDraft={setSecondaryInstructionDraft}
          showOtherLanguage={showOtherLanguage}
          onToggleOtherLanguage={() => setShowOtherLanguage((prev) => !prev)}
          showNotes={showNotes}
          onToggleNotes={() => setShowNotes((prev) => !prev)}
          notesValue={manualNotes}
          setNotesValue={setManualNotes}
          showSourceUrl={showSourceUrl}
          onToggleSourceUrl={() => setShowSourceUrl((prev) => !prev)}
          sourceUrlValue={manualSourceUrl}
          setSourceUrlValue={setManualSourceUrl}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-emerald-700 px-4 py-2 text-xs text-white hover:bg-emerald-600"
            onClick={handleSave}
          >
            Save recipe
          </button>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-500"
            onClick={() => {
              resetManualForm();
              onClose();
            }}
          >
            Cancel
          </button>
          {manualError && <span className="text-xs text-rose-500">{manualError}</span>}
          {manualSuccess && <span className="text-xs text-emerald-600">{manualSuccess}</span>}
        </div>
      </div>
    </div>
  );
}

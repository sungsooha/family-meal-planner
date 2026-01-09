"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CreatedRecipe } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

type Ingredient = { name: string; quantity: number | string; unit: string };

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

const formatIngredients = (items?: string[]) =>
  (items ?? []).map((line) => line.trim()).filter(Boolean).join("\n");

const formatInstructions = (items?: string[]) =>
  (items ?? []).map((line) => line.trim()).filter(Boolean).join("\n");

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
  const [manualIngredients, setManualIngredients] = useState("");
  const [manualIngredientsOriginal, setManualIngredientsOriginal] = useState("");
  const [manualInstructions, setManualInstructions] = useState("");
  const [manualInstructionsOriginal, setManualInstructionsOriginal] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showSourceUrl, setShowSourceUrl] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
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
    setManualIngredients("");
    setManualIngredientsOriginal("");
    setManualInstructions("");
    setManualInstructionsOriginal("");
    setManualError("");
    setManualSuccess("");
  };

  const applyPrefill = (data: ManualRecipePrefill) => {
    setManualName(data.name ?? "");
    setManualNameOriginal(data.name_original ?? data.name ?? "");
    setManualServings(data.servings ? String(data.servings) : "");
    setManualSourceUrl(data.source_url ?? "");
    setManualThumbnailUrl(data.thumbnail_url ?? "");
    setManualIngredients(data.ingredients_text ?? "");
    setManualIngredientsOriginal(data.ingredients_original_text ?? data.ingredients_text ?? "");
    setManualInstructions(data.instructions_text ?? "");
    setManualInstructionsOriginal(data.instructions_original_text ?? data.instructions_text ?? "");
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
    if (!manualName.trim()) {
      setManualError("Name is required.");
      return;
    }
    const finalRecipeId = manualRecipeId.trim() || crypto.randomUUID().replace(/-/g, "");
    const payload: ManualRecipePayload = {
      recipe_id: finalRecipeId,
      name: manualName.trim(),
      name_original: manualNameOriginal.trim() || undefined,
      meal_types: parseMealTypes(manualMealTypes),
      servings: manualServings ? Number(manualServings) : undefined,
      source_url: manualSourceUrl.trim() || null,
      thumbnail_url: manualThumbnailUrl.trim() || null,
      notes: showNotes ? manualNotes.trim() || undefined : undefined,
      ingredients: parseIngredients(manualIngredients),
      ingredients_original: parseIngredients(manualIngredientsOriginal || manualIngredients),
      instructions: parseInstructions(manualInstructions),
      instructions_original: parseInstructions(manualInstructionsOriginal || manualInstructions),
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
  const primaryInstructions = showEnglishPrimary ? manualInstructions : manualInstructionsOriginal;
  const secondaryInstructions = showEnglishPrimary ? manualInstructionsOriginal : manualInstructions;
  const setPrimaryInstructions = showEnglishPrimary ? setManualInstructions : setManualInstructionsOriginal;
  const setSecondaryInstructions = showEnglishPrimary ? setManualInstructionsOriginal : setManualInstructions;
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
        <div className="mt-3 space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            {primaryLabel} <span className="text-rose-500">*</span>
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
            value={primaryNameValue}
            onChange={(event) => setPrimaryName(event.target.value)}
          />
          <label className="text-xs uppercase tracking-wide text-slate-400">Meal types</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
            value={manualMealTypes}
            onChange={(event) => setManualMealTypes(event.target.value)}
          />
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Instructions ({showEnglishPrimary ? "en" : "original"})
          </label>
          <textarea
            className="min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            value={primaryInstructions}
            onChange={(event) => setPrimaryInstructions(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Ingredients ({showEnglishPrimary ? "en" : "original"})
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Servings</span>
              <input
                className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-xs"
                value={manualServings}
                onChange={(event) => setManualServings(event.target.value)}
              />
            </div>
          </div>
          <textarea
            className="min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            placeholder="name,quantity,unit"
            value={primaryIngredients}
            onChange={(event) => setPrimaryIngredients(event.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:text-slate-700"
            onClick={() => setShowNotes((prev) => !prev)}
          >
            {showNotes ? "Hide notes" : "Add notes"}
          </button>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:text-slate-700"
            onClick={() => setShowOtherLanguage((prev) => !prev)}
          >
            {showOtherLanguage ? "Hide other language fields" : "Show other language fields"}
          </button>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:text-slate-700"
            onClick={() => setShowSourceUrl((prev) => !prev)}
          >
            {showSourceUrl ? "Hide source URL" : "Add source URL"}
          </button>
        </div>
        {showSourceUrl && (
          <div className="mt-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">Source URL</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
              value={manualSourceUrl}
              onChange={(event) => setManualSourceUrl(event.target.value)}
            />
          </div>
        )}
        {showNotes && (
          <div className="mt-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">Notes</label>
            <textarea
              className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
            />
          </div>
        )}
        {showOtherLanguage && (
          <div className="mt-3 space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">{secondaryLabel}</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
              value={secondaryNameValue}
              onChange={(event) => setSecondaryName(event.target.value)}
            />
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Instructions ({showEnglishPrimary ? "original" : "en"})
            </label>
            <textarea
              className="min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              value={secondaryInstructions}
              onChange={(event) => setSecondaryInstructions(event.target.value)}
            />
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Ingredients ({showEnglishPrimary ? "original" : "en"})
            </label>
            <textarea
              className="min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              placeholder="name,quantity,unit"
              value={secondaryIngredients}
              onChange={(event) => setSecondaryIngredients(event.target.value)}
            />
          </div>
        )}
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

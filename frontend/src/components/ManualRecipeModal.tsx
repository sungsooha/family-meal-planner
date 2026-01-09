"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { CreatedRecipe } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

type Ingredient = { name: string; quantity: number | string; unit: string };
type IngredientDraft = { name: string; quantity: string; unit: string };
type InstructionDraft = { text: string };

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

  const parseQuantity = (value: string): number | string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const numeric = Number(trimmed);
    return Number.isNaN(numeric) ? trimmed : numeric;
  };

  const addIngredient = (
    draft: IngredientDraft,
    setDraft: (value: IngredientDraft) => void,
    items: Ingredient[],
    setItems: (value: Ingredient[]) => void,
  ) => {
    if (!draft.name.trim()) return;
    const next: Ingredient = {
      name: draft.name.trim(),
      quantity: parseQuantity(draft.quantity),
      unit: draft.unit.trim(),
    };
    setItems([...items, next]);
    setDraft({ name: "", quantity: "", unit: "" });
  };

  const updateIngredient = (
    items: Ingredient[],
    setItems: (value: Ingredient[]) => void,
    index: number,
    patch: Partial<Ingredient>,
  ) => {
    setItems(items.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const removeIngredient = (
    items: Ingredient[],
    setItems: (value: Ingredient[]) => void,
    index: number,
  ) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const addInstruction = (
    draft: InstructionDraft,
    setDraft: (value: InstructionDraft) => void,
    items: string[],
    setItems: (value: string[]) => void,
  ) => {
    if (!draft.text.trim()) return;
    setItems([...items, draft.text.trim()]);
    setDraft({ text: "" });
  };

  const updateInstruction = (
    items: string[],
    setItems: (value: string[]) => void,
    index: number,
    value: string,
  ) => {
    setItems(items.map((item, idx) => (idx === index ? value : item)));
  };

  const removeInstruction = (
    items: string[],
    setItems: (value: string[]) => void,
    index: number,
  ) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

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
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
            {primaryInstructions.length > 0 ? (
              <div className="grid gap-2">
                {primaryInstructions.map((step, index) => (
                  <div
                    key={`step-${index}`}
                    className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="mt-1 text-[10px] text-slate-400">{index + 1}</span>
                    <input
                      className="flex-1 text-xs text-slate-700 focus:outline-none"
                      value={step}
                      onChange={(event) =>
                        updateInstruction(
                          primaryInstructions,
                          setPrimaryInstructions,
                          index,
                          event.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      className="mt-0.5 text-slate-400 hover:text-rose-500"
                      onClick={() =>
                        removeInstruction(primaryInstructions, setPrimaryInstructions, index)
                      }
                      aria-label="Remove step"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">No steps added yet.</p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                placeholder="Add step"
                value={primaryInstructionDraft.text}
                onChange={(event) =>
                  setPrimaryInstructionDraft({ text: event.target.value })
                }
              />
              <button
                type="button"
                className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:text-slate-800"
                onClick={() =>
                  addInstruction(
                    primaryInstructionDraft,
                    setPrimaryInstructionDraft,
                    primaryInstructions,
                    setPrimaryInstructions,
                  )
                }
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid gap-2 sm:grid-cols-[1.2fr_0.6fr_0.6fr_auto]">
              <input
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                placeholder="Ingredient"
                value={primaryDraft.name}
                onChange={(event) =>
                  setPrimaryDraft({ ...primaryDraft, name: event.target.value })
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                placeholder="Qty"
                value={primaryDraft.quantity}
                onChange={(event) =>
                  setPrimaryDraft({ ...primaryDraft, quantity: event.target.value })
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                placeholder="Unit"
                value={primaryDraft.unit}
                onChange={(event) =>
                  setPrimaryDraft({ ...primaryDraft, unit: event.target.value })
                }
              />
              <button
                type="button"
                className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:text-slate-800"
                onClick={() =>
                  addIngredient(primaryDraft, setPrimaryDraft, primaryIngredients, setPrimaryIngredients)
                }
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {primaryIngredients.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {primaryIngredients.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:grid-cols-[1.2fr_0.6fr_0.6fr_auto]"
                  >
                    <input
                      className="text-xs text-slate-700 focus:outline-none"
                      value={item.name}
                      onChange={(event) =>
                        updateIngredient(primaryIngredients, setPrimaryIngredients, index, {
                          name: event.target.value,
                        })
                      }
                    />
                    <input
                      className="text-xs text-slate-700 focus:outline-none"
                      value={String(item.quantity ?? "")}
                      onChange={(event) =>
                        updateIngredient(primaryIngredients, setPrimaryIngredients, index, {
                          quantity: parseQuantity(event.target.value),
                        })
                      }
                    />
                    <input
                      className="text-xs text-slate-700 focus:outline-none"
                      value={item.unit}
                      onChange={(event) =>
                        updateIngredient(primaryIngredients, setPrimaryIngredients, index, {
                          unit: event.target.value,
                        })
                      }
                    />
                    <button
                      type="button"
                      className="flex items-center justify-center text-slate-400 hover:text-rose-500"
                      onClick={() =>
                        removeIngredient(primaryIngredients, setPrimaryIngredients, index)
                      }
                      aria-label="Remove ingredient"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-slate-400">No ingredients added yet.</p>
            )}
          </div>
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              {secondaryInstructions.length > 0 ? (
                <div className="grid gap-2">
                  {secondaryInstructions.map((step, index) => (
                    <div
                      key={`step-secondary-${index}`}
                      className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <span className="mt-1 text-[10px] text-slate-400">{index + 1}</span>
                      <input
                        className="flex-1 text-xs text-slate-700 focus:outline-none"
                        value={step}
                        onChange={(event) =>
                          updateInstruction(
                            secondaryInstructions,
                            setSecondaryInstructions,
                            index,
                            event.target.value,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="mt-0.5 text-slate-400 hover:text-rose-500"
                        onClick={() =>
                          removeInstruction(secondaryInstructions, setSecondaryInstructions, index)
                        }
                        aria-label="Remove step"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">No steps added yet.</p>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                  placeholder="Add step"
                  value={secondaryInstructionDraft.text}
                  onChange={(event) =>
                    setSecondaryInstructionDraft({ text: event.target.value })
                  }
                />
                <button
                  type="button"
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:text-slate-800"
                  onClick={() =>
                    addInstruction(
                      secondaryInstructionDraft,
                      setSecondaryInstructionDraft,
                      secondaryInstructions,
                      setSecondaryInstructions,
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Ingredients ({showEnglishPrimary ? "original" : "en"})
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="grid gap-2 sm:grid-cols-[1.2fr_0.6fr_0.6fr_auto]">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                  placeholder="Ingredient"
                  value={secondaryDraft.name}
                  onChange={(event) =>
                    setSecondaryDraft({ ...secondaryDraft, name: event.target.value })
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                  placeholder="Qty"
                  value={secondaryDraft.quantity}
                  onChange={(event) =>
                    setSecondaryDraft({ ...secondaryDraft, quantity: event.target.value })
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                  placeholder="Unit"
                  value={secondaryDraft.unit}
                  onChange={(event) =>
                    setSecondaryDraft({ ...secondaryDraft, unit: event.target.value })
                  }
                />
                <button
                  type="button"
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:text-slate-800"
                  onClick={() =>
                    addIngredient(
                      secondaryDraft,
                      setSecondaryDraft,
                      secondaryIngredients,
                      setSecondaryIngredients,
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {secondaryIngredients.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {secondaryIngredients.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:grid-cols-[1.2fr_0.6fr_0.6fr_auto]"
                    >
                      <input
                        className="text-xs text-slate-700 focus:outline-none"
                        value={item.name}
                        onChange={(event) =>
                          updateIngredient(secondaryIngredients, setSecondaryIngredients, index, {
                            name: event.target.value,
                          })
                        }
                      />
                      <input
                        className="text-xs text-slate-700 focus:outline-none"
                        value={String(item.quantity ?? "")}
                        onChange={(event) =>
                          updateIngredient(secondaryIngredients, setSecondaryIngredients, index, {
                            quantity: parseQuantity(event.target.value),
                          })
                        }
                      />
                      <input
                        className="text-xs text-slate-700 focus:outline-none"
                        value={item.unit}
                        onChange={(event) =>
                          updateIngredient(secondaryIngredients, setSecondaryIngredients, index, {
                            unit: event.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        className="flex items-center justify-center text-slate-400 hover:text-rose-500"
                        onClick={() =>
                          removeIngredient(secondaryIngredients, setSecondaryIngredients, index)
                        }
                        aria-label="Remove ingredient"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-slate-400">No ingredients added yet.</p>
              )}
            </div>
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

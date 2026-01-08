"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Ingredient = { name: string; quantity: number | string; unit: string };

export type ManualRecipePayload = {
  recipe_id: string;
  name: string;
  meal_types?: string[];
  servings?: number;
  source_url?: string | null;
  notes?: string;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (recipe: ManualRecipePayload) => void | Promise<void>;
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

export default function ManualRecipeModal({ open, onClose, onCreated }: Props) {
  const [manualRecipeId, setManualRecipeId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualMealTypes, setManualMealTypes] = useState("");
  const [manualServings, setManualServings] = useState("");
  const [manualSourceUrl, setManualSourceUrl] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualIngredients, setManualIngredients] = useState("");
  const [manualIngredientsOriginal, setManualIngredientsOriginal] = useState("");
  const [manualInstructions, setManualInstructions] = useState("");
  const [manualInstructionsOriginal, setManualInstructionsOriginal] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");

  const resetManualForm = () => {
    setManualRecipeId("");
    setManualName("");
    setManualMealTypes("");
    setManualServings("");
    setManualSourceUrl("");
    setManualNotes("");
    setManualIngredients("");
    setManualIngredientsOriginal("");
    setManualInstructions("");
    setManualInstructionsOriginal("");
    setManualError("");
    setManualSuccess("");
  };

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
      meal_types: parseMealTypes(manualMealTypes),
      servings: manualServings ? Number(manualServings) : undefined,
      source_url: manualSourceUrl.trim() || null,
      notes: manualNotes.trim() || undefined,
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

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-400">Add recipe</p>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
            />
            <label className="text-xs uppercase tracking-wide text-slate-400">Meal types (comma-separated)</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={manualMealTypes}
              onChange={(event) => setManualMealTypes(event.target.value)}
            />
            <label className="text-xs uppercase tracking-wide text-slate-400">Servings</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={manualServings}
              onChange={(event) => setManualServings(event.target.value)}
            />
            <label className="text-xs uppercase tracking-wide text-slate-400">Recipe ID</label>
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={manualRecipeId}
                onChange={(event) => setManualRecipeId(event.target.value)}
              />
              <button
                className="flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
                onClick={() => setManualRecipeId(crypto.randomUUID().replace(/-/g, ""))}
              >
                Generate
              </button>
            </div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Source URL</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={manualSourceUrl}
              onChange={(event) => setManualSourceUrl(event.target.value)}
            />
            <label className="text-xs uppercase tracking-wide text-slate-400">Notes</label>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">Ingredients (en)</label>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              placeholder="name,quantity,unit"
              value={manualIngredients}
              onChange={(event) => setManualIngredients(event.target.value)}
            />
            <label className="text-xs uppercase tracking-wide text-slate-400">Ingredients (original)</label>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              placeholder="name,quantity,unit"
              value={manualIngredientsOriginal}
              onChange={(event) => setManualIngredientsOriginal(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Instructions (en)</label>
            <textarea
              className="min-h-[160px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              value={manualInstructions}
              onChange={(event) => setManualInstructions(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Instructions (original)</label>
            <textarea
              className="min-h-[160px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              value={manualInstructionsOriginal}
              onChange={(event) => setManualInstructionsOriginal(event.target.value)}
            />
          </div>
        </div>
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

"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { Upload, X, Shuffle } from "lucide-react";
import type { RecipesCreateResponse } from "@/lib/types";

export type ImportedRecipe = {
  recipe_id: string;
  name: string;
  name_original?: string;
  meal_types?: string[];
  servings?: number;
  source_url?: string | null;
  notes?: string;
  ingredients?: Array<{ name: string; quantity: number | string; unit: string }>;
  ingredients_original?: Array<{ name: string; quantity: number | string; unit: string }>;
  instructions?: string[];
  instructions_original?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImported?: (recipe: ImportedRecipe) => void | Promise<void>;
};

export default function RecipeImportModal({ open, onClose, onImported }: Props) {
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonSuccess, setJsonSuccess] = useState("");
  const [recipeIdInput, setRecipeIdInput] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");

  const handleJsonFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonInput(text);
  };

  const generateRecipeId = () => {
    const id = crypto.randomUUID().replace(/-/g, "");
    setRecipeIdInput(id);
  };

  const resetForm = () => {
    setJsonInput("");
    setJsonError("");
    setJsonSuccess("");
    setRecipeIdInput("");
    setSourceUrlInput("");
  };

  const handleImport = async () => {
    setJsonError("");
    setJsonSuccess("");
    let parsed: ImportedRecipe;
    try {
      parsed = JSON.parse(jsonInput) as ImportedRecipe;
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
    parsed = {
      ...parsed,
      recipe_id: finalRecipeId,
      source_url: finalSourceUrl || parsed.source_url || null,
    };
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
      const data = (await response.json().catch(() => ({}))) as RecipesCreateResponse;
      setJsonError(data.error ?? "Failed to import recipe.");
      return;
    }
    setJsonSuccess("Recipe imported.");
    resetForm();
    onClose();
    if (onImported) {
      await onImported(parsed);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            <Upload className="h-4 w-4" />
            Import from JSON
          </div>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Paste the JSON returned by ChatGPT or upload a JSON file. You can provide an optional recipe ID and source URL.
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
          className="mt-3 min-h-[160px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs text-slate-700"
          placeholder='{"recipe_id":"...","name":"..."}'
          value={jsonInput}
          onChange={(event) => setJsonInput(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-emerald-700 px-4 py-2 text-xs text-white hover:bg-emerald-600"
            onClick={handleImport}
          >
            Add recipe
          </button>
          <label className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 hover:text-slate-700">
            <input type="file" className="hidden" accept=".json" onChange={handleJsonFile} />
            Upload JSON file
          </label>
          {jsonError && <span className="text-xs text-rose-500">{jsonError}</span>}
          {jsonSuccess && <span className="text-xs text-emerald-600">{jsonSuccess}</span>}
        </div>
      </div>
    </div>
  );
}

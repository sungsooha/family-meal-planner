"use client";

import { Plus, X } from "lucide-react";
import type { Ingredient } from "@/lib/types";

export type IngredientDraft = { name: string; quantity: string; unit: string };
export type InstructionDraft = { text: string };

type Props = {
  language: "en" | "original";
  primaryLabel: string;
  secondaryLabel: string;
  primaryNameValue: string;
  setPrimaryName: (value: string) => void;
  secondaryNameValue: string;
  setSecondaryName: (value: string) => void;
  mealTypesValue: string;
  setMealTypesValue: (value: string) => void;
  servingsValue: string;
  setServingsValue: (value: string) => void;
  primaryInstructions: string[];
  setPrimaryInstructions: (value: string[]) => void;
  secondaryInstructions: string[];
  setSecondaryInstructions: (value: string[]) => void;
  primaryIngredients: Ingredient[];
  setPrimaryIngredients: (value: Ingredient[]) => void;
  secondaryIngredients: Ingredient[];
  setSecondaryIngredients: (value: Ingredient[]) => void;
  primaryIngredientDraft: IngredientDraft;
  setPrimaryIngredientDraft: (value: IngredientDraft) => void;
  secondaryIngredientDraft: IngredientDraft;
  setSecondaryIngredientDraft: (value: IngredientDraft) => void;
  primaryInstructionDraft: InstructionDraft;
  setPrimaryInstructionDraft: (value: InstructionDraft) => void;
  secondaryInstructionDraft: InstructionDraft;
  setSecondaryInstructionDraft: (value: InstructionDraft) => void;
  showOtherLanguage: boolean;
  onToggleOtherLanguage: () => void;
  showNotes: boolean;
  onToggleNotes: () => void;
  notesValue: string;
  setNotesValue: (value: string) => void;
  showSourceUrl: boolean;
  onToggleSourceUrl: () => void;
  sourceUrlValue: string;
  setSourceUrlValue: (value: string) => void;
};

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

export default function RecipeFormBody({
  language,
  primaryLabel,
  secondaryLabel,
  primaryNameValue,
  setPrimaryName,
  secondaryNameValue,
  setSecondaryName,
  mealTypesValue,
  setMealTypesValue,
  servingsValue,
  setServingsValue,
  primaryInstructions,
  setPrimaryInstructions,
  secondaryInstructions,
  setSecondaryInstructions,
  primaryIngredients,
  setPrimaryIngredients,
  secondaryIngredients,
  setSecondaryIngredients,
  primaryIngredientDraft,
  setPrimaryIngredientDraft,
  secondaryIngredientDraft,
  setSecondaryIngredientDraft,
  primaryInstructionDraft,
  setPrimaryInstructionDraft,
  secondaryInstructionDraft,
  setSecondaryInstructionDraft,
  showOtherLanguage,
  onToggleOtherLanguage,
  showNotes,
  onToggleNotes,
  notesValue,
  setNotesValue,
  showSourceUrl,
  onToggleSourceUrl,
  sourceUrlValue,
  setSourceUrlValue,
}: Props) {
  return (
    <>
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
          value={mealTypesValue}
          onChange={(event) => setMealTypesValue(event.target.value)}
        />
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Instructions ({language === "en" ? "en" : "original"})
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
                      updateInstruction(primaryInstructions, setPrimaryInstructions, index, event.target.value)
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
              onChange={(event) => setPrimaryInstructionDraft({ text: event.target.value })}
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
            Ingredients ({language === "en" ? "en" : "original"})
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">Servings</span>
            <input
              className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-xs"
              value={servingsValue}
              onChange={(event) => setServingsValue(event.target.value)}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1.2fr_0.6fr_0.6fr_auto]">
            <input
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              placeholder="Ingredient"
              value={primaryIngredientDraft.name}
              onChange={(event) =>
                setPrimaryIngredientDraft({ ...primaryIngredientDraft, name: event.target.value })
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              placeholder="Qty"
              value={primaryIngredientDraft.quantity}
              onChange={(event) =>
                setPrimaryIngredientDraft({ ...primaryIngredientDraft, quantity: event.target.value })
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              placeholder="Unit"
              value={primaryIngredientDraft.unit}
              onChange={(event) =>
                setPrimaryIngredientDraft({ ...primaryIngredientDraft, unit: event.target.value })
              }
            />
            <button
              type="button"
              className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:text-slate-800"
              onClick={() =>
                addIngredient(
                  primaryIngredientDraft,
                  setPrimaryIngredientDraft,
                  primaryIngredients,
                  setPrimaryIngredients,
                )
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
                    onClick={() => removeIngredient(primaryIngredients, setPrimaryIngredients, index)}
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
          onClick={onToggleNotes}
        >
          {showNotes ? "Hide notes" : "Add notes"}
        </button>
        <button
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:text-slate-700"
          onClick={onToggleOtherLanguage}
        >
          {showOtherLanguage ? "Hide other language fields" : "Show other language fields"}
        </button>
        <button
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:text-slate-700"
          onClick={onToggleSourceUrl}
        >
          {showSourceUrl ? "Hide source URL" : "Add source URL"}
        </button>
      </div>
      {showSourceUrl && (
        <div className="mt-3">
          <label className="text-xs uppercase tracking-wide text-slate-400">Source URL</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
            value={sourceUrlValue}
            onChange={(event) => setSourceUrlValue(event.target.value)}
          />
        </div>
      )}
      {showNotes && (
        <div className="mt-3">
          <label className="text-xs uppercase tracking-wide text-slate-400">Notes</label>
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            value={notesValue}
            onChange={(event) => setNotesValue(event.target.value)}
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
            Instructions ({language === "en" ? "original" : "en"})
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
                        updateInstruction(secondaryInstructions, setSecondaryInstructions, index, event.target.value)
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
                onChange={(event) => setSecondaryInstructionDraft({ text: event.target.value })}
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
            Ingredients ({language === "en" ? "original" : "en"})
          </label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid gap-2 sm:grid-cols-[1.2fr_0.6fr_0.6fr_auto]">
              <input
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                placeholder="Ingredient"
                value={secondaryIngredientDraft.name}
                onChange={(event) =>
                  setSecondaryIngredientDraft({ ...secondaryIngredientDraft, name: event.target.value })
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                placeholder="Qty"
                value={secondaryIngredientDraft.quantity}
                onChange={(event) =>
                  setSecondaryIngredientDraft({
                    ...secondaryIngredientDraft,
                    quantity: event.target.value,
                  })
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                placeholder="Unit"
                value={secondaryIngredientDraft.unit}
                onChange={(event) =>
                  setSecondaryIngredientDraft({ ...secondaryIngredientDraft, unit: event.target.value })
                }
              />
              <button
                type="button"
                className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:text-slate-800"
                onClick={() =>
                  addIngredient(
                    secondaryIngredientDraft,
                    setSecondaryIngredientDraft,
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
    </>
  );
}

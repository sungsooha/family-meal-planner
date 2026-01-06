"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Plus,
  Minus,
  ShoppingCart,
  Pencil,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
  ListChecks,
  ShoppingBasket,
  SlidersHorizontal,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/ToastProvider";

type ShoppingItem = {
  name: string;
  unit: string;
  quantity: string | number;
  recipes_count: number;
  recipe_ids: string[];
  key: string;
  default_quantity?: string | number;
  default_unit?: string;
};

type Recipe = {
  recipe_id: string;
  name: string;
  meal_types?: string[];
  servings?: number;
  ingredients?: { name: string; quantity: number | string; unit: string }[];
  ingredients_original?: { name: string; quantity: number | string; unit: string }[];
  instructions?: string[];
  instructions_original?: string[];
};

type ShoppingPayload = {
  weekly_list: ShoppingItem[];
  shopping_items: ShoppingItem[];
  lang: string;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function postAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/shopping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Shopping update failed");
  return response.json();
}

export default function ShoppingPage() {
  const [weeklyList, setWeeklyList] = useState<ShoppingItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const { language: lang } = useLanguage();
  const { showToast } = useToast();
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("");
  const [manualUnit, setManualUnit] = useState("");
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [recipeIndex, setRecipeIndex] = useState(0);
  const [recipeDetail, setRecipeDetail] = useState<Recipe | null>(null);
  const [startDate, setStartDate] = useState("");
  const [actionHidden, setActionHidden] = useState(false);
  const [actionPinned, setActionPinned] = useState(false);
  const pinnedScroll = useRef(0);

  const shoppingKey = useMemo(() => {
    const params = new URLSearchParams({ lang });
    if (startDate) params.set("start_date", startDate);
    return `/api/shopping?${params.toString()}`;
  }, [lang, startDate]);

  const { data: shoppingData, mutate: mutateShopping } = useSWR<ShoppingPayload>(shoppingKey);

  useEffect(() => {
    const stored = window.localStorage.getItem("mealplanner-start-date");
    if (stored) {
      setStartDate(stored);
    } else {
      const today = formatLocalDate(new Date());
      setStartDate(today);
      window.localStorage.setItem("mealplanner-start-date", today);
    }
  }, []);

  useEffect(() => {
    if (shoppingData) {
      setWeeklyList(shoppingData.weekly_list);
      setShoppingList(shoppingData.shopping_items);
    }
  }, [shoppingData]);

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

  const handleAdd = async (item: ShoppingItem) => {
    await postAction({ action: "add", key: item.key, name: item.name, unit: item.unit, quantity: item.quantity, lang });
    await mutateShopping();
  };

  const handleRemove = async (item: ShoppingItem) => {
    await postAction({ action: "remove", key: item.key, lang });
    await mutateShopping();
  };

  const handleAddManual = async () => {
    if (!manualName.trim()) return;
    await postAction({
      action: "add-manual",
      name: manualName.trim(),
      quantity: manualQuantity.trim(),
      unit: manualUnit.trim(),
      lang,
    });
    setManualName("");
    setManualQuantity("");
    setManualUnit("");
    await mutateShopping();
  };

  const handlePrintChecklist = () => {
    const items = shoppingList;
    const title = lang === "original" ? "장보기 목록" : "Shopping List";
    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: "Helvetica Neue", Arial, sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            ul { list-style: none; padding: 0; }
            li { margin-bottom: 8px; font-size: 14px; display: flex; align-items: center; gap: 8px; }
            input { width: 16px; height: 16px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <ul>
            ${items
              .map(
                (item) =>
                  `<li><input type="checkbox" /> ${item.name} — ${item.quantity} ${item.unit}</li>`,
              )
              .join("")}
          </ul>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleSaveBuyList = async () => {
    if (!startDate) {
      showToast("Select a week start date first.");
      return;
    }
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const weekEnd = formatLocalDate(end);
    const payload = {
      id: crypto.randomUUID(),
      week_start: startDate,
      week_end: weekEnd,
      saved_at: new Date().toISOString(),
      status: "open",
      lang,
      items: shoppingList.map((item) => ({
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        key: item.key,
      })),
    };
    const response = await fetch("/api/buy-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      showToast("Failed to save buy list.");
      return;
    }
    showToast("Buy list saved.");
  };

  const openEdit = (item: ShoppingItem) => {
    setEditingItem(item);
    setEditingQuantity(String(item.quantity ?? ""));
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    await postAction({ action: "update", key: editingItem.key, quantity: editingQuantity, lang });
    setEditingItem(null);
    await mutateShopping();
  };

  const openRecipes = (ids: string[]) => {
    if (!ids.length) return;
    setRecipeIds(ids);
    setRecipeIndex(0);
  };

  const activeRecipeId = recipeIds[recipeIndex];

  const { data: recipeDetailData } = useSWR<Recipe | null>(
    activeRecipeId ? `/api/recipes/${activeRecipeId}` : null,
  );

  useEffect(() => {
    setRecipeDetail(recipeDetailData ?? null);
  }, [recipeDetailData]);

  const recipeIngredients = useMemo(() => {
    if (!recipeDetail) return [];
    return lang === "original" ? recipeDetail.ingredients_original ?? [] : recipeDetail.ingredients ?? [];
  }, [recipeDetail, lang]);

  const recipeInstructions = useMemo(() => {
    if (!recipeDetail) return [];
    return lang === "original" ? recipeDetail.instructions_original ?? [] : recipeDetail.instructions ?? [];
  }, [recipeDetail, lang]);

  return (
    <div className="space-y-6">
      <section
        className={`sticky top-[calc(var(--header-height)+0.5rem)] z-20 scroll-mt-[calc(var(--header-height)+2rem)] rounded-3xl border bg-white/90 p-4 text-xs backdrop-blur transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70 ${
          actionHidden ? "-translate-y-20 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        } border-white/70 shadow-sm`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Shopping</p>
            <h2 className="text-lg font-semibold text-slate-900">Plan the market trip</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <button
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500"
              onClick={handleSaveBuyList}
            >
              Save buy list
            </button>
            <a
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500"
              href="/shopping/saved"
            >
              Saved lists
            </a>
            <button
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500"
              onClick={handlePrintChecklist}
            >
              Print list
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

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Weekly ingredients</p>
              <h3 className="text-lg font-semibold text-slate-900">From the current plan</h3>
            </div>
            <ShoppingCart className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4 space-y-2">
            {weeklyList.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-md hover:ring-1 hover:ring-emerald-200/70"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.quantity} {item.unit} · {item.recipes_count} recipes
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {item.recipe_ids.length > 0 && (
                    <button
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                      onClick={() => openRecipes(item.recipe_ids)}
                      title="View recipes"
                    >
                      <BookOpen className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                    onClick={() => handleAdd(item)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Shopping list</p>
              <h3 className="text-lg font-semibold text-slate-900">What to buy</h3>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:shadow-md hover:ring-1 hover:ring-emerald-200/70">
            <p className="text-xs uppercase tracking-wide text-slate-400">Add manual</p>
            <div className="mt-2 grid gap-2 md:grid-cols-[1.2fr_0.6fr_0.6fr_auto]">
              <input
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                placeholder="Ingredient name"
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                placeholder="Qty"
                value={manualQuantity}
                onChange={(event) => setManualQuantity(event.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                placeholder="Unit"
                value={manualUnit}
                onChange={(event) => setManualUnit(event.target.value)}
              />
              <button
                className="rounded-full bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600"
                onClick={handleAddManual}
              >
                Add
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {shoppingList.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-100 bg-white px-2 py-2 transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 hover:shadow-md hover:ring-1 hover:ring-emerald-200/70">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Default: {item.default_quantity ?? "-"} {item.default_unit ?? item.unit}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Manual: {item.quantity} {item.unit} · {item.recipes_count} recipes
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.recipe_ids.length > 0 && (
                      <button
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                        onClick={() => openRecipes(item.recipe_ids)}
                        title="View recipes"
                      >
                        <BookOpen className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                      onClick={() => openEdit(item)}
                      title="Edit quantity"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                      onClick={() => handleRemove(item)}
                      title="Remove"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {editingItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Update quantity</h4>
              <button onClick={() => setEditingItem(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">{editingItem.name}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                value={editingQuantity}
                onChange={(event) => setEditingQuantity(event.target.value)}
              />
              <span className="text-sm text-slate-400">{editingItem.unit}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-500"
                onClick={() => setEditingItem(null)}
              >
                Cancel
              </button>
              <button className="rounded-full bg-emerald-700 px-4 py-2 text-xs text-white hover:bg-emerald-600" onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {recipeIds.length > 0 && recipeDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Used in recipes</p>
                <h4 className="text-lg font-semibold text-slate-900">{recipeDetail.name}</h4>
              </div>
              <button onClick={() => setRecipeIds([])}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                onClick={() => setRecipeIndex((prev) => Math.max(prev - 1, 0))}
                disabled={recipeIndex === 0}
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <p className="text-xs text-slate-400">
                {recipeIndex + 1} / {recipeIds.length}
              </p>
              <button
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                onClick={() => setRecipeIndex((prev) => Math.min(prev + 1, recipeIds.length - 1))}
                disabled={recipeIndex >= recipeIds.length - 1}
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
                  <ListChecks className="h-4 w-4 text-slate-400" />
                  <h5 className="text-sm font-semibold text-slate-900">Instructions</h5>
                </div>
                <ol className="mt-2 space-y-2 text-sm text-slate-600">
                  {recipeInstructions.map((line, idx) => (
                    <li key={`${line}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      {line}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
                  <ShoppingBasket className="h-4 w-4 text-slate-400" />
                  <h5 className="text-sm font-semibold text-slate-900">Ingredients</h5>
                </div>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {recipeIngredients.map((item, idx) => (
                    <li key={`${item.name}-${idx}`} className="flex justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <span>{item.name}</span>
                      <span className="text-slate-400">
                        {item.quantity} {item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

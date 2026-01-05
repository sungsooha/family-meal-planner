"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Lock,
  LockOpen,
  Wand2,
  X,
  Plus,
  Utensils,
  ChefHat,
  CheckCircle2,
  ListChecks,
  ShoppingBasket,
  Heart,
  SlidersHorizontal,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type Ingredient = { name: string; quantity: number | string; unit: string };
type Recipe = {
  recipe_id: string;
  name: string;
  meal_types?: string[];
  servings?: number;
  source_url?: string | null;
  thumbnail_url?: string | null;
  notes?: string;
  family_feedback_score?: number;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};
type Meal = {
  recipe_id?: string;
  name?: string;
  locked?: boolean;
  completed?: boolean;
  ingredients?: Ingredient[];
} | null;
type WeeklyPlan = { start_date: string; days: Array<{ date: string; meals: Record<string, Meal> }> };

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const MEAL_BADGES: Record<string, string> = {
  breakfast: "bg-amber-100 text-amber-800",
  lunch: "bg-sky-100 text-sky-800",
  dinner: "bg-emerald-100 text-emerald-800",
};

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Request failed");
  return response.json() as Promise<T>;
}

export default function WeeklyPlanPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [pickerReady, setPickerReady] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [plannedDates, setPlannedDates] = useState<Set<string>>(new Set());
  const [selectMeal, setSelectMeal] = useState<{ date: string; meal: string } | null>(null);
  const [addMenu, setAddMenu] = useState<{ date: string; meal: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonSuccess, setJsonSuccess] = useState("");
  const [recipeIdInput, setRecipeIdInput] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [activeMealContext, setActiveMealContext] = useState<{ date: string; meal: string } | null>(null);
  const { language } = useLanguage();
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const [collapsePast, setCollapsePast] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionHidden, setActionHidden] = useState(false);
  const lastScrollY = useRef(0);
  const pickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const pickerPanelRef = useRef<HTMLDivElement | null>(null);
  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.recipe_id, recipe])), [recipes]);

  const loadPlan = useCallback(async (targetDate?: string) => {
    const query = targetDate ? `?start_date=${targetDate}` : "";
    const response = await fetch(`/api/plan${query}`);
    const data = (await response.json()) as WeeklyPlan;
    setPlan(data);
    setStartDate(data.start_date);
  }, []);

  const loadRecipes = useCallback(async () => {
    const response = await fetch("/api/recipes");
    const data = (await response.json()) as Recipe[];
    setRecipes(data);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("mealplanner-start-date");
    if (stored) {
      const storedDate = new Date(`${stored}T00:00:00`);
      setCalendarMonth(new Date(storedDate.getFullYear(), storedDate.getMonth(), 1));
      loadPlan(stored);
    } else {
      loadPlan(undefined);
    }
    loadRecipes();
  }, [loadPlan, loadRecipes]);

  useEffect(() => {
    fetch("/api/plan/dates")
      .then((res) => res.json())
      .then((data) => setPlannedDates(new Set((data.dates ?? []) as string[])))
      .catch(() => setPlannedDates(new Set()));
  }, []);

  useEffect(() => {
    if (!plan) return;
    setCollapsedDays((prev) => {
      const next = { ...prev };
      const today = new Date().toISOString().split("T")[0];
      plan.days.forEach((day) => {
        if (next[day.date] === undefined) {
          next[day.date] = collapsePast ? day.date < today : false;
        }
      });
      return next;
    });
  }, [plan, collapsePast]);


  useEffect(() => {
    if (!activeRecipeId) {
      setActiveRecipe(null);
      return;
    }
    fetch(`/api/recipes/${activeRecipeId}`)
      .then((res) => res.json())
      .then((data) => setActiveRecipe(data as Recipe))
      .catch(() => setActiveRecipe(null));
  }, [activeRecipeId]);

  useEffect(() => {
    if (activeRecipe) {
      setDrawerOpen(true);
    }
  }, [activeRecipe]);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      if (current > 160 && current > lastScrollY.current + 6) {
        setActionHidden(true);
      } else if (current < lastScrollY.current - 6) {
        setActionHidden(false);
      }
      lastScrollY.current = current;
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (!pickerOpen) return;
    setPickerReady(false);
    const updatePosition = () => {
      if (!pickerButtonRef.current || !pickerPanelRef.current) return;
      const buttonRect = pickerButtonRef.current.getBoundingClientRect();
      const panelRect = pickerPanelRef.current.getBoundingClientRect();
      const margin = 16;
      const belowTop = buttonRect.bottom + 8;
      const aboveTop = buttonRect.top - panelRect.height - 8;
      let top = belowTop;
      if (belowTop + panelRect.height > window.innerHeight - margin && aboveTop >= margin) {
        top = aboveTop;
      } else if (belowTop + panelRect.height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - margin - panelRect.height);
      }
      let left = buttonRect.left;
      if (left + panelRect.width > window.innerWidth - margin) {
        left = window.innerWidth - margin - panelRect.width;
      }
      left = Math.max(margin, left);
      setPickerPos({ top, left });
      setPickerReady(true);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { passive: true });
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [pickerOpen]);

  const mealTypeOptions = useMemo(() => ["breakfast", "lunch", "dinner"], []);

  const filteredRecipes = useMemo(() => {
    if (!selectMeal) return recipes;
    return recipes.filter((recipe) => {
      const types = recipe.meal_types ?? [];
      return types.length === 0 || types.includes(selectMeal.meal);
    });
  }, [recipes, selectMeal]);

  const handleGenerate = async () => {
    if (!startDate) return;
    const updated = await postJson<WeeklyPlan>("/api/plan/generate", { start_date: startDate });
    setPlan(updated);
  };

  const handleStartDate = async (value: string) => {
    setStartDate(value);
    window.localStorage.setItem("mealplanner-start-date", value);
    const updated = await postJson<WeeklyPlan>("/api/plan/start", { start_date: value });
    setPlan(updated);
    setPickerOpen(false);
  };

  const handleAssign = async (recipeId: string) => {
    if (!selectMeal) return;
    const updated = await postJson<WeeklyPlan>("/api/plan/assign", {
      date: selectMeal.date,
      meal: selectMeal.meal,
      recipe_id: recipeId,
      start_date: startDate,
    });
    setPlan(updated);
    setSelectMeal(null);
  };

  const handleClear = async (date: string, meal: string) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/clear", { date, meal, start_date: startDate });
    setPlan(updated);
  };

  const handleToggleLock = async (date: string, meal: string) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/lock", { date, meal, start_date: startDate });
    setPlan(updated);
  };

  const handleLockAll = async (locked: boolean) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/lock-all", { locked, start_date: startDate });
    setPlan(updated);
  };

  const handleToggleComplete = async (date: string, meal: string) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/complete", { date, meal, start_date: startDate });
    setPlan(updated);
  };

  const handlePrintWeek = () => {
    if (!plan) return;
    const title = "Weekly Meal Plan";
    const rows = plan.days
      .map((day) => {
        const dayLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
        const breakfast = day.meals.breakfast?.name ?? "-";
        const lunch = day.meals.lunch?.name ?? "-";
        const dinner = day.meals.dinner?.name ?? "-";
        return `<tr><td>${dayLabel}</td><td>${breakfast}</td><td>${lunch}</td><td>${dinner}</td></tr>`;
      })
      .join("");
    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: "Helvetica Neue", Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Dinner</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const dayName = (isoDate: string) =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const buildCalendar = (month: Date) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: Array<{ date: string; label: number; inMonth: boolean }> = [];
    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ date: "", label: 0, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, monthIndex, day);
      const iso = date.toISOString().split("T")[0];
      cells.push({ date: iso, label: day, inMonth: true });
    }
    return cells;
  };

  const ingredientList = language === "original" ? activeRecipe?.ingredients_original : activeRecipe?.ingredients;
  const instructionList = language === "original" ? activeRecipe?.instructions_original : activeRecipe?.instructions;
  const activeDay = activeMealContext?.date
    ? plan?.days.find((day) => day.date === activeMealContext.date) ?? null
    : null;
  const activeDayLabel = activeMealContext?.date ? dayName(activeMealContext.date) : "";
  const youtubeId = useMemo(() => {
    const url = activeRecipe?.source_url;
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
  }, [activeRecipe?.source_url]);

  return (
    <div className="space-y-6">
      <section
        className={`sticky top-[calc(var(--header-height)+0.5rem)] z-20 flex scroll-mt-[calc(var(--header-height)+2rem)] flex-wrap items-center justify-between rounded-3xl border bg-white/90 backdrop-blur transition ${
          actionHidden ? "-translate-y-20 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        } gap-2 p-3 text-xs border-white/60 shadow-sm`}
      >
        <div>
          <p className="text-slate-600 text-xs">Week view</p>
          <h2 className="text-lg font-semibold text-slate-900">
            Plan the week with a click
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`flex items-center rounded-full font-medium shadow-sm ${
              collapsePast
                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                : "border border-slate-200 bg-white text-slate-700 hover:text-slate-900"
            } px-3 py-1.5 text-xs`}
            onClick={() => setCollapsePast((prev) => !prev)}
          >
            {collapsePast ? "Collapse past" : "Expand all"}
          </button>
          <button
            className="flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:text-slate-900"
            onClick={() => handleLockAll(true)}
          >
            <Lock className="h-4 w-4" /> Lock all
          </button>
          <button
            className="flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:text-slate-900"
            onClick={() => handleLockAll(false)}
          >
            <LockOpen className="h-4 w-4" /> Unlock all
          </button>
          <button
            className="flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:text-slate-900"
            onClick={handlePrintWeek}
          >
            Print week
          </button>
          <button
            className="flex items-center rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-600"
            onClick={handleGenerate}
          >
            <Wand2 className="h-4 w-4" /> Auto-generate
          </button>
          <div>
            <button
              className="flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:text-slate-900"
              onClick={() => setPickerOpen((prev) => !prev)}
              ref={pickerButtonRef}
            >
              <CalendarDays className="h-4 w-4" />
              {startDate || "Pick start date"}
            </button>
          </div>
        </div>
      </section>
      {pickerOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20"
          onClick={() => setPickerOpen(false)}
        >
          <div
            ref={pickerPanelRef}
            className={`absolute w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:w-72 ${
              pickerReady ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            style={pickerPos ? { top: pickerPos.top, left: pickerPos.left } : { top: 0, left: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 text-sm text-slate-600">
              <button
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs"
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
              >
                Prev
              </button>
              <span className="font-medium text-slate-700">
                {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs"
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
              >
                Next
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-slate-400">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
              {buildCalendar(calendarMonth).map((cell, idx) => {
                if (!cell.inMonth) {
                  return <div key={`empty-${idx}`} />;
                }
                const isSelected = cell.date === startDate;
                const hasPlan = plannedDates.has(cell.date);
                return (
                  <button
                    key={cell.date}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                      isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => handleStartDate(cell.date)}
                  >
                    {cell.label}
                    {hasPlan && <span className="absolute -bottom-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {actionHidden && (
        <button
          className="fixed left-4 top-[calc(var(--header-height)+0.5rem+env(safe-area-inset-top))] z-30 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg backdrop-blur hover:bg-rose-600 sm:left-6"
          onClick={() => setActionHidden(false)}
          aria-label="Show actions"
          title="Show actions"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        {plan?.days
          .filter((day) => !collapsedDays[day.date])
          .map((day) => {
            const missing = Object.values(day.meals).filter((meal) => !meal).length;
            const plannedCount = Object.values(day.meals).filter((meal) => meal).length;
            const completedCount = Object.values(day.meals).filter((meal) => meal?.completed).length;
            const isToday = day.date === new Date().toISOString().split("T")[0];
            const weekday = new Date(`${day.date}T00:00:00`).getDay();
            const isWeekend = weekday === 0 || weekday === 6;
            return (
              <div
                key={day.date}
                className={`rounded-3xl border border-white/70 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70 ${
                  isToday ? "ring-2 ring-emerald-200/80" : ""
                } ${isWeekend ? "bg-rose-50/80" : "bg-white/80"}`}
              >
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{dayName(day.date)}</p>
                    <p className="text-xs text-slate-600">
                      Planned {plannedCount}/3 · Done {completedCount}/3 · {missing} missing
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                      onClick={() =>
                        setCollapsedDays((prev) => ({ ...prev, [day.date]: !prev[day.date] }))
                      }
                    >
                      Collapse
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {mealTypeOptions.map((meal) => {
                    const entry = day.meals[meal];
                    const recipeMeta = entry?.recipe_id ? recipesById.get(entry.recipe_id) : null;
                    const thumbnail = recipeMeta?.thumbnail_url;
                    const displayName = recipeMeta?.name ?? entry?.name;
                    const isSelected =
                      !!entry?.recipe_id &&
                      entry.recipe_id === activeRecipeId &&
                      activeMealContext?.date === day.date &&
                      activeMealContext?.meal === meal;
                    return (
                      <div
                        key={meal}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-200 hover:bg-white hover:shadow-md hover:ring-1 hover:ring-emerald-200/70 ${
                          isSelected ? "border-rose-300 bg-rose-100/70 shadow-sm ring-2 ring-rose-200/70" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {thumbnail ? (
                            <img src={thumbnail} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                              <Utensils className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${MEAL_BADGES[meal]}`}
                            >
                              {MEAL_LABELS[meal]}
                            </span>
                            {displayName ? (
                              <button
                                className={`text-left text-xs font-medium hover:text-slate-700 ${
                                  entry?.completed
                                    ? "text-slate-400 line-through"
                                    : isSelected
                                      ? "text-rose-700"
                                      : "text-slate-900"
                                }`}
                                onClick={() => {
                                  setActiveRecipeId(entry?.recipe_id ?? null);
                                  setActiveMealContext({ date: day.date, meal });
                                }}
                              >
                                {displayName}
                              </button>
                            ) : (
                              <button
                                className="text-left text-xs font-medium text-slate-400 hover:text-slate-500"
                                onClick={() => setSelectMeal({ date: day.date, meal })}
                              >
                                Add a recipe
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {displayName ? (
                            <button
                              className={`rounded-full border px-3 py-1 text-xs ${
                                entry?.completed
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-white text-slate-500"
                              }`}
                              onClick={() => handleToggleComplete(day.date, meal)}
                            >
                              <Heart className="mr-1 inline h-3 w-3" />
                              {entry?.completed ? "Done" : "Mark done"}
                            </button>
                          ) : null}
                          {entry ? (
                            <button
                              className={`rounded-full border px-3 py-1 text-xs ${
                                entry.locked
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-500"
                              }`}
                              onClick={() => handleToggleLock(day.date, meal)}
                              aria-label={entry.locked ? "Unlock" : "Lock"}
                              title={entry.locked ? "Unlock" : "Lock"}
                            >
                              {entry.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                            </button>
                          ) : null}
                          {displayName && !entry?.locked ? (
                            <button
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                              onClick={() => handleClear(day.date, meal)}
                            >
                              Clear
                            </button>
                          ) : null}
                          {entry?.locked ? null : (
                            <button
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                              onClick={() => setAddMenu({ date: day.date, meal })}
                              aria-label="Add recipe"
                              title="Add recipe"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </section>

      {plan?.days.some((day) => collapsedDays[day.date]) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Past days</p>
              <h3 className="text-lg font-semibold text-slate-900">Collapsed summaries</h3>
            </div>
          </div>
          <div className="grid gap-3">
            {plan.days
              .filter((day) => collapsedDays[day.date])
              .map((day) => {
                const missing = Object.values(day.meals).filter((meal) => !meal).length;
                const mealSummary = mealTypeOptions.map((meal) => {
                  const mealValue = day.meals[meal];
                  const recipeMeta = mealValue?.recipe_id ? recipesById.get(mealValue.recipe_id) : null;
                  return {
                    meal,
                    label: MEAL_LABELS[meal],
                    name: recipeMeta?.name ?? mealValue?.name ?? "Not set",
                    missing: !mealValue,
                    completed: Boolean(mealValue?.completed),
                  };
                });
                return (
                  <div
                    key={day.date}
                    className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 transition hover:shadow-md hover:ring-1 hover:ring-emerald-200/70"
                  >
                    <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{dayName(day.date)}</p>
                      <p className="text-xs text-slate-600">{missing} missing</p>
                      </div>
                      <button
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                        onClick={() =>
                          setCollapsedDays((prev) => ({ ...prev, [day.date]: !prev[day.date] }))
                        }
                      >
                        Expand
                      </button>
                    </div>
                    <div className="grid gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-3 py-3 text-xs text-slate-500">
                      {mealSummary.map((item) => (
                        <div key={item.meal} className="flex items-center justify-between">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              MEAL_BADGES[item.meal] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="flex items-center gap-2">
                            {item.completed && <Heart className="h-3 w-3 text-rose-400" />}
                            <span className={item.missing ? "text-rose-400" : "text-slate-600"}>{item.name}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {selectMeal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Select recipe</p>
                <h3 className="text-lg font-semibold text-slate-900">{MEAL_LABELS[selectMeal.meal]}</h3>
              </div>
              <button onClick={() => setSelectMeal(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.recipe_id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 hover:shadow-md hover:ring-1 hover:ring-emerald-200/70"
                  onClick={() => handleAssign(recipe.recipe_id)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{recipe.name}</p>
                    <p className="text-xs text-slate-500">
                      {(recipe.meal_types ?? []).join(", ") || "Flexible"} · {recipe.servings ?? "?"} servings
                    </p>
                  </div>
                  <ChefHat className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {addMenu && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Add recipe</p>
                <h3 className="text-lg font-semibold text-slate-900">{MEAL_LABELS[addMenu.meal]}</h3>
              </div>
              <button onClick={() => setAddMenu(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="grid gap-3">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-slate-300"
                onClick={() => {
                  setSelectMeal(addMenu);
                  setAddMenu(null);
                }}
              >
                Choose from recipes
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-slate-300"
                onClick={() => {
                  setShowImport(true);
                  setAddMenu(null);
                }}
              >
                Add new recipe (JSON)
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">Import from JSON</p>
              <button onClick={() => setShowImport(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Paste the JSON returned by ChatGPT. Recipe ID and source URL are optional.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                placeholder="Recipe ID (optional)"
                value={recipeIdInput}
                onChange={(event) => setRecipeIdInput(event.target.value)}
              />
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
                onClick={() => setRecipeIdInput(crypto.randomUUID().replace(/-/g, ""))}
              >
                Generate
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
                onClick={async () => {
                  setJsonError("");
                  setJsonSuccess("");
                  let parsed;
                  try {
                    parsed = JSON.parse(jsonInput);
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
                  parsed.recipe_id = finalRecipeId;
                  if (finalSourceUrl) parsed.source_url = finalSourceUrl;
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
                    const data = await response.json().catch(() => ({}));
                    setJsonError(data.error ?? "Failed to import recipe.");
                    return;
                  }
                  setJsonSuccess("Recipe imported.");
                  setJsonInput("");
                  setRecipeIdInput("");
                  setSourceUrlInput("");
                  setShowImport(false);
                  loadRecipes();
                }}
              >
                Add recipe
              </button>
              {jsonError && <span className="text-xs text-rose-500">{jsonError}</span>}
              {jsonSuccess && <span className="text-xs text-emerald-600">{jsonSuccess}</span>}
            </div>
          </div>
        </div>
      )}

      {activeRecipe && (
        <div
          className={`fixed inset-y-0 right-0 z-40 w-[90vw] max-w-2xl overflow-y-auto border-l border-slate-200 bg-white/95 p-6 pb-16 shadow-2xl backdrop-blur transition-transform duration-300 ease-out lg:w-[50vw] ${
            drawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Recipe details</p>
              <h3 className="text-lg font-semibold text-slate-900">{activeRecipe.name}</h3>
              {activeMealContext ? (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {activeDayLabel} · {MEAL_LABELS[activeMealContext.meal] ?? activeMealContext.meal}
                </p>
              ) : null}
              <p className="text-sm text-slate-500">
                {(activeRecipe.meal_types ?? []).join(", ") || "Flexible"} · {activeRecipe.servings ?? "?"} servings
              </p>
            </div>
            <button
              onClick={() => {
                setDrawerOpen(false);
                setTimeout(() => setActiveRecipeId(null), 250);
                setActiveMealContext(null);
              }}
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          {activeDay ? (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Day menu</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {mealTypeOptions.map((meal) => {
                  const entry = activeDay.meals[meal];
                  const recipeMeta = entry?.recipe_id ? recipesById.get(entry.recipe_id) : null;
                  const label = recipeMeta?.name ?? entry?.name;
                  const isActive = activeMealContext?.meal === meal;
                  return (
                    <button
                      key={meal}
                      className={`rounded-xl border px-3 py-2 text-left text-[11px] transition ${
                        isActive
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                      onClick={() => {
                        if (entry?.recipe_id) {
                          setActiveRecipeId(entry.recipe_id);
                          setActiveMealContext({ date: activeDay.date, meal });
                        } else {
                          setSelectMeal({ date: activeDay.date, meal });
                          setDrawerOpen(false);
                          setTimeout(() => setActiveRecipeId(null), 250);
                        }
                      }}
                    >
                      <span className="block font-semibold">{MEAL_LABELS[meal]}</span>
                      <span className="mt-0.5 block text-slate-500">{label ?? "Add recipe"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {youtubeId && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
              <iframe
                className="aspect-video w-full"
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title="Recipe video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
                <ListChecks className="h-4 w-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-900">Instructions</h4>
              </div>
              <ol className="mt-2 space-y-2 text-sm text-slate-600">
                {(instructionList ?? []).map((line, idx) => (
                  <li key={`${line}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    {line}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
                <ShoppingBasket className="h-4 w-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-900">Ingredients</h4>
              </div>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {(ingredientList ?? []).map((item, idx) => (
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
      )}
    </div>
  );
}

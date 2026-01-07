"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useRecipes } from "@/lib/useRecipes";
import { useSWRConfig } from "swr";
import Image from "next/image";
import { BLUR_DATA_URL } from "@/lib/image";
import { getSupabaseBrowser } from "@/lib/supabase";
import { getFeedbackSummary } from "@/lib/feedback";
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
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import ActionMenu from "@/components/ActionMenu";
import FamilyFeedback from "@/components/FamilyFeedback";

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
  family_feedback?: Record<string, number>;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};
type FamilyMember = {
  id: string;
  label: string;
};
type AppConfig = {
  family_members?: FamilyMember[];
};
type Meal = {
  recipe_id?: string;
  name?: string;
  locked?: boolean;
  completed?: boolean;
  ingredients?: Ingredient[];
} | null;
type WeeklyPlan = { start_date: string; days: Array<{ date: string; meals: Record<string, Meal> }> };

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
const MEAL_SHORT: Record<string, string> = {
  breakfast: "B",
  lunch: "L",
  dinner: "D",
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
  const [startDate, setStartDate] = useState<string>("");
  const [startDateReady, setStartDateReady] = useState(false);
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
  const activeRecipeRef = useRef<Recipe | null>(null);
  const feedbackVersionRef = useRef(0);
  const feedbackSavingRef = useRef(false);
  const feedbackTimersRef = useRef<Map<string, number>>(new Map());
  const [feedbackTarget, setFeedbackTarget] = useState<{ date: string; meal: string } | null>(null);
  const pickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const pickerPanelRef = useRef<HTMLDivElement | null>(null);
  const { recipes, recipesById, mutateRecipes } = useRecipes<Recipe>();
  const { mutate } = useSWRConfig();
  const prefetchedRecipes = useRef(new Set<string>());
  const prefetchRecipe = useCallback((recipeId: string) => {
    if (prefetchedRecipes.current.has(recipeId)) return;
    prefetchedRecipes.current.add(recipeId);
    mutate(
      `/api/recipes/${recipeId}`,
      fetch(`/api/recipes/${recipeId}`).then((res) => res.json()),
      { populateCache: true, revalidate: false },
    );
  }, [mutate]);

  const planKey = useMemo(() => {
    const query = startDate ? `?start_date=${startDate}` : "";
    return `/api/plan${query}`;
  }, [startDate]);

  const { data: planData, mutate: mutatePlan } = useSWR<WeeklyPlan>(
    startDateReady && startDate ? planKey : null,
  );
  const { data: activeRecipeData } = useSWR<Recipe | null>(
    activeRecipeId ? `/api/recipes/${activeRecipeId}` : null,
  );
  const { data: configData } = useSWR<{ config: AppConfig }>("/api/config");
  const isPlanLoading = !planData && !plan;

  useEffect(() => {
    const stored = window.localStorage.getItem("mealplanner-start-date");
    if (stored) {
      const storedDate = new Date(`${stored}T00:00:00`);
      setCalendarMonth(new Date(storedDate.getFullYear(), storedDate.getMonth(), 1));
      setStartDate(stored);
      setStartDateReady(true);
      return;
    }
    const today = formatLocalDate(new Date());
    setCalendarMonth(new Date());
    setStartDate(today);
    window.localStorage.setItem("mealplanner-start-date", today);
    setStartDateReady(true);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const type = url.searchParams.get("type");
    if (code || error) {
      const redirect = new URL("/auth/callback", url.origin);
      url.searchParams.forEach((value, key) => {
        redirect.searchParams.set(key, value);
      });
      if (type === "recovery") {
        redirect.searchParams.set("reset", "1");
      }
      window.location.href = redirect.toString();
    }
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const hashType = hashParams.get("type");
    if (accessToken && refreshToken) {
      const supabase = getSupabaseBrowser();
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: sessionError }) => {
          if (sessionError) return;
          if (hashType === "recovery") {
            window.location.href = "/login?mode=reset";
            return;
          }
          window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (planData) {
      setPlan(planData);
      if (!startDate) {
        setStartDate(planData.start_date);
      }
    }
  }, [planData]);


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
      const today = formatLocalDate(new Date());
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
    setActiveRecipe(activeRecipeData ?? null);
  }, [activeRecipeId, activeRecipeData]);

  useEffect(() => {
    if (activeRecipe) {
      setDrawerOpen(true);
    }
  }, [activeRecipe]);

  useEffect(() => {
    activeRecipeRef.current = activeRecipe;
  }, [activeRecipe]);

  useEffect(() => {
    if (!feedbackTarget) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-feedback-trigger="true"], [data-feedback-panel="true"]')) return;
      setFeedbackTarget(null);
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [feedbackTarget]);

  const updateFeedbackCaches = (recipeId: string, feedback: Record<string, number>) => {
    mutate(
      `/api/recipes/${recipeId}`,
      (current?: Recipe | null) => (current ? { ...current, family_feedback: feedback } : current),
      { revalidate: false },
    );
    mutate(
      "/api/recipes?view=summary",
      (current?: Recipe[]) =>
        current?.map((recipe) =>
          recipe.recipe_id === recipeId ? { ...recipe, family_feedback: feedback } : recipe,
        ),
      { revalidate: false },
    );
    mutate(
      "/api/recipes",
      (current?: Recipe[]) =>
        current?.map((recipe) =>
          recipe.recipe_id === recipeId ? { ...recipe, family_feedback: feedback } : recipe,
        ),
      { revalidate: false },
    );
  };

  const scheduleFeedbackSave = (recipeId: string, feedback: Record<string, number>) => {
    const existing = feedbackTimersRef.current.get(recipeId);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(async () => {
      feedbackTimersRef.current.delete(recipeId);
      const response = await fetch(`/api/recipes/${recipeId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_feedback: feedback }),
      });
      if (!response.ok) {
        mutate(`/api/recipes/${recipeId}`);
      }
    }, 400);
    feedbackTimersRef.current.set(recipeId, timer);
  };

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
    await mutatePlan();
  };

  const handleStartDate = async (value: string) => {
    setStartDate(value);
    window.localStorage.setItem("mealplanner-start-date", value);
    const updated = await postJson<WeeklyPlan>("/api/plan/start", { start_date: value });
    setPlan(updated);
    setPickerOpen(false);
    await mutatePlan();
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
    await mutatePlan();
  };

  const handleClear = async (date: string, meal: string) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/clear", { date, meal, start_date: startDate });
    setPlan(updated);
    await mutatePlan();
  };

  const handleToggleLock = async (date: string, meal: string) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/lock", { date, meal, start_date: startDate });
    setPlan(updated);
    await mutatePlan();
  };

  const handleLockAll = async (locked: boolean) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/lock-all", { locked, start_date: startDate });
    setPlan(updated);
    await mutatePlan();
  };

  const handleToggleComplete = async (date: string, meal: string) => {
    const updated = await postJson<WeeklyPlan>("/api/plan/complete", { date, meal, start_date: startDate });
    setPlan(updated);
    await mutatePlan();
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
  const dayTileLabel = (isoDate: string) =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "numeric",
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
      const iso = formatLocalDate(date);
      cells.push({ date: iso, label: day, inMonth: true });
    }
    return cells;
  };

  const ingredientList = language === "original" ? activeRecipe?.ingredients_original : activeRecipe?.ingredients;
  const instructionList = language === "original" ? activeRecipe?.instructions_original : activeRecipe?.instructions;
  const members = configData?.config.family_members ?? [];
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

  const saveFeedback = async () => {
    if (feedbackSavingRef.current) return;
    feedbackSavingRef.current = true;
    const version = feedbackVersionRef.current;
    const snapshot = activeRecipeRef.current;
    if (!snapshot) {
      feedbackSavingRef.current = false;
      return;
    }
    const response = await fetch(`/api/recipes/${snapshot.recipe_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    feedbackSavingRef.current = false;
    if (!response.ok) {
      mutate(`/api/recipes/${snapshot.recipe_id}`);
      return;
    }
    if (feedbackVersionRef.current !== version) {
      await saveFeedback();
    }
  };

  const handleFeedbackChange = async (memberId: string, value: number) => {
    if (!activeRecipe) return;
    const baseRecipe = activeRecipeRef.current ?? activeRecipe;
    const recipeId = activeRecipe.recipe_id;
    const next = {
      ...baseRecipe,
      family_feedback: { ...(baseRecipe.family_feedback ?? {}), [memberId]: value },
    };
    activeRecipeRef.current = next;
    setActiveRecipe(next);
    updateFeedbackCaches(recipeId, next.family_feedback ?? {});
    feedbackVersionRef.current += 1;
    await saveFeedback();
  };

  const handleInlineFeedbackChange = (recipeId: string, memberId: string, value: number) => {
    const recipe = recipesById.get(recipeId);
    if (!recipe) return;
    const nextFeedback = { ...(recipe.family_feedback ?? {}), [memberId]: value };
    updateFeedbackCaches(recipeId, nextFeedback);
    if (activeRecipe?.recipe_id === recipeId) {
      const next = { ...activeRecipe, family_feedback: nextFeedback };
      activeRecipeRef.current = next;
      setActiveRecipe(next);
    }
    scheduleFeedbackSave(recipeId, nextFeedback);
  };

  return (
    <div className="space-y-6">
      <section className="sticky top-[calc(var(--header-height)+0.5rem)] z-20 flex scroll-mt-[calc(var(--header-height)+2rem)] flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/60 bg-white/95 p-3 text-xs shadow-sm backdrop-blur">
        <div>
          <p className="text-slate-600 text-xs">Week view</p>
          <h2 className="text-lg font-semibold text-slate-900">
            Plan the week with a click
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:text-slate-900"
            onClick={() => setPickerOpen((prev) => !prev)}
            ref={pickerButtonRef}
          >
            <CalendarDays className="h-4 w-4" />
            {startDate || "Pick start date"}
          </button>
          <ActionMenu>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={handleGenerate}
            >
              <Wand2 className="h-4 w-4" /> Auto-generate
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => handleLockAll(true)}
            >
              <Lock className="h-4 w-4" /> Lock all
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => handleLockAll(false)}
            >
              <LockOpen className="h-4 w-4" /> Unlock all
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => setCollapsePast((prev) => !prev)}
            >
              {collapsePast ? "Expand all days" : "Collapse past days"}
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={handlePrintWeek}
            >
              Print week
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => setShowImport(true)}
            >
              Add recipe JSON
            </button>
          </ActionMenu>
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
      {isPlanLoading ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`plan-skeleton-${idx}`} className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                <div className="space-y-2">
                  <div className="h-4 w-24 rounded-full bg-slate-100" />
                  <div className="h-3 w-32 rounded-full bg-slate-100" />
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="mt-3 space-y-3">
                {Array.from({ length: 3 }).map((__, mealIdx) => (
                  <div
                    key={`meal-skeleton-${idx}-${mealIdx}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100" />
                      <div className="space-y-2">
                        <div className="h-3 w-16 rounded-full bg-slate-100" />
                        <div className="h-3 w-24 rounded-full bg-slate-100" />
                      </div>
                    </div>
                    <div className="h-6 w-16 rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <>
          {plan?.days.some((day) => collapsedDays[day.date]) && (
            <section className="flex flex-wrap gap-2">
              {plan.days
                .filter((day) => collapsedDays[day.date])
                .map((day) => {
                  const isToday = day.date === formatLocalDate(new Date());
                  return (
                    <button
                      key={day.date}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isToday
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      } hover:border-emerald-200 hover:bg-white hover:shadow-sm`}
                      onClick={() =>
                        setCollapsedDays((prev) => ({ ...prev, [day.date]: !prev[day.date] }))
                      }
                    >
                      {dayTileLabel(day.date)}
                    </button>
                  );
                })}
            </section>
          )}
          <section className="grid gap-4 lg:grid-cols-2">
            {plan?.days
              .filter((day) => !collapsedDays[day.date])
              .map((day) => {
                const plannedCount = Object.values(day.meals).filter((meal) => meal).length;
                const completedCount = Object.values(day.meals).filter((meal) => meal?.completed).length;
                const isToday = day.date === formatLocalDate(new Date());
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
                          Planned {plannedCount}/3 · Done {completedCount}/3
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
                        const feedbackSource =
                          recipeMeta?.recipe_id && recipeMeta.recipe_id === activeRecipeId && activeRecipe
                            ? activeRecipe.family_feedback
                            : recipeMeta?.family_feedback;
                        const feedbackSummary = feedbackSource ? getFeedbackSummary(feedbackSource) : null;
                        const isFeedbackOpen =
                          feedbackTarget?.date === day.date && feedbackTarget.meal === meal;
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
                              <div className="relative">
                                {thumbnail ? (
                                  <Image
                                    src={thumbnail}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="h-10 w-10 rounded-full object-cover"
                                    sizes="40px"
                                    placeholder="blur"
                                    blurDataURL={BLUR_DATA_URL}
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                                    <Utensils className="h-4 w-4" />
                                  </div>
                                )}
                                <span
                                  className={`absolute -left-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white text-[9px] font-semibold shadow-sm ${MEAL_BADGES[meal]}`}
                                  title={MEAL_LABELS[meal]}
                                >
                                  {MEAL_SHORT[meal]}
                                </span>
                              </div>
                              <div>
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
                                    onMouseEnter={() => {
                                      if (entry?.recipe_id) {
                                        prefetchRecipe(entry.recipe_id);
                                      }
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
                              {entry?.recipe_id ? (
                                <button
                                  className={`rounded-full border px-2 py-1 text-[10px] ${
                                    feedbackSummary && feedbackSummary.total > 0
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-slate-200 bg-white text-slate-400"
                                  }`}
                                  onClick={() =>
                                    setFeedbackTarget((prev) =>
                                      prev && prev.date === day.date && prev.meal === meal
                                        ? null
                                        : { date: day.date, meal },
                                    )
                                  }
                                  data-feedback-trigger="true"
                                >
                                  {feedbackSummary && feedbackSummary.total > 0 ? (
                                    <>
                                      👍 {feedbackSummary.up} · 👎 {feedbackSummary.down}
                                    </>
                                  ) : (
                                    <>👍 0 · 👎 0</>
                                  )}
                                </button>
                              ) : null}
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
                                  {entry?.completed ? "Done" : "Done"}
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
                            {isFeedbackOpen && entry?.recipe_id && recipeMeta ? (
                              <div
                                className="mt-3 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-xs text-slate-700"
                                data-feedback-panel="true"
                              >
                                <FamilyFeedback
                                  members={members}
                                  feedback={recipeMeta.family_feedback}
                                  onChange={(memberId, value) =>
                                    handleInlineFeedbackChange(entry.recipe_id as string, memberId, value)
                                  }
                                  compact
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </section>
        </>
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
                  onMouseEnter={() => {
                    mutate(`/api/recipes/${recipe.recipe_id}`, recipe, false);
                  }}
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
                onMouseEnter={() => {
                  filteredRecipes.forEach((recipe) => {
                    prefetchRecipe(recipe.recipe_id);
                  });
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
                  await mutateRecipes();
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
        <>
          <div
            className={`fixed inset-0 z-30 bg-slate-900/20 transition-opacity duration-300 ${
              drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => {
              setDrawerOpen(false);
              setTimeout(() => setActiveRecipeId(null), 250);
              setActiveMealContext(null);
            }}
          />
          <div
            className={`fixed inset-y-0 right-0 z-40 w-[90vw] max-w-2xl overflow-y-auto border-l border-slate-200 bg-white/95 p-6 pb-16 shadow-2xl backdrop-blur transition-transform duration-300 ease-out lg:w-[50vw] ${
              drawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{activeRecipe.name}</h3>
              {activeMealContext ? (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {activeDayLabel} · {MEAL_LABELS[activeMealContext.meal] ?? activeMealContext.meal}
                </p>
              ) : null}
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
            <div className="mt-3 flex flex-wrap gap-2">
                {mealTypeOptions.map((meal) => {
                  const entry = activeDay.meals[meal];
                  const recipeMeta = entry?.recipe_id ? recipesById.get(entry.recipe_id) : null;
                  const label = recipeMeta?.name ?? entry?.name;
                  const isActive = activeMealContext?.meal === meal;
                  return (
                    <button
                      key={meal}
                      className={`rounded-full border px-3 py-1 text-left text-[11px] transition ${
                        isActive
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                      onMouseEnter={() => {
                        if (entry?.recipe_id) {
                          prefetchRecipe(entry.recipe_id);
                        }
                      }}
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
                    </button>
                  );
                })}
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
            <div>
              <div className="flex items-center gap-2 border-b border-dashed border-slate-200 pb-2">
                <Heart className="h-4 w-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-900">Family feedback</h4>
              </div>
              <div className="mt-2">
                <FamilyFeedback
                  members={members}
                  feedback={activeRecipe.family_feedback}
                  onChange={handleFeedbackChange}
                  compact
                />
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

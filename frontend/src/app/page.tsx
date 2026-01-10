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
  PlusCircle,
  ListChecks,
  ShoppingBasket,
  Heart,
  Loader2,
  Play,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { getYouTubeId } from "@/lib/youtube";
import ActionMenu from "@/components/ActionMenu";
import FamilyFeedback from "@/components/FamilyFeedback";
import RecipeImportModal, { ImportedRecipe } from "@/components/RecipeImportModal";
import RecipeSearchAddModals from "@/components/RecipeSearchAddModals";
import SearchAddActionButton from "@/components/SearchAddActionButton";
import { registerOptimisticRecipe } from "@/lib/optimistic";
import type {
  CreatedRecipe,
  DailyRecommendationStore,
  Recipe,
  Ingredient,
} from "@/lib/types";
import { MEAL_BADGES, MEAL_LABELS, MEAL_SHORT } from "@/lib/meal";
import { postJson } from "@/lib/api";
import { useSearchAddRecipeFlow } from "@/lib/useSearchAddRecipeFlow";

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

// meal labels/badges moved to lib/meal.ts

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
  const [showManual, setShowManual] = useState(false);
  const [manualContext, setManualContext] = useState<{ date: string; meal: string } | null>(null);
  const searchFlow = useSearchAddRecipeFlow(() => setShowManual(true));
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [activeMealContext, setActiveMealContext] = useState<{ date: string; meal: string } | null>(null);
  const { language } = useLanguage();
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const [collapsePast, setCollapsePast] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeRecipeRef = useRef<Recipe | null>(null);
  const prefill = searchFlow.prefill;
  const feedbackVersionRef = useRef(0);
  const feedbackSavingRef = useRef(false);
  const feedbackTimersRef = useRef<Map<string, number>>(new Map());
  const [feedbackTarget, setFeedbackTarget] = useState<{ date: string; meal: string } | null>(null);
  const pickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const pickerPanelRef = useRef<HTMLDivElement | null>(null);
  const { recipes, recipesById, optimisticIds, mutateRecipes } = useRecipes<Recipe>();
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
    { revalidateOnFocus: true, revalidateOnReconnect: true },
  );
  const { data: dailyData, mutate: mutateDaily } = useSWR<DailyRecommendationStore>(
    "/api/recommendations/daily",
  );
  const { data: activeRecipeData } = useSWR<Recipe | null>(
    activeRecipeId ? `/api/recipes/${activeRecipeId}` : null,
  );
  const { data: configData } = useSWR<{ config: AppConfig }>("/api/config");
  const isPlanLoading = !planData && !plan;
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [dailyActiveRunId, setDailyActiveRunId] = useState<string | null>(null);
  const [dailyAssignCandidateId, setDailyAssignCandidateId] = useState<string | null>(null);
  const [dailyVideoCandidateId, setDailyVideoCandidateId] = useState<string | null>(null);
  const [dailyAssignMeal, setDailyAssignMeal] = useState("dinner");
  const [dailyAssignDate, setDailyAssignDate] = useState<string>("");
  const [dailyAssignMonth, setDailyAssignMonth] = useState<Date>(new Date());
  const [dailyMessage, setDailyMessage] = useState("");
  const [dailyCandidateErrors, setDailyCandidateErrors] = useState<Record<string, string>>({});
  const [dailyRunErrors, setDailyRunErrors] = useState<Record<string, string>>({});
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyLoadingStep, setDailyLoadingStep] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, boolean>>({});
  const showDailyDebug = process.env.NODE_ENV !== "production";

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
    if (startDate) setDailyAssignDate(startDate);
  }, [startDate]);

  useEffect(() => {
    if (!dailyLoading) {
      setDailyLoadingStep(0);
    }
  }, [dailyLoading]);

  useEffect(() => {
    if (!dailyAssignDate) return;
    const selected = new Date(`${dailyAssignDate}T00:00:00`);
    setDailyAssignMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [dailyAssignDate]);

  useEffect(() => {
    if (!dailyData?.runs?.length) return;
    if (dailyActiveRunId) return;
    setDailyActiveRunId(dailyData.runs[0].id);
  }, [dailyActiveRunId, dailyData]);

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
    if (!plan || !startDateReady) return;
    const url = new URL(window.location.href);
    const assignId = url.searchParams.get("assign");
    const date = url.searchParams.get("date");
    const meal = url.searchParams.get("meal");
    if (assignId && date && meal) {
      handleAssign(assignId, { date, meal });
      url.searchParams.delete("assign");
      url.searchParams.delete("date");
      url.searchParams.delete("meal");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, [plan, startDateReady]);

  useEffect(() => {
    if (planData) {
      setPlan(planData);
      if (!startDate) {
        setStartDate(planData.start_date);
      }
    }
  }, [planData]);

  useEffect(() => {
    if (!startDateReady || !startDate) return;
    mutatePlan();
  }, [startDateReady, startDate, mutatePlan]);


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

  const handleGenerateDaily = async (options?: { date?: string; force?: boolean }) => {
    setDailyLoading(true);
    setDailyMessage("");
    setDailyLoadingStep(0);
    const runId = crypto.randomUUID();
    setDailyActiveRunId(runId);
    setDailyModalOpen(true);
    const poller = window.setInterval(() => {
      mutateDaily();
    }, 1200);
    try {
      const response = await fetch("/api/recommendations/daily/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: options?.date ?? formatLocalDate(new Date()),
          force: options?.force ?? false,
          language,
          run_id: runId,
        }),
      });
      setDailyLoadingStep(1);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDailyMessage(data.error ?? "Unable to generate recommendations.");
        return;
      }
      setDailyLoadingStep(2);
      if (data.run?.id && data.run.id !== runId) {
        setDailyActiveRunId(data.run.id);
      }
      setDailyMessage(data.run?.status === "error" ? data.run?.reason ?? "" : "");
      await mutateDaily();
      setDailyLoadingStep(3);
    } catch (error) {
      setDailyMessage(error instanceof Error ? error.message : "Unable to generate recommendations.");
    } finally {
      window.clearInterval(poller);
      setDailyLoading(false);
    }
  };

  const handleStartDate = async (value: string) => {
    setStartDate(value);
    window.localStorage.setItem("mealplanner-start-date", value);
    const updated = await postJson<WeeklyPlan>("/api/plan/start", { start_date: value });
    setPlan(updated);
    setPickerOpen(false);
    await mutatePlan();
  };

  const handleAssign = async (recipeId: string, context?: { date: string; meal: string }) => {
    const target = context ?? selectMeal;
    if (!target) return;
    const updated = await postJson<WeeklyPlan>("/api/plan/assign", {
      date: target.date,
      meal: target.meal,
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

  const handleDailyAccept = async (
    runId: string,
    candidateId: string,
    options?: { assign?: boolean },
  ) => {
    if (options?.assign !== false && (!dailyAssignDate || !dailyAssignMeal)) return;
    setDailyMessage("");
    const assign = options?.assign !== false;
    const targetDate = dailyAssignDate;
    const targetMeal = dailyAssignMeal;
    const candidate = activeDailyRun?.candidates.find((entry) => entry.id === candidateId);
    if (!candidate) return;
    setDailyCandidateErrors((current) => {
      if (!current[candidateId]) return current;
      const next = { ...current };
      delete next[candidateId];
      return next;
    });

    const targetInCurrentPlan = plan?.days?.some((day) => day.date === targetDate) ?? false;
    if (assign && !targetInCurrentPlan) {
      setStartDate(targetDate);
      window.localStorage.setItem("mealplanner-start-date", targetDate);
      const nextDate = new Date(`${targetDate}T00:00:00`);
      setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setPlan(null);
      const targetKey = `/api/plan?start_date=${targetDate}`;
      mutate(
        targetKey,
        fetch(targetKey).then((res) => res.json()),
        { populateCache: true, revalidate: false },
      );
    }

    if (assign) {
      setPendingAssignments((current) => ({
        ...current,
        [pendingKey(targetDate, targetMeal)]: true,
      }));
    }

    await mutateDaily(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          runs: current.runs.map((entry) => {
            if (entry.id !== runId) return entry;
            return {
              ...entry,
              candidates: entry.candidates.map((item) =>
                item.id === candidateId
                  ? {
                      ...item,
                      status: "accepted",
                      assignment_status: assign ? "assigned" : "added",
                      autofill_status: item.autofill_status ?? "running",
                    }
                  : item,
              ),
            };
          }),
        };
      },
      { revalidate: false },
    );
    if (assign && plan) {
      setPlan((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          days: prev.days.map((day) => {
            if (day.date !== targetDate) return day;
            const existing = day.meals[targetMeal] ?? null;
            return {
              ...day,
              meals: {
                ...day.meals,
                [targetMeal]: {
                  ...(existing ?? {}),
                  name: candidate.title,
                  recipe_id: candidate.recipe_id ?? existing?.recipe_id,
                },
              },
            };
          }),
        };
        return next;
      });
    }
    setDailyAssignCandidateId(null);
    try {
      const response = await fetch(`/api/recommendations/daily/${runId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          target_date: targetDate,
          meal: targetMeal,
          start_date: targetDate,
          assign,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDailyMessage(data.error ?? "Unable to accept recommendation.");
        if (assign) {
          setPendingAssignments((current) => {
            const next = { ...current };
            delete next[pendingKey(targetDate, targetMeal)];
            return next;
          });
        }
        await mutateDaily();
        return;
      }
      if (data?.run) {
        setDailyActiveRunId(data.run.id);
        await mutateDaily(
          (current) => {
            if (!current) return current;
            return {
              ...current,
              runs: current.runs.map((entry) => (entry.id === data.run.id ? data.run : entry)),
            };
          },
          { revalidate: false },
        );
      }
      if (data?.plan) {
        setPlan(data.plan);
        if (data.plan.start_date && data.plan.start_date !== startDate) {
          setStartDate(data.plan.start_date);
          window.localStorage.setItem("mealplanner-start-date", data.plan.start_date);
          const nextDate = new Date(`${data.plan.start_date}T00:00:00`);
          setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
        }
        await mutatePlan();
      }
      if (assign) {
        setPendingAssignments((current) => {
          const next = { ...current };
          delete next[pendingKey(targetDate, targetMeal)];
          return next;
        });
      }
      if (!data?.run) {
        await mutateDaily();
      }
    } catch (error) {
      setDailyMessage(error instanceof Error ? error.message : "Unable to accept recommendation.");
      if (assign) {
        setPendingAssignments((current) => {
          const next = { ...current };
          delete next[pendingKey(targetDate, targetMeal)];
          return next;
        });
      }
      await mutateDaily();
    }
  };

  const handleDailyDiscard = async (runId: string, candidateId: string) => {
    try {
      const data = await postJson<{ ok: boolean; run?: DailyRecommendationStore["runs"][number] }>(
        `/api/recommendations/daily/${runId}/discard`,
        { candidate_id: candidateId },
      );
      setDailyCandidateErrors((current) => {
        if (!current[candidateId]) return current;
        const next = { ...current };
        delete next[candidateId];
        return next;
      });
      if (dailyAssignCandidateId === candidateId) {
        setDailyAssignCandidateId(null);
      }
      if (data?.run) {
        setDailyActiveRunId(data.run.id);
        await mutateDaily(
          (current) => {
            if (!current) return current;
            return {
              ...current,
              runs: current.runs.map((entry) => (entry.id === data.run?.id ? data.run : entry)),
            };
          },
          { revalidate: false },
        );
      } else {
        await mutateDaily();
      }
    } catch (error) {
      setDailyCandidateErrors((current) => ({
        ...current,
        [candidateId]: error instanceof Error ? error.message : "Unable to discard recommendation.",
      }));
    }
  };

  const handleDailyDeleteRun = async (runId: string) => {
    try {
      const data = await postJson<{ ok: boolean; runs?: DailyRecommendationStore["runs"] }>(
        `/api/recommendations/daily/${runId}/delete`,
        {},
      );
      setDailyRunErrors((current) => {
        if (!current[runId]) return current;
        const next = { ...current };
        delete next[runId];
        return next;
      });
      setDailyAssignCandidateId(null);
      if (dailyActiveRunId === runId) {
        setDailyActiveRunId(null);
      }
      if (data?.runs) {
        await mutateDaily(
          (current) => {
            if (!current) return current;
            return { ...current, runs: data.runs ?? current.runs };
          },
          { revalidate: false },
        );
      } else {
        await mutateDaily();
      }
    } catch (error) {
      setDailyRunErrors((current) => ({
        ...current,
        [runId]: error instanceof Error ? error.message : "Unable to remove recommendations.",
      }));
    }
  };

  const handleManualCreated = async (recipe: CreatedRecipe) => {
    registerOptimisticRecipe(recipe);
    await mutateRecipes(
      (current = []) => {
        const exists = current.some((item) => item.recipe_id === recipe.recipe_id);
        return exists ? current : [...current, recipe];
      },
      { revalidate: false },
    );
    mutate(
      "/api/recipes",
      (current?: Recipe[]) => {
        if (!current) return [recipe];
        return current.some((item) => item.recipe_id === recipe.recipe_id)
          ? current
          : [...current, recipe];
      },
      { revalidate: false },
    );
    if (manualContext) {
      await handleAssign(recipe.recipe_id, manualContext);
      setManualContext(null);
    }
    searchFlow.reset();
  };


  const handleImportedRecipe = async (recipe: ImportedRecipe) => {
    registerOptimisticRecipe(recipe);
    await mutateRecipes(
      (current = []) => {
        const exists = current.some((item) => item.recipe_id === recipe.recipe_id);
        return exists ? current : [...current, recipe];
      },
      { revalidate: false },
    );
    mutate(
      "/api/recipes",
      (current?: Recipe[]) => {
        if (!current) return [recipe];
        return current.some((item) => item.recipe_id === recipe.recipe_id) ? current : [...current, recipe];
      },
      { revalidate: false },
    );
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
  const pendingKey = (date: string, meal: string) => `${date}:${meal}`;

  const normalizeTitle = (value: string) =>
    value
      .replace(/#[^\s]+/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .toLowerCase()
      .trim();

  const tokenizeTitle = (value: string) =>
    normalizeTitle(value)
      .split(/\s+/)
      .filter(Boolean);

  const scoreTitleMatch = (a: string, b: string) => {
    const aTokens = new Set(tokenizeTitle(a));
    const bTokens = new Set(tokenizeTitle(b));
    if (!aTokens.size || !bTokens.size) return 0;
    let overlap = 0;
    aTokens.forEach((token) => {
      if (bTokens.has(token)) overlap += 1;
    });
    return overlap / Math.max(aTokens.size, bTokens.size);
  };


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
  const dailyLoadingSteps = [
    "Collect preferences",
    "Draft ideas",
    "Search videos",
    "Finalize list",
  ];
  const stageToStep: Record<string, number> = {
    collect: 0,
    local: 0,
    gemini: 1,
    youtube: 2,
    finalize: 3,
  };
  const dailyProgress = dailyLoadingSteps.length
    ? Math.min(((dailyLoadingStep + 1) / dailyLoadingSteps.length) * 100, 100)
    : 0;
  const recipeTitleIndex = useMemo(() => {
    return recipes.map((recipe) => {
      const title =
        language === "original"
          ? recipe.name_original ?? recipe.name ?? ""
          : recipe.name ?? recipe.name_original ?? "";
      return {
        recipe,
        title,
        tokens: tokenizeTitle(title),
      };
    });
  }, [recipes, language]);
  const dailyRuns = dailyData?.runs ?? [];
  const activeDailyRun =
    dailyRuns.find((run) => run.id === dailyActiveRunId) ?? dailyRuns[0] ?? null;
  useEffect(() => {
    if (!dailyLoading || !activeDailyRun?.stage) return;
    const nextStep = stageToStep[activeDailyRun.stage] ?? 0;
    if (nextStep !== dailyLoadingStep) {
      setDailyLoadingStep(nextStep);
    }
  }, [activeDailyRun?.stage, dailyLoading, dailyLoadingStep, stageToStep]);
  const dailyCandidates = useMemo(() => {
    if (!activeDailyRun) return [];
    return [...activeDailyRun.candidates].sort((a, b) => {
      const aExisting = a.is_existing ? 1 : 0;
      const bExisting = b.is_existing ? 1 : 0;
      if (aExisting !== bExisting) return aExisting - bExisting;
      return (a.rank ?? 0) - (b.rank ?? 0);
    });
  }, [activeDailyRun]);
  const dailySimilarMap = useMemo(() => {
    if (!activeDailyRun) return new Map<string, Array<{ recipe: Recipe; score: number }>>();
    const map = new Map<string, Array<{ recipe: Recipe; score: number }>>();
    dailyCandidates.forEach((candidate) => {
      if (candidate.is_existing || candidate.recipe_id) return;
      const scored = recipeTitleIndex
        .map((entry) => ({
          recipe: entry.recipe,
          score: scoreTitleMatch(candidate.title, entry.title),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      if (scored.length) {
        map.set(candidate.id, scored);
      }
    });
    return map;
  }, [activeDailyRun, dailyCandidates, recipeTitleIndex]);
  const youtubeId = useMemo(
    () => getYouTubeId(activeRecipe?.source_url ?? null),
    [activeRecipe?.source_url],
  );

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
          <button
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${
              dailyRuns.length
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-200 bg-white text-slate-700 hover:text-slate-900"
            }`}
            onClick={() => {
              if (dailyRuns[0]) {
                setDailyActiveRunId(dailyRuns[0].id);
              }
              setDailyModalOpen(true);
            }}
          >
            <Wand2 className="h-4 w-4" />
            Daily
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
              onClick={handleGenerateDaily}
              disabled={dailyLoading}
            >
              <Wand2 className="h-4 w-4" />
              {dailyLoading ? "Generating daily…" : "Daily recommendations"}
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
        {isPlanLoading ? (
          <div className="mt-2 flex w-full justify-end">
            <div className="h-2 w-32 animate-pulse rounded-full bg-slate-100" />
          </div>
        ) : null}
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
                    const displayName =
                      language === "original"
                        ? recipeMeta?.name_original ?? recipeMeta?.name ?? entry?.name
                        : recipeMeta?.name ?? entry?.name;
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
                    const isOptimistic = entry?.recipe_id ? optimisticIds.has(entry.recipe_id) : false;
                    const isPending = !!pendingAssignments[pendingKey(day.date, meal)];
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
                              {isOptimistic ? (
                                <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                                  syncing
                                </span>
                              ) : null}
                              {isPending ? (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  pending
                                </span>
                              ) : null}
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
              <SearchAddActionButton
                label="Search & add recipe"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-slate-300"
                onClick={() => {
                  setManualContext(addMenu);
                  searchFlow.openSearch();
                  setAddMenu(null);
                }}
              />
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-slate-300"
                onClick={() => {
                  setAddMenu(null);
                  setManualContext(addMenu);
                  searchFlow.reset();
                  setShowManual(true);
                }}
              >
                Add new recipe (manual)
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
        <RecipeImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onImported={handleImportedRecipe}
        />
      )}

      <RecipeSearchAddModals
        manualOpen={showManual}
        onManualClose={() => {
          setShowManual(false);
          setManualContext(null);
        }}
        onManualCreated={handleManualCreated}
        searchFlow={searchFlow}
        defaultBackLabel="Back to add menu"
        onDefaultBack={
          manualContext
            ? () => {
                setShowManual(false);
                setAddMenu(manualContext);
              }
            : undefined
        }
      />

      {dailyModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
          onClick={() => setDailyModalOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">Daily recommendations</h3>
                {activeDailyRun?.status === "local-only" ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Local-only
                  </span>
                ) : null}
                {activeDailyRun?.model ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {activeDailyRun.model}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  onClick={() =>
                    handleGenerateDaily({
                      date: activeDailyRun?.date ?? formatLocalDate(new Date()),
                      force: true,
                    })
                  }
                  disabled={dailyLoading}
                >
                  Regenerate
                </button>
                <button className="text-sm text-slate-500" onClick={() => setDailyModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            {dailyLoading ? (
              <div className="mt-3 space-y-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ChefHat className="h-3.5 w-3.5 text-emerald-600" />
                  Cooking up ideas…
                </div>
                {activeDailyRun?.stage === "collect" || activeDailyRun?.stage === "local" ? (
                  <div className="text-[11px] text-slate-500">Reviewing recent meals…</div>
                ) : null}
                {activeDailyRun?.stage === "gemini" ? (
                  <div className="text-[11px] text-slate-500">Drafting new ideas…</div>
                ) : null}
                {activeDailyRun?.stage === "youtube" && activeDailyRun.stage_detail?.youtube_total ? (
                  <div className="text-[11px] text-slate-500">
                    Searching videos{" "}
                    {activeDailyRun.stage_detail.youtube_done ?? 0}/{activeDailyRun.stage_detail.youtube_total}
                    {activeDailyRun.stage_detail.current_idea
                      ? ` · ${activeDailyRun.stage_detail.current_idea}`
                      : ""}
                  </div>
                ) : null}
                {activeDailyRun?.stage === "finalize" ? (
                  <div className="text-[11px] text-slate-500">Finalizing list…</div>
                ) : null}
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${dailyProgress}%` }}
                  />
                  <div
                    className="absolute -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm transition-all duration-500"
                    style={{ left: `calc(${dailyProgress}% - 12px)` }}
                  >
                    <ChefHat className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                  {dailyLoadingSteps.map((step, idx) => (
                    <span
                      key={step}
                      className={idx === dailyLoadingStep ? "text-emerald-600" : ""}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {dailyMessage ? <p className="mt-2 text-xs text-rose-500">{dailyMessage}</p> : null}
            {dailyRuns.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {dailyRuns.map((run) => (
                  <div key={run.id} className="flex flex-col items-start gap-1">
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                        run.id === activeDailyRun?.id
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <button
                        className="text-left"
                        onClick={() => {
                          setDailyActiveRunId(run.id);
                          setDailyAssignCandidateId(null);
                        }}
                      >
                        {dayTileLabel(run.date)}
                      </button>
                      <button
                        className="ml-2 text-[10px] text-rose-500 hover:text-rose-600"
                        onClick={() => handleDailyDeleteRun(run.id)}
                        aria-label={`Remove ${run.date}`}
                      >
                        ×
                      </button>
                    </div>
                    {dailyRunErrors[run.id] ? (
                      <span className="text-[10px] text-rose-500">{dailyRunErrors[run.id]}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No daily recommendations yet.</p>
            )}

            {activeDailyRun ? (
              <div className="mt-4 space-y-3">
                {activeDailyRun.status === "error" ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {activeDailyRun.reason ?? "No recommendations available."}
                  </div>
                ) : activeDailyRun.candidates.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {activeDailyRun.reason ?? "No recommendations available."}
                  </div>
                ) : (
                  dailyCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                          {(() => {
                            const recipeMeta = candidate.recipe_id
                              ? recipesById.get(candidate.recipe_id)
                              : null;
                            const sourceUrl = candidate.source_url ?? recipeMeta?.source_url ?? null;
                            const fallbackThumb = recipeMeta?.thumbnail_url ?? null;
                            const youtubeId = sourceUrl ? getYouTubeId(sourceUrl) : null;
                            const youtubeThumb = youtubeId
                              ? `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`
                              : null;
                            const thumb = candidate.thumbnail_url ?? youtubeThumb ?? fallbackThumb;
                              const content = thumb ? (
                                <div className="relative w-16 overflow-hidden rounded-lg bg-slate-100">
                                  <div className="aspect-video w-full" />
                                  <img
                                    src={thumb}
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover"
                                    loading="lazy"
                                    onError={(event) => {
                                      const target = event.currentTarget;
                                      if (target.dataset.fallback) return;
                                      target.dataset.fallback = "1";
                                      target.src = target.src.replace("maxresdefault", "hqdefault");
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="flex h-9 w-16 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                                  No image
                                </div>
                              );
                              if (!youtubeId) {
                                return content;
                              }
                              return (
                                <button
                                  className="group relative"
                                  onClick={() =>
                                    setDailyVideoCandidateId((prev) =>
                                      prev === candidate.id ? null : candidate.id,
                                    )
                                  }
                                  aria-label={
                                    dailyVideoCandidateId === candidate.id ? "Hide video" : "Watch video"
                                  }
                                  title={dailyVideoCandidateId === candidate.id ? "Hide video" : "Watch video"}
                                >
                                  {content}
                                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/25 opacity-100">
                                    <Play className="h-4 w-4 text-white" />
                                  </span>
                                </button>
                              );
                            })()}
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{candidate.title}</p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    candidate.is_existing
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {candidate.is_existing ? "Existing" : "Recommended"}
                                </span>
                                {candidate.status === "accepted" && candidate.assignment_status === "assigned" ? (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    Assigned
                                  </span>
                                ) : null}
                                {candidate.status === "accepted" && candidate.assignment_status === "added" ? (
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                    Added
                                  </span>
                                ) : null}
                                {candidate.status === "accepted" && candidate.autofill_status ? (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                      candidate.autofill_status === "success"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : candidate.autofill_status === "failed"
                                          ? "border-rose-200 bg-rose-50 text-rose-700"
                                          : candidate.autofill_status === "running"
                                            ? "border-amber-200 bg-amber-50 text-amber-700"
                                            : "border-slate-200 bg-slate-50 text-slate-500"
                                    }`}
                                    title={candidate.autofill_error}
                                  >
                                    {candidate.autofill_status === "success"
                                      ? "Auto-fill ✓"
                                      : candidate.autofill_status === "failed"
                                        ? "Auto-fill failed"
                                        : candidate.autofill_status === "running"
                                          ? "Auto-fill…"
                                          : "Auto-fill skipped"}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {candidate.meal_types?.length
                                  ? candidate.meal_types.join(", ")
                                  : "Flexible"}
                              </div>
                              {candidate.reason || dailySimilarMap.get(candidate.id)?.length ? (
                                <div className="text-[11px] text-slate-400">
                                  {candidate.reason ?? "No reason provided."}
                                  {dailySimilarMap.get(candidate.id)?.length
                                    ? ` · Similar: ${dailySimilarMap
                                        .get(candidate.id)
                                        ?.map((entry) =>
                                          language === "original"
                                            ? entry.recipe.name_original ?? entry.recipe.name ?? ""
                                            : entry.recipe.name ?? entry.recipe.name_original ?? "",
                                        )
                                        .filter(Boolean)
                                        .join(" · ")}`
                                    : ""}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                          {candidate.status === "accepted" ? null : candidate.status === "discarded" ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                              Discarded
                            </span>
                          ) : (
                            <>
                              <button
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 sm:px-3"
                                aria-label="Assign to a date"
                                title="Assign to a date"
                                onClick={() => {
                                  setDailyAssignCandidateId(candidate.id);
                                  if (candidate.meal_types?.length) {
                                    const preferred = mealTypeOptions.find((meal) =>
                                      candidate.meal_types?.includes(meal),
                                    );
                                    if (preferred) {
                                      setDailyAssignMeal(preferred);
                                    }
                                  }
                                  if (plan?.days?.length) {
                                    const emptySlot = plan.days.find(
                                      (day) => !day.meals?.[dailyAssignMeal]?.recipe_id,
                                    );
                                    if (emptySlot) {
                                      setDailyAssignDate(emptySlot.date);
                                    }
                                  }
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </button>
                              {!candidate.is_existing ? (
                                <button
                                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 sm:px-3"
                                  aria-label="Add to recipes only"
                                  title="Add to recipes only"
                                  onClick={() =>
                                    handleDailyAccept(activeDailyRun.id, candidate.id, { assign: false })
                                  }
                                >
                                  <PlusCircle className="h-3 w-3" />
                                </button>
                              ) : null}
                              <button
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 sm:px-3"
                                aria-label="Discard recommendation"
                                title="Discard recommendation"
                                onClick={() => handleDailyDiscard(activeDailyRun.id, candidate.id)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          )}
                          </div>
                        </div>
                        {dailyCandidateErrors[candidate.id] ? (
                          <p className="text-xs text-rose-500">{dailyCandidateErrors[candidate.id]}</p>
                        ) : null}
                      </div>
                      {(() => {
                        const sourceUrl =
                          candidate.source_url ??
                          (candidate.recipe_id ? recipesById.get(candidate.recipe_id)?.source_url : null);
                        const youtubeId = sourceUrl ? getYouTubeId(sourceUrl) : null;
                        if (!youtubeId || dailyVideoCandidateId !== candidate.id) return null;
                        return (
                          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
                            <iframe
                              className="aspect-video w-full"
                              src={`https://www.youtube.com/embed/${youtubeId}`}
                              title="Recommendation video"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        );
                      })()}
                      {dailyAssignCandidateId === candidate.id && (
                        <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-600">
                              Choose date
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500"
                                onClick={() =>
                                  setDailyAssignMonth(
                                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                                  )
                                }
                              >
                                Prev
                              </button>
                              <span className="text-[11px] font-semibold text-slate-600">
                                {dailyAssignMonth.toLocaleDateString("en-US", {
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              <button
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500"
                                onClick={() =>
                                  setDailyAssignMonth(
                                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                                  )
                                }
                              >
                                Next
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-400">
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
                              <div key={label} className="text-center">
                                {label}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {buildCalendar(dailyAssignMonth).map((cell, idx) => {
                              if (!cell.inMonth) {
                                return <div key={`daily-empty-${idx}`} />;
                              }
                              const isSelected = cell.date === dailyAssignDate;
                              const isToday = cell.date === formatLocalDate(new Date());
                              const isSuggested =
                                plan?.days?.some(
                                  (day) =>
                                    day.date === cell.date &&
                                    !day.meals?.[dailyAssignMeal]?.recipe_id,
                                ) ?? false;
                              return (
                                <button
                                  key={cell.date}
                                  className={`rounded-lg px-1 py-1 text-[10px] ${
                                    isSelected
                                      ? "bg-emerald-200 text-emerald-900"
                                      : isToday
                                        ? "bg-emerald-50 text-emerald-700"
                                        : isSuggested
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-white text-slate-600"
                                  }`}
                                  onClick={() => setDailyAssignDate(cell.date)}
                                >
                                  {cell.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs"
                              value={dailyAssignMeal}
                              onChange={(event) => setDailyAssignMeal(event.target.value)}
                            >
                              {mealTypeOptions.map((meal) => (
                                <option key={meal} value={meal}>
                                  {MEAL_LABELS[meal] ?? meal}
                                </option>
                              ))}
                            </select>
                            <button
                              className="rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"
                              onClick={() => handleDailyAccept(activeDailyRun.id, candidate.id)}
                            >
                              Assign
                            </button>
                            <button
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
                              onClick={() => handleDailyAccept(activeDailyRun.id, candidate.id, { assign: false })}
                            >
                              Add only
                            </button>
                            <button
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
                              onClick={() => setDailyAssignCandidateId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                          {(() => {
                            const day = plan?.days.find((entry) => entry.date === dailyAssignDate);
                            const entry = day?.meals?.[dailyAssignMeal];
                            if (!entry?.recipe_id) return null;
                            const existingRecipe = recipesById.get(entry.recipe_id);
                            const existingName =
                              language === "original"
                                ? existingRecipe?.name_original ?? existingRecipe?.name ?? "Existing recipe"
                                : existingRecipe?.name ?? existingRecipe?.name_original ?? "Existing recipe";
                            const nextName = candidate.title;
                            return (
                              <p className="text-[11px] text-amber-700">
                                {existingName} will be replaced with {nextName}.
                              </p>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {activeDailyRun.stats?.existing_count ? (
                  <p className="text-xs text-slate-500">
                    Included {activeDailyRun.stats.existing_count} existing recipes.
                  </p>
                ) : null}
                {showDailyDebug && activeDailyRun.debug?.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                    <p className="font-semibold text-slate-600">Debug</p>
                    <ul className="mt-1 list-disc pl-4">
                      {activeDailyRun.debug.map((entry, idx) => (
                        <li key={`${entry}-${idx}`}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
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
              <h3 className="text-lg font-semibold text-slate-900">
                {language === "original"
                  ? activeRecipe.name_original ?? activeRecipe.name
                  : activeRecipe.name}
              </h3>
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

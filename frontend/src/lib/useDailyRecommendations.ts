import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { postJson } from "@/lib/api";
import { scoreTitleMatch, tokenizeTitle } from "@/lib/text";
import type {
  DailyRecommendationAcceptRequest,
  DailyRecommendationAcceptResponse,
  DailyRecommendationDeleteResponse,
  DailyRecommendationDiscardRequest,
  DailyRecommendationDiscardResponse,
  DailyRecommendationStore,
  DailyRecommendationsResponse,
  DailyRecommendationsRunRequest,
  DailyRecommendationsRunResponse,
  RecipeSummary,
  WeeklyPlan,
} from "@/lib/types";

type Options = {
  language: "en" | "original";
  plan: WeeklyPlan | null;
  startDate: string;
  setStartDate: (value: string) => void;
  setCalendarMonth: (value: Date) => void;
  setPlan: (value: WeeklyPlan | null | ((prev: WeeklyPlan | null) => WeeklyPlan | null)) => void;
  mutatePlan: () => Promise<WeeklyPlan | undefined>;
  recipes: RecipeSummary[];
  recipesById: Map<string, RecipeSummary>;
  mealTypeOptions: string[];
};

type DailyRun = DailyRecommendationStore["runs"][number];

const pendingKey = (date: string, meal: string) => `${date}:${meal}`;

export function useDailyRecommendations(options: Options) {
  const {
    language,
    plan,
    startDate,
    setStartDate,
    setCalendarMonth,
    setPlan,
    mutatePlan,
    recipes,
    recipesById,
    mealTypeOptions,
  } = options;
  const { mutate } = useSWRConfig();
  const { data: dailyData, mutate: mutateDaily } = useSWR<DailyRecommendationsResponse>(
    "/api/recommendations/daily",
  );

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

  useEffect(() => {
    if (startDate) setDailyAssignDate(startDate);
  }, [startDate]);

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
    if (!dailyLoading || !dailyData?.runs?.length) return;
    if (!dailyActiveRunId) return;
    const active = dailyData.runs.find((run) => run.id === dailyActiveRunId);
    if (!active?.stage) return;
    const nextStep = stageToStep[active.stage] ?? 0;
    if (nextStep !== dailyLoadingStep) {
      setDailyLoadingStep(nextStep);
    }
  }, [dailyActiveRunId, dailyData, dailyLoading, dailyLoadingStep, stageToStep]);

  const dailyRuns = dailyData?.runs ?? [];
  const activeDailyRun = dailyRuns.find((run) => run.id === dailyActiveRunId) ?? dailyRuns[0] ?? null;

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
    if (!activeDailyRun) return new Map<string, Array<{ recipe: RecipeSummary; score: number }>>();
    const map = new Map<string, Array<{ recipe: RecipeSummary; score: number }>>();
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

  const handleGenerateDaily = useCallback(
    async (options?: { date?: string; force?: boolean }) => {
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
            date: options?.date ?? new Date().toISOString().split("T")[0],
            force: options?.force ?? false,
            language,
            run_id: runId,
          } satisfies DailyRecommendationsRunRequest),
        });
        setDailyLoadingStep(1);
        const data = (await response.json().catch(() => ({}))) as DailyRecommendationsRunResponse;
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
    },
    [language, mutateDaily],
  );

  const handleDailyAccept = useCallback(
    async (runId: string, candidateId: string, options?: { assign?: boolean }) => {
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
          } satisfies DailyRecommendationAcceptRequest),
        });
        const data = (await response.json().catch(() => ({}))) as DailyRecommendationAcceptResponse;
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
          const run = data.run;
          setDailyActiveRunId(run.id);
          await mutateDaily(
            (current) => {
              if (!current) return current;
              return {
                ...current,
                runs: current.runs.map((entry) => (entry.id === run.id ? run : entry)),
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
    },
    [
      activeDailyRun,
      dailyAssignDate,
      dailyAssignMeal,
      mutate,
      mutateDaily,
      plan,
      setCalendarMonth,
      setPlan,
      setStartDate,
      startDate,
      mutatePlan,
    ],
  );

  const handleDailyDiscard = useCallback(
    async (runId: string, candidateId: string) => {
      try {
        const data = await postJson<DailyRecommendationDiscardResponse>(
          `/api/recommendations/daily/${runId}/discard`,
          { candidate_id: candidateId } satisfies DailyRecommendationDiscardRequest,
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
          [candidateId]:
            error instanceof Error ? error.message : "Unable to discard recommendation.",
        }));
      }
    },
    [dailyAssignCandidateId, mutateDaily],
  );

  const handleDailyDeleteRun = useCallback(
    async (runId: string) => {
      try {
        const data = await postJson<DailyRecommendationDeleteResponse>(
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
    },
    [dailyActiveRunId, mutateDaily],
  );

  return {
    dailyData: dailyData ? { runs: dailyData.runs } : undefined,
    dailyRuns,
    activeDailyRun,
    dailyCandidates,
    dailySimilarMap,
    dailyModalOpen,
    setDailyModalOpen,
    dailyActiveRunId,
    setDailyActiveRunId,
    dailyAssignCandidateId,
    setDailyAssignCandidateId,
    dailyVideoCandidateId,
    setDailyVideoCandidateId,
    dailyAssignMeal,
    setDailyAssignMeal,
    dailyAssignDate,
    setDailyAssignDate,
    dailyAssignMonth,
    setDailyAssignMonth,
    dailyMessage,
    setDailyMessage,
    dailyCandidateErrors,
    dailyRunErrors,
    dailyLoading,
    dailyLoadingStep,
    dailyLoadingSteps,
    dailyProgress,
    pendingAssignments,
    handleGenerateDaily,
    handleDailyAccept,
    handleDailyDiscard,
    handleDailyDeleteRun,
  };
}

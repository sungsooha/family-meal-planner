"use client";

import { ChefHat, CheckCircle2, Play, PlusCircle, X } from "lucide-react";
import { useMemo } from "react";
import { getYouTubeId } from "@/lib/youtube";
import type { DailyRecommendationStore, RecipeSummary, WeeklyPlan } from "@/lib/types";
import { MEAL_LABELS } from "@/lib/meal";

type DailyRun = DailyRecommendationStore["runs"][number];

type Props = {
  open: boolean;
  onClose: () => void;
  dailyRuns: DailyRun[];
  activeDailyRun: DailyRun | null;
  setDailyActiveRunId: (value: string | null) => void;
  dailyLoading: boolean;
  dailyLoadingStep: number;
  dailyLoadingSteps: string[];
  dailyProgress: number;
  dailyMessage: string;
  dailyRunErrors: Record<string, string>;
  dailyCandidateErrors: Record<string, string>;
  dailyCandidates: DailyRun["candidates"];
  dailySimilarMap: Map<string, Array<{ recipe: RecipeSummary; score: number }>>;
  dailyVideoCandidateId: string | null;
  setDailyVideoCandidateId: (value: string | null | ((prev: string | null) => string | null)) => void;
  dailyAssignCandidateId: string | null;
  setDailyAssignCandidateId: (value: string | null) => void;
  dailyAssignMeal: string;
  setDailyAssignMeal: (value: string) => void;
  dailyAssignDate: string;
  setDailyAssignDate: (value: string) => void;
  dailyAssignMonth: Date;
  setDailyAssignMonth: (value: Date | ((prev: Date) => Date)) => void;
  handleGenerateDaily: (options?: { date?: string; force?: boolean }) => void;
  handleDailyAccept: (runId: string, candidateId: string, options?: { assign?: boolean }) => void;
  handleDailyDiscard: (runId: string, candidateId: string) => void;
  handleDailyDeleteRun: (runId: string) => void;
  buildCalendar: (month: Date) => Array<{ date: string; label: number; inMonth: boolean }>;
  dayTileLabel: (isoDate: string) => string;
  formatLocalDate: (date: Date) => string;
  mealTypeOptions: string[];
  planDays: WeeklyPlan["days"] | undefined;
  recipesById: Map<string, RecipeSummary>;
  language: "en" | "original";
  showDailyDebug: boolean;
};

export default function DailyRecommendationsModal(props: Props) {
  const {
    open,
    onClose,
    dailyRuns,
    activeDailyRun,
    setDailyActiveRunId,
    dailyLoading,
    dailyLoadingStep,
    dailyLoadingSteps,
    dailyProgress,
    dailyMessage,
    dailyRunErrors,
    dailyCandidateErrors,
    dailyCandidates,
    dailySimilarMap,
    dailyVideoCandidateId,
    setDailyVideoCandidateId,
    dailyAssignCandidateId,
    setDailyAssignCandidateId,
    dailyAssignMeal,
    setDailyAssignMeal,
    dailyAssignDate,
    setDailyAssignDate,
    dailyAssignMonth,
    setDailyAssignMonth,
    handleGenerateDaily,
    handleDailyAccept,
    handleDailyDiscard,
    handleDailyDeleteRun,
    buildCalendar,
    dayTileLabel,
    formatLocalDate,
    mealTypeOptions,
    planDays,
    recipesById,
    language,
    showDailyDebug,
  } = props;

  const activeRunId = activeDailyRun?.id;
  const dailyStageDetail = activeDailyRun?.stage_detail;
  const activeRunCandidates = dailyCandidates;
  const plan = planDays ?? [];

  const menuWarning = useMemo(() => {
    if (!activeDailyRun || !dailyAssignCandidateId) return null;
    const candidate = activeDailyRun.candidates.find((entry) => entry.id === dailyAssignCandidateId);
    if (!candidate) return null;
    const day = plan.find((entry) => entry.date === dailyAssignDate);
    const entry = day?.meals?.[dailyAssignMeal];
    if (!entry?.recipe_id) return null;
    const existingRecipe = recipesById.get(entry.recipe_id);
    const existingName =
      language === "original"
        ? existingRecipe?.name_original ?? existingRecipe?.name ?? "Existing recipe"
        : existingRecipe?.name ?? existingRecipe?.name_original ?? "Existing recipe";
    return `${existingName} will be replaced with ${candidate.title}.`;
  }, [
    activeDailyRun,
    dailyAssignCandidateId,
    dailyAssignDate,
    dailyAssignMeal,
    plan,
    recipesById,
    language,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
      onClick={onClose}
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
            <button className="text-sm text-slate-500" onClick={onClose}>
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
            {activeDailyRun?.stage === "youtube" && dailyStageDetail?.youtube_total ? (
              <div className="text-[11px] text-slate-500">
                Searching videos {dailyStageDetail.youtube_done ?? 0}/{dailyStageDetail.youtube_total}
                {dailyStageDetail.current_idea ? ` · ${dailyStageDetail.current_idea}` : ""}
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
                <span key={step} className={idx === dailyLoadingStep ? "text-emerald-600" : ""}>
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
                    run.id === activeRunId
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
              activeRunCandidates.map((candidate) => {
                const recipeMeta = candidate.recipe_id ? recipesById.get(candidate.recipe_id) : null;
                const sourceUrl = candidate.source_url ?? recipeMeta?.source_url ?? null;
                const youtubeId = sourceUrl ? getYouTubeId(sourceUrl) : null;
                const thumb =
                  candidate.thumbnail_url ??
                  (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg` : null) ??
                  recipeMeta?.thumbnail_url ??
                  null;
                const similar = dailySimilarMap.get(candidate.id);
                return (
                  <div
                    key={candidate.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {thumb ? (
                            youtubeId ? (
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
                                title={
                                  dailyVideoCandidateId === candidate.id ? "Hide video" : "Watch video"
                                }
                              >
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
                                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/25 opacity-100">
                                    <Play className="h-4 w-4 text-white" />
                                  </span>
                                </div>
                              </button>
                            ) : (
                              <div className="relative w-16 overflow-hidden rounded-lg bg-slate-100">
                                <div className="aspect-video w-full" />
                                <img
                                  src={thumb}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            )
                          ) : (
                            <div className="flex h-9 w-16 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                              No image
                            </div>
                          )}
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
                              {candidate.meal_types?.length ? candidate.meal_types.join(", ") : "Flexible"}
                            </div>
                            {candidate.reason ? (
                              <div className="text-[11px] text-slate-400">{candidate.reason}</div>
                            ) : null}
                            {similar?.length ? (
                              <div className="text-[11px] text-slate-400">
                                Similar:{" "}
                                {similar
                                  .map((entry) =>
                                    language === "original"
                                      ? entry.recipe.name_original ?? entry.recipe.name ?? ""
                                      : entry.recipe.name ?? entry.recipe.name_original ?? "",
                                  )
                                  .filter(Boolean)
                                  .join(" · ")}
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
                                  if (plan.length) {
                                    const emptySlot = plan.find(
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
                    {youtubeId && dailyVideoCandidateId === candidate.id ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
                        <iframe
                          className="aspect-video w-full"
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          title="Recommendation video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : null}
                    {dailyAssignCandidateId === candidate.id ? (
                      <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-600">Choose date</span>
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
                              plan.some(
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
                          {!candidate.is_existing ? (
                            <button
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
                              onClick={() => handleDailyAccept(activeDailyRun.id, candidate.id, { assign: false })}
                            >
                              Add only
                            </button>
                          ) : null}
                          <button
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
                            onClick={() => setDailyAssignCandidateId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                        {menuWarning ? (
                          <p className="text-[11px] text-amber-700">{menuWarning}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
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
  );
}

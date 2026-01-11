import { NextResponse } from "next/server";
import {
  getConfig,
  getDailyRecommendations,
  getRecipeBySourceUrl,
  getRecipes,
  listDailyPlans,
  saveDailyRecommendations,
} from "@/lib/data";
import type {
  DailyRecommendationCandidate,
  DailyRecommendationRun,
  DailyRecommendationsRunRequest,
  DailyRecommendationsRunResponse,
  WebSearchResult,
} from "@/lib/types";
import { getYouTubeId } from "@/lib/youtube";
import { sanitizeTitle } from "@/lib/text";
import { formatLocalDate } from "@/lib/calendar";
import { scoreTitleQueryMatch } from "@/lib/search";

type GeminiIdea = {
  title: string;
  meal_types?: string[];
  keywords?: string[];
  reason?: string;
};


const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);
}

function buildLastUsedMap(plans: { date: string; meals: Record<string, any> }[]) {
  const map = new Map<string, string>();
  plans.forEach((day) => {
    Object.values(day.meals).forEach((meal) => {
      if (!meal?.recipe_id) return;
      const current = map.get(meal.recipe_id);
      if (!current || day.date > current) {
        map.set(meal.recipe_id, day.date);
      }
    });
  });
  return map;
}

function parseGeminiJson(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function parseGeminiIdeas(raw: string): GeminiIdea[] {
  const parsed = parseGeminiJson(raw);
  if (!parsed) return [];
  const list = Array.isArray(parsed.ideas) ? parsed.ideas : Array.isArray(parsed) ? parsed : [];
  return list
    .map((item: any) => ({
      title: String(item?.title ?? "").trim(),
      meal_types: Array.isArray(item?.meal_types) ? item.meal_types : [],
      keywords: Array.isArray(item?.keywords) ? item.keywords : [],
      reason: item?.reason ? String(item.reason) : undefined,
    }))
    .filter((item: GeminiIdea) => item.title);
}

function buildGeminiPrompt(args: {
  count: number;
  liked: string[];
  language: "en" | "original";
}): string {
  const likedList = args.liked.slice(0, 10).join(", ");
  const isKorean = args.language === "original";
  return [
    isKorean
      ? "당신은 가족 식단 추천 도우미입니다."
      : "You are a meal planning assistant.",
    isKorean
      ? `${args.count}개의 새로운 요리 아이디어를 추천해 주세요.`
      : `Suggest ${args.count} new recipe ideas for a family with two kids.`,
    isKorean
      ? "제목은 짧고 유튜브 검색에 적합해야 합니다."
      : "Keep titles short and YouTube-search friendly.",
    isKorean
      ? "출력은 JSON만 반환하세요."
      : "Return JSON ONLY with this shape:",
    `{\"ideas\":[{\"title\":\"...\",\"meal_types\":[\"breakfast\"],\"keywords\":[\"...\"] ,\"reason\":\"...\"}]}`,
    likedList
      ? isKorean
        ? `가족이 좋아했던 메뉴: ${likedList}`
        : `Family liked: ${likedList}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function scoreCandidate(title: string, query: string, keywords: string[]): number {
  let score = scoreTitleQueryMatch(title, query);
  const normalized = title.toLowerCase();
  keywords.forEach((word) => {
    const token = word.toLowerCase();
    if (!token) return;
    if (normalized.includes(token)) score += 1;
  });
  return score;
}

async function searchWithYouTube(query: string, limit: number): Promise<WebSearchResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured.");
  }
  const hasHangul = /[ㄱ-ㅎ가-힣]/.test(query);
  const intentBoost = hasHangul
    ? "레시피 요리 만드는법 만들기"
    : "recipe cooking how to make step by step";
  const negativeTerms = hasHangul
    ? "-먹방 -asmr -리뷰 -소개 -광고"
    : "-mukbang -asmr -review -intro -ad";
  const shortsTerm = "-shorts";
  const tunedQuery = `${query} ${intentBoost} ${negativeTerms} ${shortsTerm}`.trim();
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(limit),
    q: tunedQuery,
    key: apiKey,
    videoEmbeddable: "true",
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error("YouTube search failed.");
  }
  const payload = await response.json();
  const items = payload.items ?? [];
  return items
    .map((item: any) => ({
      title: item.snippet?.title ?? "",
      url: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : "",
      snippet: item.snippet?.description ?? "",
    }))
    .filter((item: WebSearchResult) => item.url);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as DailyRecommendationsRunRequest;
  const force = Boolean(payload?.force);
  const targetDate = String(payload?.date ?? formatLocalDate(new Date()));
  const language = payload?.language === "original" ? "original" : "en";
  const requestedRunId = payload?.run_id ? String(payload.run_id) : "";
  const config = await getConfig();
  const store = await getDailyRecommendations();
  const debugEnabled = process.env.RECO_DEBUG === "1";
  const debugSteps: string[] = [];
  const logDebug = (...args: Array<string | number | object>) => {
    if (!debugEnabled) return;
    console.log("[daily-reco]", ...args);
  };
  const pushDebug = (label: string, value?: unknown) => {
    if (!debugEnabled) return;
    if (value === undefined) {
      debugSteps.push(label);
      return;
    }
    const preview =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    debugSteps.push(`${label}: ${preview}`);
  };
  if (config.daily_reco_enabled === false) {
    return NextResponse.json<DailyRecommendationsRunResponse>(
      { error: "Daily recommendations are disabled in config." },
      { status: 400 },
    );
  }
  const existing = store.runs?.find((run) => run.date === targetDate);
  if (existing && !force) {
    return NextResponse.json<DailyRecommendationsRunResponse>({ run: existing, reused: true });
  }

  const runId = requestedRunId || crypto.randomUUID();
  let run: DailyRecommendationRun = {
    id: runId,
    date: targetDate,
    created_at: new Date().toISOString(),
    status: "running",
    stage: "collect",
    stage_detail: {},
    model: undefined,
    language,
    stats: { existing_count: 0 },
    debug: debugEnabled ? debugSteps : undefined,
    candidates: [],
  };

  const commitRun = async () => {
    const expireDays = Math.max(1, config.daily_reco_expire_days ?? 7);
    const maxChips = Math.max(1, config.daily_reco_max_chips ?? 3);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - expireDays);
    const nextRuns = [
      run,
      ...(store.runs ?? []).filter((entry) => entry.date !== run.date),
    ]
      .filter((entry) => {
        const entryDate = new Date(`${entry.date}T00:00:00`);
        return entryDate >= cutoff;
      })
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, maxChips);
    store.runs = nextRuns;
    await saveDailyRecommendations({ runs: nextRuns });
  };

  await commitRun();

  try {
    debugSteps.push("Loading recipes and plan history.");
    logDebug("generate", { date: targetDate });
    const recipes = await getRecipes();
    if (!recipes.length) {
      run.status = "error";
      run.reason = "No recipes available yet.";
      debugSteps.push("No recipes found.");
      run.stage = "finalize";
      await commitRun();
    } else {
      const plans = await listDailyPlans();
      const lastUsedMap = buildLastUsedMap(plans);
      const today = new Date(`${targetDate}T00:00:00`);
      const total = Math.max(1, config.daily_reco_candidates ?? 6);
      const newRatio = Math.min(1, Math.max(0, config.daily_reco_new_ratio ?? 0.5));
      const newCount = Math.round(total * newRatio);
      const localCount = Math.max(1, total - newCount);
      debugSteps.push(`Target counts: local=${localCount}, new=${newCount}.`);
      run.stage = "local";
      await commitRun();
      const scored = recipes
        .map((recipe) => {
          const feedback = recipe.family_feedback ?? {};
          const feedbackScore = Object.values(feedback).reduce((sum, value) => sum + value, 0);
          const lastUsed = lastUsedMap.get(recipe.recipe_id);
          const daysSince = lastUsed ? daysBetween(today, new Date(`${lastUsed}T00:00:00`)) : 999;
          const recencyScore = Math.min(daysSince / 7, 1);
          const score = feedbackScore * 2 + recencyScore;
          let reason = language === "original" ? "다른 메뉴로 변화를 줬어요." : "Suggested for variety.";
          if (feedbackScore > 0 && daysSince > 7) {
            reason = language === "original"
              ? "가족 반응이 좋았고 최근에 만들지 않았어요."
              : "Family liked it and it hasn't been cooked recently.";
          } else if (feedbackScore > 0) {
            reason = language === "original" ? "가족 반응이 좋았던 메뉴예요." : "Family liked it recently.";
          } else if (daysSince > 7) {
            reason = language === "original"
              ? "최근에 만들지 않아 새로운 느낌이에요."
              : "Not cooked recently; good for variety.";
          }
          return { recipe, score, reason };
        })
        .sort((a, b) => b.score - a.score);

      const candidates: DailyRecommendationCandidate[] = scored.slice(0, localCount).map((item, idx) => ({
        id: crypto.randomUUID(),
        run_id: runId,
        source: "local",
        title: sanitizeTitle(
          language === "original"
            ? item.recipe.name_original ?? item.recipe.name
            : item.recipe.name,
        ),
        recipe_id: item.recipe.recipe_id,
        is_existing: true,
        thumbnail_url: item.recipe.thumbnail_url ?? null,
        meal_types: item.recipe.meal_types ?? [],
        reason: item.reason,
        score: item.score,
        rank: idx + 1,
        status: "new",
      }));

      let newCandidates: DailyRecommendationCandidate[] = [];
      if (newCount > 0 && !process.env.GEMINI_API_KEY) {
        run.status = "local-only";
        run.reason = "Gemini API not configured. Using local-only picks.";
        debugSteps.push("Gemini key missing; local-only.");
        run.stage = "finalize";
        await commitRun();
      } else if (newCount > 0 && !process.env.YOUTUBE_API_KEY) {
        run.status = "local-only";
        run.reason = "YouTube API not configured. Using local-only picks.";
        debugSteps.push("YouTube key missing; local-only.");
        run.stage = "finalize";
        await commitRun();
      } else if (newCount > 0 && process.env.GEMINI_API_KEY) {
        debugSteps.push("Calling Gemini for new ideas.");
        run.stage = "gemini";
        await commitRun();
        const liked = scored
          .filter((item) => item.score > 0 && (item.recipe.family_feedback ?? {}) && item.recipe.name)
          .slice(0, 8)
          .map((item) => item.recipe.name);
        const prompt = buildGeminiPrompt({
          count: newCount,
          liked,
          language,
        });
        const model = "gemini-2.5-flash";
        run.model = model;
        pushDebug("Gemini prompt", prompt);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, topP: 0.9 },
          }),
        });
        if (geminiRes.ok) {
          const geminiPayload = await geminiRes.json();
          const text = geminiPayload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          pushDebug("Gemini raw", text);
          const ideas = parseGeminiIdeas(text).slice(0, newCount);
          debugSteps.push(`Gemini ideas: ${ideas.length}.`);
          run.stage = "youtube";
          run.stage_detail = {
            youtube_total: ideas.length,
            youtube_done: 0,
          };
          await commitRun();
          const results: DailyRecommendationCandidate[] = [];
          let ideaIndex = 0;
          for (const idea of ideas) {
            ideaIndex += 1;
            try {
              debugSteps.push(`YouTube search: ${idea.title}`);
              run.stage_detail = {
                youtube_total: ideas.length,
                youtube_done: ideaIndex - 1,
                current_idea: idea.title,
              };
              await commitRun();
              const searches = await searchWithYouTube(idea.title, 4);
              pushDebug(
                "YouTube results",
                searches.map((item) => item.title),
              );
              const ranked = searches
                .map((item) => ({
                  item,
                  score: scoreCandidate(item.title, idea.title, idea.keywords ?? []),
                }))
                .sort((a, b) => b.score - a.score);
              pushDebug(
                "YouTube ranked",
                ranked.map((entry) => ({
                  title: entry.item.title,
                  score: entry.score,
                })),
              );
              const pick = ranked[0]?.item;
              if (!pick) continue;
              const existing = await getRecipeBySourceUrl(pick.url);
              if (existing) {
                run.stats = {
                  ...(run.stats ?? {}),
                  existing_count: (run.stats?.existing_count ?? 0) + 1,
                };
                debugSteps.push(`Existing candidate: ${pick.title}`);
              }
              const youtubeId = getYouTubeId(pick.url);
              results.push({
                id: crypto.randomUUID(),
                run_id: runId,
                source: "youtube",
                title: sanitizeTitle(pick.title),
                source_url: pick.url,
                recipe_id: existing?.recipe_id,
                is_existing: Boolean(existing),
                thumbnail_url: youtubeId
                  ? `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`
                  : null,
                meal_types: idea.meal_types ?? [],
                reason: idea.reason ?? "New idea from recommendations.",
                score: ranked[0]?.score ?? 0,
                rank: candidates.length + results.length + 1,
                status: "new",
              });
              run.stage_detail = {
                youtube_total: ideas.length,
                youtube_done: ideaIndex,
                current_idea: idea.title,
              };
              await commitRun();
            } catch {
              continue;
            }
          }
          newCandidates = results;
        } else {
          run.status = "local-only";
          run.reason = "Gemini request failed. Using local-only picks.";
          debugSteps.push("Gemini request failed.");
          run.stage = "finalize";
          await commitRun();
        }
      }

      run.candidates = [...candidates, ...newCandidates];
      run.stage = "finalize";
      run.stage_detail = {};
      if (newCandidates.length > 0) {
        run.status = "ok";
        run.reason = "Recommendations include new ideas.";
      } else if (newCount > 0 && run.status !== "error") {
        run.status = "local-only";
        run.reason = "No new candidates found. Using local-only picks.";
      }
      await commitRun();
    }
  } catch (error) {
    run.status = "error";
    run.reason = error instanceof Error ? error.message : "Unable to generate recommendations.";
    run.candidates = [];
    debugSteps.push("Generation error.");
    run.stage = "finalize";
    await commitRun();
  }

  run.status = run.status === "running" ? "local-only" : run.status;
  await commitRun();
  return NextResponse.json<DailyRecommendationsRunResponse>({ run });
}

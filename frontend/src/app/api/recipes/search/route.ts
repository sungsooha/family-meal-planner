import { NextResponse } from "next/server";
import { getYouTubeId } from "@/lib/youtube";
import type { RecipeSearchCandidate, RecipeSearchRequest, RecipeSearchResponse, WebSearchResult } from "@/lib/types";
import { hostFromUrl, scoreTitleQueryMatch } from "@/lib/search";

function extractJsonLd(html: string) {
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const blocks: unknown[] = [];
  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return blocks;
}

function pickRecipeObject(blocks: unknown[]): any | null {
  const list = blocks.flatMap((block) => (Array.isArray(block) ? block : [block]));
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const obj = item as any;
    if (obj["@graph"] && Array.isArray(obj["@graph"])) {
      const found = pickRecipeObject(obj["@graph"]);
      if (found) return found;
    }
    const type = obj["@type"];
    if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
      return obj;
    }
  }
  return null;
}

function normalizeInstructions(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!item) return [];
      if (typeof item === "string") return [item.trim()];
      if (typeof item === "object" && "text" in item) return [(item as any).text].filter(Boolean);
      return [];
    });
  }
  return [];
}

function normalizeIngredients(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((line) => line.trim()).filter(Boolean);
  return [];
}

function normalizeImage(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === "object" && "url" in value) return (value as any).url ?? null;
  return null;
}

async function fetchRecipeCandidate(url: string, fallbackTitle: string): Promise<RecipeSearchCandidate | null> {
  const youtubeId = getYouTubeId(url);
  if (youtubeId) {
    return {
      title: fallbackTitle,
      source_url: url,
      thumbnail_url: `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`,
      ingredients: [],
      instructions: [],
      source_host: hostFromUrl(url),
    };
  }
  const response = await fetch(url);
  if (!response.ok) return null;
  const html = await response.text();
  const blocks = extractJsonLd(html);
  const recipe = pickRecipeObject(blocks);
  if (!recipe) return null;
  return {
    title: recipe.name ?? fallbackTitle,
    source_url: url,
    thumbnail_url: normalizeImage(recipe.image),
    servings: recipe.recipeYield ?? null,
    ingredients: normalizeIngredients(recipe.recipeIngredient ?? recipe.ingredients),
    instructions: normalizeInstructions(recipe.recipeInstructions),
    source_host: hostFromUrl(url),
  };
}

async function searchWithMcp(query: string, limit: number, source: string): Promise<WebSearchResult[]> {
  const endpoint = process.env.MCP_WEB_SEARCH_URL;
  if (!endpoint) {
    throw new Error("MCP_WEB_SEARCH_URL is not configured.");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, source }),
  });
  if (!response.ok) {
    throw new Error("Search failed.");
  }
  const payload = await response.json();
  const results = payload.results ?? payload.items ?? payload.data ?? [];
  return results
    .map((item: any) => ({
      title: item.title ?? item.name ?? item.url ?? "",
      url: item.url ?? item.link ?? "",
      snippet: item.snippet ?? item.description ?? "",
    }))
    .filter((item: WebSearchResult) => item.url);
}

async function searchWithYouTube(
  query: string,
  limit: number,
  includeShorts: boolean,
): Promise<WebSearchResult[]> {
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
  const shortsTerm = includeShorts ? "" : "-shorts";
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
  const payload = (await request.json().catch(() => null)) as RecipeSearchRequest | null;
  if (!payload?.query) {
    return NextResponse.json<RecipeSearchResponse>({ error: "Missing query.", candidates: [] }, { status: 400 });
  }
  const query = String(payload.query);
  const limit = Number(payload.limit ?? 6);
  const source = String(payload.source ?? "all");
  const includeShorts = Boolean(payload.include_shorts ?? true);
  try {
    let results: WebSearchResult[] = [];
    let notice: string | null = null;
    if (source === "youtube") {
      results = await searchWithYouTube(query, limit, includeShorts);
      notice = "Using YouTube search results.";
    } else {
      try {
        results = await searchWithMcp(query, limit, source);
      } catch (error) {
        if (process.env.YOUTUBE_API_KEY) {
          results = await searchWithYouTube(query, limit, includeShorts);
          notice = "MCP search unavailable. Using YouTube search instead.";
        } else {
          throw error;
        }
      }
    }
    const candidates: RecipeSearchCandidate[] = [];
    for (const result of results.slice(0, limit)) {
      const candidate = await fetchRecipeCandidate(result.url, result.title);
      if (candidate) candidates.push(candidate);
    }
    const ranked = candidates
      .map((candidate) => ({
        ...candidate,
        _score: scoreTitleQueryMatch(candidate.title, query, hostFromUrl(candidate.source_url)),
      }))
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...rest }) => rest);
    return NextResponse.json<RecipeSearchResponse>(
      {
        candidates: ranked,
        notice:
          notice ??
          "Powered by MCP search. If no structured recipe data is found, try a different source.",
        hint:
          ranked.length === 0
            ? "No structured recipe data found. Try a different recipe name or open a YouTube result and paste the recipe manually."
            : null,
      },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error: any) {
    return NextResponse.json<RecipeSearchResponse>(
      { error: error?.message ?? "Search failed.", candidates: [] },
      { status: 500 },
    );
  }
}

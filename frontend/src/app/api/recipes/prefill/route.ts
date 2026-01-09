import { NextResponse } from "next/server";
import { buildGeminiRecipePrompt } from "@/lib/prompt";
type PrefillPayload = {
  name: string;
  name_original?: string;
  meal_types?: string[];
  servings?: number | string | null;
  source_url?: string | null;
  thumbnail_url?: string | null;
  ingredients_text?: string;
  ingredients_original_text?: string;
  instructions_text?: string;
  instructions_original_text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"]);
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const prefillCache = new Map<
  string,
  {
    expiresAt: number;
    prefill: PrefillPayload;
    model?: string;
  }
>();

function youtubeIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace("/", "");
    }
    const id = parsed.searchParams.get("v");
    if (id) return id;
  } catch {
    return null;
  }
  return null;
}

async function fetchYouTubeDetails(videoId: string, apiKey: string) {
  const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailsUrl.searchParams.set("part", "snippet");
  detailsUrl.searchParams.set("id", videoId);
  detailsUrl.searchParams.set("key", apiKey);
  const detailsRes = await fetch(detailsUrl.toString());
  if (!detailsRes.ok) {
    throw new Error("YouTube metadata fetch failed.");
  }
  const detailsPayload = await detailsRes.json();
  const snippet = detailsPayload.items?.[0]?.snippet ?? {};
  const title = snippet.title ?? "";
  const description = snippet.description ?? "";
  const thumbnail =
    snippet.thumbnails?.maxres?.url ??
    snippet.thumbnails?.high?.url ??
    snippet.thumbnails?.medium?.url ??
    snippet.thumbnails?.default?.url ??
    "";

  let topComment = "";
  let commentWithLink = "";
  const commentUrl = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  commentUrl.searchParams.set("part", "snippet");
  commentUrl.searchParams.set("videoId", videoId);
  commentUrl.searchParams.set("order", "relevance");
  commentUrl.searchParams.set("maxResults", "5");
  commentUrl.searchParams.set("key", apiKey);
  const commentRes = await fetch(commentUrl.toString());
  if (commentRes.ok) {
    const commentPayload = await commentRes.json();
    const comments =
      commentPayload.items?.map((item: any) => item?.snippet?.topLevelComment?.snippet) ?? [];
    const first = comments[0];
    topComment = first?.textOriginal ?? first?.textDisplay ?? "";
    for (const comment of comments) {
      const text = comment?.textOriginal ?? comment?.textDisplay ?? "";
      if (text && /https?:\/\//i.test(text)) {
        commentWithLink = text;
        break;
      }
    }
  }
  return { title, description, topComment, thumbnail, commentWithLink };
}

function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s)]+/i);
  if (!match) return null;
  return match[0].replace(/[),.]+$/, "");
}

async function fetchLinkedText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return "";
    const html = await res.text();
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const text = withoutScripts
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
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

function formatIngredients(items?: Array<{ name: string; quantity: number | string; unit: string }>) {
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => [item.name ?? "", item.quantity ?? "", item.unit ?? ""].join(","))
    .filter((line) => line.trim())
    .join("\n");
}

function formatInstructions(items?: string[]) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => item.trim()).filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload?.source_url) {
    return NextResponse.json({ error: "Missing source_url." }, { status: 400 });
  }

  const sourceUrl = String(payload.source_url);
  const videoId = youtubeIdFromUrl(sourceUrl);
  if (!videoId) {
    return NextResponse.json({ error: "Only YouTube URLs are supported right now." }, { status: 400 });
  }
  const forceRefresh = Boolean(payload.force);

  const cacheKey = videoId;
  const cached = prefillCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ prefill: cached.prefill, cached: true, model: cached.model });
  }

  const youtubeKey = process.env.YOUTUBE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!youtubeKey || !geminiKey) {
    return NextResponse.json({ error: "Missing YOUTUBE_API_KEY or GEMINI_API_KEY." }, { status: 500 });
  }

  try {
    const { title, description, topComment, thumbnail, commentWithLink } = await fetchYouTubeDetails(
      videoId,
      youtubeKey,
    );
    const linkFromDescription = extractFirstUrl(description);
    const linkFromComment = extractFirstUrl(commentWithLink || topComment);
    const linkedUrl = linkFromDescription || linkFromComment;
    const linkedText = linkedUrl ? await fetchLinkedText(linkedUrl) : "";
    const prompt = buildGeminiRecipePrompt({
      title,
      description,
      topComment,
      linkedUrl,
      linkedText,
    });

    const modelOverride = payload?.model ? String(payload.model) : null;
    const models = modelOverride
      ? [modelOverride]
      : ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash"];
    let geminiPayload: GeminiResponse | null = null;
    let usedModel = "";
    let lastError = "";
    for (const model of models) {
      usedModel = model;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, topP: 0.9 },
        }),
      });
      if (!geminiRes.ok) {
        const details = await geminiRes.json().catch(() => null);
        const reason = details?.error?.message ?? geminiRes.statusText ?? "Unknown error";
        lastError = `Gemini request failed (model ${model}): ${reason}`;
        continue;
      }
      geminiPayload = (await geminiRes.json()) as GeminiResponse;
      break;
    }
    if (!geminiPayload) {
      throw new Error(lastError || "Gemini request failed.");
    }
    const text = geminiPayload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const parsed = parseGeminiJson(text);
    if (!parsed) {
      throw new Error("Unable to parse Gemini response.");
    }

    const inferredMealTypes = Array.isArray(parsed.meal_types) ? parsed.meal_types.filter(Boolean) : [];
    const prefill: PrefillPayload = {
      name: parsed.name ?? title ?? "",
      name_original: parsed.name_original ?? title ?? "",
      meal_types: inferredMealTypes.length > 0 ? inferredMealTypes : ["Flexible"],
      servings: parsed.servings ?? null,
      source_url: sourceUrl,
      thumbnail_url: thumbnail ?? payload.thumbnail_url ?? null,
      ingredients_text: formatIngredients(parsed.ingredients),
      ingredients_original_text: formatIngredients(parsed.ingredients_original ?? parsed.ingredients),
      instructions_text: formatInstructions(parsed.instructions),
      instructions_original_text: formatInstructions(parsed.instructions_original ?? parsed.instructions),
    };

    prefillCache.set(cacheKey, { prefill, expiresAt: Date.now() + CACHE_TTL_MS, model: usedModel });

    return NextResponse.json({ prefill, cached: false, model: usedModel });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message ?? "Prefill failed." }, { status: 500 });
  }
}

"use client";

import { useCallback, useState } from "react";
import type { ManualRecipePrefill } from "@/components/ManualRecipeModal";

export type PrefillCandidate = {
  title: string;
  source_url: string;
  servings?: number | string | null;
  ingredients?: string[];
  instructions?: string[];
  thumbnail_url?: string | null;
};

const PREFILL_CACHE_KEY = "recipe_prefill_cache";
const PREFILL_TTL_MS = 1000 * 60 * 60 * 6;
const PREFILL_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash"];

export function useRecipePrefill() {
  const [prefill, setPrefill] = useState<ManualRecipePrefill | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const loadCache = useCallback((url: string) => {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(PREFILL_CACHE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const entry = parsed?.[url];
      if (!entry || !entry.prefill || !entry.expiresAt) return null;
      if (Date.now() > entry.expiresAt) return null;
      return entry as { prefill: ManualRecipePrefill; model?: string; expiresAt: number };
    } catch {
      return null;
    }
  }, []);

  const saveCache = useCallback((url: string, data: { prefill: ManualRecipePrefill; model?: string }) => {
    if (typeof sessionStorage === "undefined") return;
    try {
      const stored = sessionStorage.getItem(PREFILL_CACHE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[url] = {
        prefill: data.prefill,
        model: data.model ?? null,
        expiresAt: Date.now() + PREFILL_TTL_MS,
      };
      sessionStorage.setItem(PREFILL_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore cache write errors.
    }
  }, []);

  const runPrefill = useCallback(
    async (url: string, thumb: string | null, force: boolean) => {
      setLoading(true);
      setError("");
      setNotice("");
      setLoadingModel(null);
      if (!force) {
        const cached = loadCache(url);
        if (cached?.prefill) {
          setPrefill(cached.prefill);
          setNotice(
            cached.model
              ? `Using cached auto-fill result (${cached.model}).`
              : "Using cached auto-fill result.",
          );
          setLoadingModel(cached.model ?? null);
          setLoading(false);
          return;
        }
      }
      let lastError = "";
      for (const model of PREFILL_MODELS) {
        setLoadingModel(model);
        try {
          const response = await fetch("/api/recipes/prefill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_url: url,
              thumbnail_url: thumb,
              force,
              model,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Auto-fill failed.");
          }
          if (payload.prefill) {
            setPrefill(payload.prefill as ManualRecipePrefill);
            saveCache(url, { prefill: payload.prefill, model: payload.model ?? model });
          }
          if (payload.cached) {
            setNotice(
              payload.model
                ? `Using cached auto-fill result (${payload.model}).`
                : "Using cached auto-fill result.",
            );
          } else if (payload.model || model) {
            setNotice(`Auto-fill completed with ${payload.model ?? model}.`);
          }
          setLoading(false);
          return;
        } catch (fetchError) {
          lastError = (fetchError as Error).message ?? "Auto-fill failed.";
          continue;
        }
      }
      if (lastError.toLowerCase().includes("quota")) {
        setNotice("Auto-fill unavailable: Gemini quota exceeded. Please check billing/quota.");
      } else {
        setError(lastError || "Auto-fill failed.");
      }
      setLoading(false);
    },
    [loadCache, saveCache],
  );

  const startFromCandidate = useCallback(
    (candidate: PrefillCandidate) => {
      setSourceUrl(candidate.source_url);
      setThumbnailUrl(candidate.thumbnail_url ?? null);
      setPrefill({
        name: candidate.title,
        name_original: candidate.title,
        servings: candidate.servings ?? "",
        source_url: candidate.source_url,
        thumbnail_url: candidate.thumbnail_url ?? null,
        ingredients_text: candidate.ingredients?.join("\n") ?? "",
        ingredients_original_text: candidate.ingredients?.join("\n") ?? "",
        instructions_text: candidate.instructions?.join("\n") ?? "",
        instructions_original_text: candidate.instructions?.join("\n") ?? "",
      });
      void runPrefill(candidate.source_url, candidate.thumbnail_url ?? null, false);
    },
    [runPrefill],
  );

  const retryPrefill = useCallback(() => {
    if (!sourceUrl) return;
    void runPrefill(sourceUrl, thumbnailUrl, true);
  }, [runPrefill, sourceUrl, thumbnailUrl]);

  const reset = useCallback(() => {
    setPrefill(null);
    setLoading(false);
    setLoadingModel(null);
    setNotice("");
    setError("");
    setSourceUrl(null);
    setThumbnailUrl(null);
  }, []);

  return {
    prefill,
    setPrefill,
    loading,
    loadingModel,
    notice,
    error,
    sourceUrl,
    thumbnailUrl,
    startFromCandidate,
    runPrefill,
    retryPrefill,
    reset,
  };
}

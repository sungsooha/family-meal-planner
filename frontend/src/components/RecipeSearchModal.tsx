"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRecipes } from "@/lib/useRecipes";
import { decodeHtmlEntities, sanitizeTitle } from "@/lib/text";
import type { Recipe } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

type RecipeCandidate = {
  title: string;
  source_url: string;
  thumbnail_url?: string | null;
  servings?: number | string | null;
  ingredients?: string[];
  instructions?: string[];
  source_host?: string;
};


type Props = {
  open: boolean;
  onClose: () => void;
  onUseCandidate: (candidate: RecipeCandidate) => void;
  initialQuery?: string;
};

const STORAGE_KEY = "recipe_search_state";
const CACHE_KEY = "recipe_search_cache";
const CACHE_LIMIT = 5;

type CachePayload = {
  query: string;
  onlyYoutube: boolean;
  includeShorts?: boolean;
  onlineResults: RecipeCandidate[];
  searchNotice: string;
  searchHint: string;
};

export default function RecipeSearchModal({
  open,
  onClose,
  onUseCandidate,
  initialQuery,
}: Props) {
  const hydratedRef = useRef(false);
  const { language } = useLanguage();
  const decodeHtml = decodeHtmlEntities;

  const { recipes } = useRecipes<Recipe>();
  const [query, setQuery] = useState("");
  const [onlyYoutube, setOnlyYoutube] = useState(false);
  const [onlineResults, setOnlineResults] = useState<RecipeCandidate[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searchNotice, setSearchNotice] = useState("");
  const [searchHint, setSearchHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewCandidate, setPreviewCandidate] = useState<RecipeCandidate | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [includeShorts, setIncludeShorts] = useState(true);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  const saveCacheEntry = (term: string, payload: CachePayload) => {
    if (typeof sessionStorage === "undefined") return;
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      const parsed = stored ? JSON.parse(stored) : { entries: {}, order: [] };
      const entries: Record<string, CachePayload> = parsed.entries ?? {};
      const order: string[] = Array.isArray(parsed.order) ? parsed.order : [];
      const key = trimmed.toLowerCase();
      entries[key] = payload;
      const nextOrder = [key, ...order.filter((item) => item !== key)].slice(0, CACHE_LIMIT);
      const keep = new Set(nextOrder);
      Object.keys(entries).forEach((entryKey) => {
        if (!keep.has(entryKey)) delete entries[entryKey];
      });
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ entries, order: nextOrder }));
      setRecentQueries(nextOrder);
    } catch {
      // Ignore cache write errors.
    }
  };

  const loadCacheEntry = (term: string) => {
    if (typeof sessionStorage === "undefined") return null;
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return null;
    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (!stored) return null;
      const cache = JSON.parse(stored);
      const entries = cache.entries ?? {};
      return entries[trimmed] ?? null;
    } catch {
      return null;
    }
  };

  const loadRecentQueries = (): string[] => {
    if (typeof sessionStorage === "undefined") return [];
    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (!stored) return [];
      const cache = JSON.parse(stored);
      if (!Array.isArray(cache.order)) return [];
      return cache.order.filter((entry: unknown) => typeof entry === "string");
    } catch {
      return [];
    }
  };

  const applyCachedQuery = (term: string) => {
    const safeTerm = String(term ?? "");
    const cached = loadCacheEntry(safeTerm);
    if (!cached) return;
    setQuery(safeTerm);
    setOnlyYoutube(cached.onlyYoutube ?? false);
    if (typeof cached.includeShorts === "boolean") {
      setIncludeShorts(cached.includeShorts);
    }
    setOnlineResults(cached.onlineResults ?? []);
    setSearchNotice(cached.searchNotice ?? "");
    setSearchHint(cached.searchHint ?? "");
  };

  const removeCachedQuery = (term: string) => {
    const safeTerm = String(term ?? "").trim().toLowerCase();
    if (!safeTerm || typeof sessionStorage === "undefined") return;
    try {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (!stored) return;
      const cache = JSON.parse(stored);
      const entries = cache.entries ?? {};
      const order: unknown[] = Array.isArray(cache.order) ? cache.order : [];
      if (entries[safeTerm]) {
        delete entries[safeTerm];
      }
      const nextOrder = order.filter((item: unknown) => item !== safeTerm);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ entries, order: nextOrder }));
      const normalized = nextOrder.filter((item: unknown): item is string => typeof item === "string");
      setRecentQueries(normalized);
      if (query.trim().toLowerCase() === safeTerm) {
        setQuery("");
        setOnlineResults([]);
        setSearchNotice("");
        setSearchHint("");
        setSearchError("");
      }
    } catch {
      // Ignore cache errors.
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const localResults = normalizedTokens.length > 0
    ? recipes
        .filter((recipe) => {
          const name = recipe.name?.toLowerCase() ?? "";
          const nameOriginal = recipe.name_original?.toLowerCase() ?? "";
          return normalizedTokens.every(
            (token) => name.includes(token) || nameOriginal.includes(token),
          );
        })
        .slice(0, 5)
    : [];

  const handleSearch = async (overrideQuery?: string) => {
    const term =
      typeof overrideQuery === "string" ? overrideQuery : String((overrideQuery ?? query) ?? "");
    setSearchError("");
    setSearchNotice("");
    setSearchHint("");
    setOnlineResults([]);
    if (!term.trim()) {
      setSearchError("Enter a recipe name to search.");
      return;
    }
    const cached = loadCacheEntry(term);
    if (cached) {
      setOnlineResults(cached.onlineResults ?? []);
      setSearchNotice(cached.searchNotice ?? "");
      setSearchHint(cached.searchHint ?? "");
      setOnlyYoutube(cached.onlyYoutube ?? false);
      return;
    }
    setLoading(true);
    const response = await fetch("/api/recipes/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: term.trim(),
        limit: 6,
        source: onlyYoutube ? "youtube" : "all",
        include_shorts: includeShorts,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSearchError(payload.error ?? "Search failed.");
      setLoading(false);
      return;
    }
    setOnlineResults(payload.candidates ?? []);
    setSearchNotice(payload.notice ?? "");
    setSearchHint(payload.hint ?? "");
    saveCacheEntry(term, {
      query: term.trim(),
      onlyYoutube,
      includeShorts,
      onlineResults: payload.candidates ?? [],
      searchNotice: payload.notice ?? "",
      searchHint: payload.hint ?? "",
    });
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setRecentQueries(loadRecentQueries());
    if (initialQuery && initialQuery.trim()) {
      const trimmed = initialQuery.trim();
      setQuery(trimmed);
      void handleSearch(trimmed);
      return;
    }
    if (typeof sessionStorage === "undefined") return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.query) setQuery(String(parsed.query));
      if (typeof parsed.onlyYoutube === "boolean") setOnlyYoutube(parsed.onlyYoutube);
      if (Array.isArray(parsed.onlineResults)) setOnlineResults(parsed.onlineResults);
      if (typeof parsed.searchNotice === "string") setSearchNotice(parsed.searchNotice);
      if (typeof parsed.searchHint === "string") setSearchHint(parsed.searchHint);
    } catch {
      // Ignore storage errors.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) {
      hydratedRef.current = false;
      return;
    }
    if (typeof sessionStorage === "undefined") return;
    const payload = {
      query,
      onlyYoutube,
      includeShorts,
      onlineResults,
      searchNotice,
      searchHint,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [open, query, onlyYoutube, onlineResults, searchNotice, searchHint]);

  if (!open) return null;

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const modalWidth = Math.min(1024, Math.max(320, viewportWidth - 32));
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
        className="max-h-[80vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        style={{ width: modalWidth }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            <Search className="h-4 w-4" />
            Search recipes
          </div>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search recipes (local + YouTube)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
          />
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
            onClick={() => handleSearch()}
          >
            Search
          </button>
          <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
            <input
              type="checkbox"
              checked={onlyYoutube}
              onChange={(event) => setOnlyYoutube(event.target.checked)}
            />
            YouTube only
          </label>
          <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
            <input
              type="checkbox"
              checked={includeShorts}
              onChange={(event) => setIncludeShorts(event.target.checked)}
            />
            Include Shorts
          </label>
        </div>
        {recentQueries.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span className="uppercase tracking-wide text-slate-400">Recent</span>
            {recentQueries.map((term) => (
              <div
                key={term}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500"
              >
                <button className="hover:text-slate-700" onClick={() => applyCachedQuery(term)}>
                  {term}
                </button>
                <button
                  className="text-[10px] text-rose-400 hover:text-rose-500"
                  onClick={() => removeCachedQuery(term)}
                  aria-label={`Remove ${term}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {loading && <p className="mt-2 text-xs text-slate-500">Searching…</p>}
        {searchError && <p className="mt-2 text-xs text-rose-500">{searchError}</p>}
        {searchNotice && <p className="mt-2 text-xs text-slate-500">{searchNotice}</p>}
        {searchHint && <p className="mt-2 text-xs text-slate-500">{searchHint}</p>}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Your recipes</p>
            {localResults.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No local matches yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {localResults.map((item) => (
                  <Link
                    key={item.recipe_id}
                    href={`/recipes/${item.recipe_id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-200 hover:bg-white"
                    onClick={onClose}
                    onMouseMove={(event) => {
                      setPreviewPos({ x: event.clientX, y: event.clientY });
                      setPreviewCandidate({
                        title: language === "original" && item.name_original ? item.name_original : item.name,
                        source_url: `/recipes/${item.recipe_id}`,
                        thumbnail_url: item.thumbnail_url ?? null,
                      });
                    }}
                    onMouseLeave={() => setPreviewCandidate(null)}
                    onFocus={() =>
                      setPreviewCandidate({
                        title: language === "original" && item.name_original ? item.name_original : item.name,
                        source_url: `/recipes/${item.recipe_id}`,
                        thumbnail_url: item.thumbnail_url ?? null,
                      })
                    }
                  >
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        className="h-10 w-14 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-slate-100 text-[9px] text-slate-400">
                        No image
                      </div>
                    )}
                    {language === "original" && item.name_original ? item.name_original : item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="relative rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Online results</p>
            {onlineResults.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">Run a search to see results.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {onlineResults.map((item) => (
                  <button
                    key={item.source_url}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:border-slate-200 hover:bg-white"
                    onClick={() =>
                      onUseCandidate({
                        ...item,
                        title: sanitizeTitle(item.title),
                        ingredients: item.ingredients?.map(decodeHtml),
                        instructions: item.instructions?.map(decodeHtml),
                      })
                    }
                    onMouseMove={(event) => {
                      setPreviewPos({ x: event.clientX, y: event.clientY });
                      setPreviewCandidate(item);
                    }}
                    onMouseLeave={() => setPreviewCandidate(null)}
                    onFocus={() => setPreviewCandidate(item)}
                  >
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        className="h-10 w-14 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-slate-100 text-[9px] text-slate-400">
                        No image
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-700">
                      {sanitizeTitle(item.title)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {previewCandidate && previewPos && (
          <div
            className="pointer-events-none fixed z-50 w-56 rounded-2xl border border-slate-200 bg-white p-3 text-[10px] text-slate-500 shadow-xl"
            style={{
              top: Math.min(previewPos.y + 16, viewportHeight - 240),
              left: Math.min(previewPos.x + 16, viewportWidth - 240),
            }}
          >
            {previewCandidate.thumbnail_url ? (
              <img
                src={previewCandidate.thumbnail_url}
                alt=""
                className="h-28 w-full rounded-xl object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-28 w-full items-center justify-center rounded-xl bg-slate-100 text-[9px] text-slate-400">
                No thumbnail
              </div>
            )}
            <p className="mt-2 font-semibold text-slate-700">
              {sanitizeTitle(previewCandidate.title)}
            </p>
            {previewCandidate.source_host && (
              <p className="mt-1 text-[9px] uppercase tracking-wide text-slate-400">
                {decodeHtml(previewCandidate.source_host)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

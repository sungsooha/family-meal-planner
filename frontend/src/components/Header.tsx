"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { History, Search } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { getSupabaseBrowser } from "@/lib/supabase";
import RecipeSearchModal from "./RecipeSearchModal";
import ManualRecipeModal, { ManualRecipePrefill } from "./ManualRecipeModal";
import { useSWRConfig } from "swr";
import { registerOptimisticRecipe } from "@/lib/optimistic";

const PREFILL_CACHE_KEY = "recipe_prefill_cache";
const PREFILL_TTL_MS = 1000 * 60 * 60 * 6;
const PREFILL_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash"];

export default function Header() {
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<ManualRecipePrefill | null>(null);
  const [manualFromSearch, setManualFromSearch] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualNotice, setManualNotice] = useState("");
  const [manualSourceUrl, setManualSourceUrl] = useState<string | null>(null);
  const [manualThumbnailUrl, setManualThumbnailUrl] = useState<string | null>(null);
  const [manualLoadingModel, setManualLoadingModel] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleManualCreated = (recipe: { recipe_id: string }) => {
    registerOptimisticRecipe(recipe);
    mutate("/api/recipes?view=summary");
    mutate("/api/recipes");
    setManualFromSearch(false);
  };

  const handleUseCandidate = (candidate: {
    title: string;
    source_url: string;
    servings?: number | string | null;
    ingredients?: string[];
    instructions?: string[];
    source_host?: string;
    thumbnail_url?: string | null;
  }) => {
    setSearchOpen(false);
    setManualFromSearch(true);
    setManualError("");
    setManualNotice("");
    setManualLoading(true);
    setManualSourceUrl(candidate.source_url);
    setManualThumbnailUrl(candidate.thumbnail_url ?? null);
    setManualPrefill({
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
    setManualOpen(true);
    void runPrefill(candidate.source_url, candidate.thumbnail_url ?? null, false);
  };

  const loadPrefillCache = (sourceUrl: string) => {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(PREFILL_CACHE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const entry = parsed?.[sourceUrl];
      if (!entry || !entry.prefill || !entry.expiresAt) return null;
      if (Date.now() > entry.expiresAt) return null;
      return entry;
    } catch {
      return null;
    }
  };

  const savePrefillCache = (sourceUrl: string, data: { prefill: ManualRecipePrefill; model?: string }) => {
    if (typeof sessionStorage === "undefined") return;
    try {
      const stored = sessionStorage.getItem(PREFILL_CACHE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[sourceUrl] = {
        prefill: data.prefill,
        model: data.model ?? null,
        expiresAt: Date.now() + PREFILL_TTL_MS,
      };
      sessionStorage.setItem(PREFILL_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore cache write errors.
    }
  };

  const runPrefill = async (sourceUrl: string, thumbnailUrl: string | null, force: boolean) => {
    setManualLoading(true);
    setManualError("");
    setManualNotice("");
    setManualLoadingModel(null);
    if (!force) {
      const cached = loadPrefillCache(sourceUrl);
      if (cached?.prefill) {
        setManualPrefill(cached.prefill as ManualRecipePrefill);
        setManualNotice(
          cached.model
            ? `Using cached auto-fill result (${cached.model}).`
            : "Using cached auto-fill result.",
        );
        setManualLoadingModel(cached.model ?? null);
        setManualLoading(false);
        return;
      }
    }
    let lastError = "";
    for (const model of PREFILL_MODELS) {
      setManualLoadingModel(model);
      try {
        const response = await fetch("/api/recipes/prefill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_url: sourceUrl,
            thumbnail_url: thumbnailUrl,
            force,
            model,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Auto-fill failed.");
        }
        if (payload.prefill) {
          setManualPrefill(payload.prefill as ManualRecipePrefill);
          savePrefillCache(sourceUrl, { prefill: payload.prefill, model: payload.model ?? model });
        }
        if (payload.cached) {
          setManualNotice(
            payload.model
              ? `Using cached auto-fill result (${payload.model}).`
              : "Using cached auto-fill result.",
          );
        } else if (payload.model || model) {
          setManualNotice(`Auto-fill completed with ${payload.model ?? model}.`);
        }
        setManualLoading(false);
        return;
      } catch (error) {
        lastError = (error as Error).message ?? "Auto-fill failed.";
        continue;
      }
    }
    if (lastError.toLowerCase().includes("quota")) {
      setManualNotice("Auto-fill unavailable: Gemini quota exceeded. Please check billing/quota.");
    } else {
      setManualError(lastError || "Auto-fill failed.");
    }
    setManualLoading(false);
  };

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        document.documentElement.style.setProperty("--header-height", `${headerRef.current.offsetHeight}px`);
      }
    };
    updateHeaderHeight();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && headerRef.current) {
      observer = new ResizeObserver(updateHeaderHeight);
      observer.observe(headerRef.current);
    }
    window.addEventListener("resize", updateHeaderHeight);
    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
      observer?.disconnect();
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-30 border-b bg-[#f9f4ec]/90 backdrop-blur transition ${
        scrolled ? "border-white/30 shadow-md" : "border-white/60 shadow-none"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-2 px-6 pb-2 pt-3 text-xs font-medium text-slate-600">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center">
            <img
              src="/together_at_the_table_full.png"
              alt="Together at the table illustration"
              className="h-20 w-auto sm:h-24 md:h-28"
              loading="eager"
            />
          </div>
          <div className="flex w-full flex-1 flex-col gap-2 sm:items-end">
            <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:justify-end">
              <select
                className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] shadow-sm"
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "original")}
              >
                <option value="en">English</option>
                <option value="original">Original</option>
              </select>
              <Link
                className={`rounded-full border px-2.5 py-1 text-[11px] shadow-sm hover:text-slate-900 ${
                  pathname === "/"
                    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                    : "border-slate-200 bg-white/80 text-slate-600"
                }`}
                href="/"
              >
                Weekly Plan
              </Link>
              <Link
                className={`rounded-full border px-2.5 py-1 text-[11px] shadow-sm hover:text-slate-900 ${
                  pathname?.startsWith("/recipes")
                    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                    : "border-slate-200 bg-white/80 text-slate-600"
                }`}
                href="/recipes"
              >
                Recipes
              </Link>
              <Link
                className={`rounded-full border px-2.5 py-1 text-[11px] shadow-sm hover:text-slate-900 ${
                  pathname?.startsWith("/shopping")
                    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                    : "border-slate-200 bg-white/80 text-slate-600"
                }`}
                href="/shopping"
              >
                Shopping
              </Link>
              <Link
                className={`rounded-full border px-2.5 py-1 text-[11px] shadow-sm hover:text-slate-900 ${
                  pathname?.startsWith("/settings")
                    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                    : "border-slate-200 bg-white/80 text-slate-600"
                }`}
                href="/settings"
              >
                Settings
              </Link>
              <button
                className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] shadow-sm hover:text-slate-900"
                onClick={async () => {
                  try {
                    const supabase = getSupabaseBrowser();
                    await supabase.auth.signOut();
                    window.location.href = "/login";
                  } catch {
                    window.location.href = "/login";
                  }
                }}
              >
                Sign out
              </button>
            </div>
            <form
              className="w-full"
              onSubmit={(event) => {
                event.preventDefault();
                if (!searchQuery.trim()) return;
                setSearchOpen(true);
              }}
            >
              <div className="ml-auto flex w-full max-w-sm items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-xs text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Search recipes (local + YouTube)"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm hover:text-slate-700"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Open last search"
                  title="Open last search"
                >
                  <History className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <RecipeSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onUseCandidate={handleUseCandidate}
        initialQuery={searchQuery}
      />
      <ManualRecipeModal
        open={manualOpen}
        onClose={() => {
          setManualOpen(false);
          setManualFromSearch(false);
          setManualLoading(false);
          setManualError("");
          setManualNotice("");
          setManualSourceUrl(null);
          setManualThumbnailUrl(null);
          setManualLoadingModel(null);
        }}
        onCreated={handleManualCreated}
        prefill={manualPrefill}
        backLabel="Back to search results"
        onBack={
          manualFromSearch
            ? () => {
                setManualOpen(false);
                setManualFromSearch(false);
                setSearchOpen(true);
              }
            : undefined
        }
        loading={manualLoading}
        loadingLabel="Auto-filling from YouTube with"
        loadingModel={manualLoadingModel ?? undefined}
        errorMessage={manualError}
        noticeMessage={manualNotice}
        onRetryPrefill={
          manualSourceUrl
            ? () => {
                void runPrefill(manualSourceUrl, manualThumbnailUrl, true);
              }
            : undefined
        }
        retryLabel="Retry auto-fill"
      />
    </header>
  );
}

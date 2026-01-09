"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { History, Search } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { getSupabaseBrowser } from "@/lib/supabase";
import RecipeSearchAddModals from "./RecipeSearchAddModals";
import { useSWRConfig } from "swr";
import { registerOptimisticRecipe } from "@/lib/optimistic";
import { useSearchAddRecipeFlow } from "@/lib/useSearchAddRecipeFlow";

export default function Header() {
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const searchFlow = useSearchAddRecipeFlow(() => setManualOpen(true));
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
    searchFlow.reset();
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
                if (!searchFlow.query.trim()) return;
                searchFlow.openSearch();
              }}
            >
              <div className="ml-auto flex w-full max-w-sm items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-xs text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Search recipes (local + YouTube)"
                    value={searchFlow.query}
                    onChange={(event) => searchFlow.setQuery(event.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm hover:text-slate-700"
                  onClick={() => searchFlow.openSearch()}
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
      <RecipeSearchAddModals
        manualOpen={manualOpen}
        onManualClose={() => setManualOpen(false)}
        onManualCreated={handleManualCreated}
        searchFlow={searchFlow}
        searchInitialQuery={searchFlow.query}
      />
    </header>
  );
}

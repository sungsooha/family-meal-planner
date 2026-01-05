"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { getSupabaseBrowser } from "@/lib/supabase";

export default function Header() {
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pb-6 pt-10">
        <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ha Family Table</h1>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Weekly Meal Planner</p>
        <p className="mt-1 text-xs text-rose-500">Made for the Ha family</p>
        </div>
        <div className="relative hidden flex-[1.2] md:block">
          <img
            src="/ha_family_logo.png"
            alt="Ha family illustration"
            className="absolute -left-7 top-[60%] h-52 w-auto -translate-y-1/2"
          />
        </div>
      <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
        <select
          className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm shadow-sm"
          value={language}
          onChange={(event) => setLanguage(event.target.value as "en" | "original")}
        >
          <option value="en">English</option>
          <option value="original">Original</option>
        </select>
        <Link
          className={`rounded-full border px-4 py-2 shadow-sm hover:text-slate-900 ${
            pathname === "/"
              ? "border-emerald-200 bg-emerald-100 text-emerald-900"
              : "border-slate-200 bg-white/80 text-slate-600"
          }`}
          href="/"
        >
          Weekly Plan
        </Link>
        <Link
          className={`rounded-full border px-4 py-2 shadow-sm hover:text-slate-900 ${
            pathname?.startsWith("/recipes")
              ? "border-emerald-200 bg-emerald-100 text-emerald-900"
              : "border-slate-200 bg-white/80 text-slate-600"
          }`}
          href="/recipes"
        >
          Recipes
        </Link>
        <Link
          className={`rounded-full border px-4 py-2 shadow-sm hover:text-slate-900 ${
            pathname?.startsWith("/shopping")
              ? "border-emerald-200 bg-emerald-100 text-emerald-900"
              : "border-slate-200 bg-white/80 text-slate-600"
          }`}
          href="/shopping"
        >
          Shopping
        </Link>
        <button
          className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm hover:text-slate-900"
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
      </div>
    </header>
  );
}

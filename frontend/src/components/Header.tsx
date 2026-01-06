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
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-6 pb-2 pt-2 md:flex-row md:items-center">
        <div className="flex items-center">
          <img
            src="/ha_family_logo.png"
            alt="Ha family illustration"
            className="h-24 w-auto sm:h-28 md:h-32 lg:h-36"
          />
        </div>
      <div className="flex w-full flex-wrap items-center gap-2 text-xs font-medium text-slate-600 md:w-auto">
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
      </div>
    </header>
  );
}

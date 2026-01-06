import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ToastProvider } from "@/components/ToastProvider";
import SWRProvider from "@/components/SWRProvider";

export const metadata: Metadata = {
  title: "Family Meal Planner",
  description: "Weekly recipes, shopping list, and meal planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f9f4ec] text-slate-900 antialiased">
        <SWRProvider>
          <LanguageProvider>
            <ToastProvider>
              <div className="relative min-h-screen">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
                </div>
                <Header />
                <main className="relative mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
                <footer className="relative mx-auto w-full max-w-6xl px-6 pb-8 text-xs text-slate-500">
                  <p>Made for the Ha family</p>
                  <p>Copyright (c) 2026 Ha Family</p>
                </footer>
              </div>
            </ToastProvider>
          </LanguageProvider>
        </SWRProvider>
      </body>
    </html>
  );
}

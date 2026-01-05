"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseBrowser();
      const url = new URL(window.location.href);
      const nextParam = url.searchParams.get("next") ?? "/";
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      let errorMessage: string | null = null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) errorMessage = error.message;
      } else if (hashParams.get("access_token")) {
        const accessToken = hashParams.get("access_token") ?? "";
        const refreshToken = hashParams.get("refresh_token") ?? "";
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) errorMessage = error.message;
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setStatus("Sign-in failed.");
          window.location.href = "/login?error=missing_session";
          return;
        }
      }

      if (errorMessage) {
        setStatus("Sign-in failed.");
        window.location.href = `/login?error=${encodeURIComponent(errorMessage)}`;
        return;
      }

      window.location.href = nextParam;
    };

    handleCallback();
  }, []);

  return (
    <div className="mx-auto mt-20 max-w-md rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">
      {status}
    </div>
  );
}

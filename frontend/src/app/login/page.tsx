"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [nextParam, setNextParam] = useState<string | null>(null);
  const [errorParam, setErrorParam] = useState<string | null>(null);
  const [mode, setMode] = useState<"magic" | "password" | "signup" | "reset">("password");
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    setNextParam(url.searchParams.get("next"));
    setErrorParam(url.searchParams.get("error"));
    const modeParam = url.searchParams.get("mode");
    if (modeParam === "reset") {
      setMode("reset");
    }
    if (modeParam === "reset") {
      const supabase = getSupabaseBrowser();
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (data.session) {
            setHasRecoverySession(true);
          }
        })
        .catch(() => setStatus("Unable to validate reset session."));
    }
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const typeParam = hashParams.get("type");
    if (accessToken && refreshToken) {
      const supabase = getSupabaseBrowser();
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setStatus(error.message);
            return;
          }
          if (typeParam === "recovery") {
            setMode("reset");
            setHasRecoverySession(true);
          }
          window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        })
        .catch(() => setStatus("Unable to complete sign-in."));
    }
  }, []);

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message);
        return;
      }
      window.location.href = nextParam || "/";
    } catch {
      setStatus("Failed to sign in.");
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const redirectTarget = nextParam ? `/auth/callback?next=${encodeURIComponent(nextParam)}` : "/auth/callback";
    const response = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        redirectTo: `${window.location.origin}${redirectTarget}`,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "Failed to send magic link.");
      return;
    }
    setStatus("Check your email for the sign-in link.");
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const response = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "Failed to create account.");
      return;
    }
    setStatus("Account created. You can now sign in.");
    setMode("password");
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    try {
      const supabase = getSupabaseBrowser();
      const redirectTo = `${window.location.origin}/login?mode=reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus("Check your email for the password reset link.");
    } catch {
      setStatus("Failed to request password reset.");
    }
  };

  const handleSetNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus("Reset link missing or expired. Request a new reset link.");
        setHasRecoverySession(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus("Password updated. You can now sign in.");
      setMode("password");
      setNewPassword("");
      setHasRecoverySession(false);
    } catch {
      setStatus("Failed to update password.");
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
      <p className="mt-2 text-sm text-slate-600">
        {mode === "magic"
          ? "Enter your email to receive a magic link."
          : mode === "password"
            ? "Use your email and password to sign in."
            : mode === "signup"
              ? "Create a password to enable email sign-in."
              : hasRecoverySession
                ? "Set a new password to complete the reset."
                : "Send a reset link to set or change your password."}
      </p>
      <div className="mt-4 inline-flex flex-wrap rounded-full border border-slate-200 bg-white text-[11px] font-medium text-slate-600 shadow-sm">
        <button
          className={`rounded-full px-3 py-1 ${mode === "magic" ? "bg-emerald-100 text-emerald-900" : ""}`}
          onClick={() => setMode("magic")}
        >
          Magic link
        </button>
        <button
          className={`rounded-full px-3 py-1 ${mode === "password" ? "bg-emerald-100 text-emerald-900" : ""}`}
          onClick={() => setMode("password")}
        >
          Email + password
        </button>
        <button
          className={`rounded-full px-3 py-1 ${mode === "signup" ? "bg-emerald-100 text-emerald-900" : ""}`}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
        <button
          className={`rounded-full px-3 py-1 ${mode === "reset" ? "bg-emerald-100 text-emerald-900" : ""}`}
          onClick={() => setMode("reset")}
        >
          Reset password
        </button>
      </div>
      {errorParam ? (
        <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errorParam === "unauthorized" ? "This email is not allowed." : errorParam}
        </p>
      ) : null}
      {mode === "magic" ? (
        <form className="mt-4 space-y-3" onSubmit={handleLogin}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600">
            Send magic link
          </button>
        </form>
      ) : mode === "password" ? (
        <form className="mt-4 space-y-3" onSubmit={handlePasswordLogin}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600">
            Sign in
          </button>
        </form>
      ) : mode === "signup" ? (
        <form className="mt-4 space-y-3" onSubmit={handleSignup}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600">
            Create account
          </button>
        </form>
      ) : hasRecoverySession ? (
        <form className="mt-4 space-y-3" onSubmit={handleSetNewPassword}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <button className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600">
            Set new password
          </button>
        </form>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={handlePasswordReset}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600">
            Send reset link
          </button>
        </form>
      )}
      {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
    </div>
  );
}

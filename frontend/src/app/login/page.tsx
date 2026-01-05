"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const errorParam = searchParams.get("error");

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

  return (
    <div className="mx-auto mt-20 max-w-md rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
      <p className="mt-2 text-sm text-slate-600">Enter your email to receive a magic link.</p>
      {errorParam ? (
        <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errorParam === "unauthorized" ? "This email is not allowed." : errorParam}
        </p>
      ) : null}
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
      {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
    </div>
  );
}

import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin credentials are not configured.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

export function getSupabaseBrowser() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase browser credentials are not configured.");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function getSupabaseServer(cookies: {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options: { path?: string; maxAge?: number }) => void;
  remove: (name: string, options: { path?: string }) => void;
}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase server credentials are not configured.");
  }
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies });
}

export function isEmailAllowed(email?: string | null): boolean {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return true;
  return Boolean(email && allowed.includes(email.toLowerCase()));
}

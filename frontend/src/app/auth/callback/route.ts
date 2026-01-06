import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const reset =
    url.searchParams.get("reset") === "1" ||
    url.searchParams.get("type") === "recovery" ||
    url.searchParams.get("mode") === "reset";
  const next = url.searchParams.get("next") ?? "/";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.redirect(new URL("/login?error=missing_supabase", request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({
          name,
          value,
          path: options.path ?? "/",
          maxAge: options.maxAge,
        });
      },
      remove(name, options) {
        response.cookies.set({
          name,
          value: "",
          path: options.path ?? "/",
          maxAge: 0,
        });
      },
    },
  });

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  if (reset) {
    return NextResponse.redirect(new URL("/login?mode=reset", request.url));
  }

  return response;
}

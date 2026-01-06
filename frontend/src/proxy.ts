import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isEmailAllowed } from "@/lib/supabase";
import { AUTH_CACHE_TTL_MS } from "@/lib/serverCacheConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const AUTH_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const authCache = new Map<string, { allowed: boolean; expiresAt: number }>();

const getAuthCookieKey = (request: NextRequest) => {
  const authCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.includes("sb-") && cookie.name.endsWith("-auth-token"));
  return authCookie?.value ?? "anon";
};

const getCachedAuth = (key: string) => {
  const cached = authCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    authCache.delete(key);
    return null;
  }
  return cached.allowed;
};

const setCachedAuth = (key: string, allowed: boolean) => {
  if (authCache.size > 500) authCache.clear();
  authCache.set(key, { allowed, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
};

export async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/plan") ||
    pathname.startsWith("/api/recipes") ||
    pathname.startsWith("/api/shopping") ||
    pathname.startsWith("/api/buy-lists") ||
    pathname.startsWith("/api/config") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/ha_family_logo.png") ||
    pathname.startsWith("/icon.png") ||
    pathname.startsWith("/together_at_the_table_favicon.png") ||
    pathname.startsWith("/together_at_the_table_full.png")
  ) {
    return NextResponse.next();
  }

  if (!AUTH_ENABLED) {
    return NextResponse.next();
  }

  const cacheKey = getAuthCookieKey(request);
  const cachedAllowed = getCachedAuth(cacheKey);
  if (cachedAllowed !== null) {
    if (!cachedAllowed) {
      const redirect = new URL("/login", request.url);
      redirect.searchParams.set("next", pathname);
      return NextResponse.redirect(redirect);
    }
    return NextResponse.next();
  }

  const response = NextResponse.next();
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

  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  const allowed = Boolean(email && isEmailAllowed(email));
  setCachedAuth(cacheKey, allowed);
  if (!allowed) {
    const redirect = new URL("/login", request.url);
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|ha_family_logo.png|icon.png|together_at_the_table_favicon.png|together_at_the_table_full.png).*)",
  ],
};

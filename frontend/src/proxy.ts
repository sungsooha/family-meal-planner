import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isEmailAllowed } from "@/lib/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const AUTH_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
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
  if (!email || !isEmailAllowed(email)) {
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

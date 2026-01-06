import { NextResponse } from "next/server";

export const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export function jsonWithCache(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...CACHE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

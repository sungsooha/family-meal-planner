import { NextResponse } from "next/server";
import { getDailyRecommendations } from "@/lib/data";
import type { DailyRecommendationsResponse } from "@/lib/types";

export async function GET() {
  const store = await getDailyRecommendations();
  const runs = [...(store.runs ?? [])].sort((a, b) => {
    const left = a.created_at ?? "";
    const right = b.created_at ?? "";
    return right.localeCompare(left);
  });
  return NextResponse.json<DailyRecommendationsResponse>({ runs });
}

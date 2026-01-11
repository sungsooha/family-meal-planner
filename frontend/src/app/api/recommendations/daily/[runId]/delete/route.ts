import { NextResponse } from "next/server";
import { getDailyRecommendations, saveDailyRecommendations } from "@/lib/data";
import type { DailyRecommendationDeleteResponse } from "@/lib/types";

type Params = { params: Promise<{ runId: string }> };

export async function POST(_: Request, { params }: Params) {
  const { runId } = await params;
  const store = await getDailyRecommendations();
  const before = store.runs.length;
  store.runs = store.runs.filter((entry) => entry.id !== runId);
  if (store.runs.length === before) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  await saveDailyRecommendations(store);
  return NextResponse.json<DailyRecommendationDeleteResponse>({ ok: true, runs: store.runs });
}

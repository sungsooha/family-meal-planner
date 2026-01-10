import { NextResponse } from "next/server";
import { getDailyRecommendations, saveDailyRecommendations } from "@/lib/data";

type Params = { params: Promise<{ runId: string }> };

export async function POST(request: Request, { params }: Params) {
  const debugEnabled = process.env.RECO_DEBUG === "1";
  const { runId } = await params;
  const payload = await request.json().catch(() => ({}));
  const candidateId = String(payload?.candidate_id ?? "");
  if (!candidateId) {
    return NextResponse.json({ error: "Missing candidate_id." }, { status: 400 });
  }
  if (debugEnabled) {
    console.log("[daily-reco] discard", { runId, candidateId });
  }

  const store = await getDailyRecommendations();
  const run = store.runs.find((entry) => entry.id === runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  const beforeCount = run.candidates.length;
  run.candidates = run.candidates.filter((entry) => entry.id !== candidateId);
  if (run.candidates.length === beforeCount) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }
  await saveDailyRecommendations(store);

  return NextResponse.json({ ok: true, run });
}

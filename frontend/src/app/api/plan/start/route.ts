import { NextResponse } from "next/server";
import { getWeeklyPlanForDate } from "@/lib/data";
import type { PlanActionPayload, WeeklyPlan } from "@/lib/types";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const { start_date: startDate } = payload as PlanActionPayload;
  if (!startDate) {
    return NextResponse.json({ error: "Missing start_date." }, { status: 400 });
  }
  const plan = await getWeeklyPlanForDate(startDate);
  return NextResponse.json<WeeklyPlan>(plan);
}

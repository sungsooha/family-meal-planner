import { NextResponse } from "next/server";
import { getWeeklyPlanForDate } from "@/lib/data";
import { lockAll } from "@/lib/plan";
import type { PlanActionPayload, WeeklyPlan } from "@/lib/types";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const { locked, start_date: startDate } = payload as PlanActionPayload;
  if (typeof locked !== "boolean") {
    return NextResponse.json({ error: "Missing locked flag." }, { status: 400 });
  }
  const plan = await getWeeklyPlanForDate(startDate ?? new Date().toISOString().split("T")[0]);
  const updated = await lockAll(plan, locked);
  return NextResponse.json<WeeklyPlan>(updated);
}

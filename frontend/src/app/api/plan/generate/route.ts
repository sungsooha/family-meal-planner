import { NextResponse } from "next/server";
import { getWeeklyPlanForDate } from "@/lib/data";
import { autoGeneratePlan, initializePlan } from "@/lib/plan";
import type { PlanActionPayload, WeeklyPlan } from "@/lib/types";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const { start_date: startDate } = payload as PlanActionPayload;
  const initialDate = startDate ?? new Date().toISOString().split("T")[0];
  let plan = await getWeeklyPlanForDate(initialDate);
  if (!plan) plan = initializePlan(initialDate);
  const updated = await autoGeneratePlan(plan, startDate);
  return NextResponse.json<WeeklyPlan>(updated);
}

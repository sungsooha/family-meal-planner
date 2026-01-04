import { NextResponse } from "next/server";
import { getWeeklyPlanForDate } from "@/lib/data";
import { toggleLock } from "@/lib/plan";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const { date, meal, start_date: startDate } = payload as {
    date?: string;
    meal?: string;
    start_date?: string;
  };
  if (!date || !meal) {
    return NextResponse.json({ error: "Missing payload fields." }, { status: 400 });
  }
  const plan = await getWeeklyPlanForDate(startDate ?? date);
  const updated = await toggleLock(plan, date, meal);
  return NextResponse.json(updated);
}

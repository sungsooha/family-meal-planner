import { NextResponse } from "next/server";
import { getWeeklyPlanForDate, toIsoDate } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date") ?? toIsoDate(new Date());
  const plan = await getWeeklyPlanForDate(startDate);
  return NextResponse.json(plan);
}

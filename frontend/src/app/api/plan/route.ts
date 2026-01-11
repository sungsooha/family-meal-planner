import { getWeeklyPlanForDate, toIsoDate } from "@/lib/data";
import { jsonWithCache } from "@/lib/cache";
import type { WeeklyPlan } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date") ?? toIsoDate(new Date());
  const plan = await getWeeklyPlanForDate(startDate);
  return jsonWithCache(plan);
}

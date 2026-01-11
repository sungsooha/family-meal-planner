import { listDailyPlans } from "@/lib/data";
import { jsonWithCache } from "@/lib/cache";
import type { PlanDatesResponse } from "@/lib/types";

export async function GET() {
  const plans = await listDailyPlans();
  const dates = plans.map((plan) => plan.date).sort();
  return jsonWithCache({ dates });
}

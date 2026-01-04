import { NextResponse } from "next/server";
import { listDailyPlans } from "@/lib/data";

export async function GET() {
  const plans = await listDailyPlans();
  const dates = plans.map((plan) => plan.date).sort();
  return NextResponse.json({ dates });
}

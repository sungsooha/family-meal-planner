import { NextResponse } from "next/server";
import { updateRecipeFeedback } from "@/lib/data";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const feedback = (payload as { family_feedback?: Record<string, number> }).family_feedback ?? null;
  if (!feedback) {
    return NextResponse.json({ error: "Missing family_feedback." }, { status: 400 });
  }
  const recipe = await updateRecipeFeedback(id, feedback);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  }
  return NextResponse.json({ recipe });
}

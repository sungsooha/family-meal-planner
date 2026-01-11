import { NextResponse } from "next/server";
import { updateRecipeFeedback } from "@/lib/data";
import type { RecipeFeedbackRequest, RecipeFeedbackResponse } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as RecipeFeedbackRequest | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json<RecipeFeedbackResponse>({ error: "Invalid payload." }, { status: 400 });
  }
  const feedback = payload.family_feedback ?? null;
  if (!feedback) {
    return NextResponse.json<RecipeFeedbackResponse>({ error: "Missing family_feedback." }, { status: 400 });
  }
  const recipe = await updateRecipeFeedback(id, feedback);
  if (!recipe) {
    return NextResponse.json<RecipeFeedbackResponse>({ error: "Recipe not found." }, { status: 404 });
  }
  return NextResponse.json<RecipeFeedbackResponse>({ recipe });
}

import { NextResponse } from "next/server";
import { BuyList, saveBuyList, listBuyLists } from "@/lib/data";

export async function GET() {
  const lists = await listBuyLists();
  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const list = payload as BuyList;
  if (!list.id || !list.week_start || !list.week_end) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  await saveBuyList(list);
  return NextResponse.json({ ok: true });
}

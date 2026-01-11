import { NextResponse } from "next/server";
import { saveBuyList, listBuyLists } from "@/lib/data";
import type { BuyList, BuyListUpdateRequest, BuyListUpdateResponse, BuyListsResponse } from "@/lib/types";
import { jsonWithCache } from "@/lib/cache";

export async function GET() {
  const lists = await listBuyLists();
  return jsonWithCache({ lists });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as BuyListUpdateRequest | null;
  if (!payload) {
    return NextResponse.json<BuyListUpdateResponse>({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const list = payload as BuyList;
  if (!list.id || !list.week_start || !list.week_end) {
    return NextResponse.json<BuyListUpdateResponse>({ ok: false, error: "Missing required fields." }, { status: 400 });
  }
  await saveBuyList(list);
  return NextResponse.json<BuyListUpdateResponse>({ ok: true });
}

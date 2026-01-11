import { NextResponse } from "next/server";
import { deleteBuyList, getBuyListById, saveBuyList } from "@/lib/data";
import { jsonWithCache } from "@/lib/cache";
import type { BuyListResponse, BuyListUpdateRequest, BuyListUpdateResponse } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const list = await getBuyListById(id);
  if (!list) {
    return NextResponse.json<BuyListResponse>({ error: "Not found." }, { status: 404 });
  }
  return jsonWithCache({ list });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as BuyListUpdateRequest | null;
  if (!payload) {
    return NextResponse.json<BuyListUpdateResponse>({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  await saveBuyList({ ...payload, id });
  return NextResponse.json<BuyListUpdateResponse>({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const success = await deleteBuyList(id);
  if (!success) {
    return NextResponse.json<BuyListUpdateResponse>({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json<BuyListUpdateResponse>({ ok: true });
}

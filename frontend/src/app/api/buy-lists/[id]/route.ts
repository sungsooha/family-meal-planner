import { NextResponse } from "next/server";
import { deleteBuyList, getBuyListById, saveBuyList } from "@/lib/data";
import { jsonWithCache } from "@/lib/cache";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const list = await getBuyListById(id);
  if (!list) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return jsonWithCache(list);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  payload.id = id;
  await saveBuyList(payload);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const success = await deleteBuyList(id);
  if (!success) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

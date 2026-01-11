import { NextResponse } from "next/server";
import { getBuyListById, getShoppingState, getWeeklyPlanForDate, saveBuyList } from "@/lib/data";
import type { BuyListItem, BuyListUpdateResponse } from "@/lib/types";
import { computeShoppingList, itemKey } from "@/lib/shopping";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;
  const list = await getBuyListById(id);
  if (!list) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (list.status === "locked") {
    return NextResponse.json({ error: "List is locked." }, { status: 400 });
  }
  const plan = await getWeeklyPlanForDate(list.week_start);
  const weeklyItems = await computeShoppingList(plan, list.lang);
  const state = await getShoppingState();
  const weeklyByKey = new Map(weeklyItems.map((item) => [item.key, item]));
  weeklyItems.forEach((item) => {
    if (item.key.startsWith(`${list.lang}|`)) {
      const legacyKey = itemKey(item.name, item.unit);
      if (!weeklyByKey.has(legacyKey)) {
        weeklyByKey.set(legacyKey, item);
      }
    }
  });
  const selectedItems: BuyListItem[] = [];
  Object.entries(state).forEach(([key, stored]) => {
    const weekly = weeklyByKey.get(key);
    if (weekly) {
      selectedItems.push({
        name: stored.name ?? weekly.name,
        unit: stored.unit ?? weekly.unit,
        quantity: stored.quantity ?? weekly.quantity,
        key,
      });
    } else if (stored.manual) {
      selectedItems.push({
        name: stored.name ?? "",
        unit: stored.unit ?? "",
        quantity: stored.quantity ?? "",
        key,
      });
    }
  });
  list.items = selectedItems;
  list.saved_at = new Date().toISOString();
  await saveBuyList(list);
  return NextResponse.json<BuyListUpdateResponse>({ ok: true });
}

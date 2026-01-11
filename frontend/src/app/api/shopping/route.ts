import { NextResponse } from "next/server";
import { getWeeklyPlanForDate, getShoppingState, saveShoppingState } from "@/lib/data";
import { computeShoppingList, itemKey, syncShoppingState } from "@/lib/shopping";
import { jsonWithCache } from "@/lib/cache";
import type { ShoppingActionRequest, ShoppingItemWithDefaults, ShoppingPayload } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") ?? "en";
  const startDate = searchParams.get("start_date") ?? new Date().toISOString().split("T")[0];
  const plan = await getWeeklyPlanForDate(startDate);
  const weeklyItems = await computeShoppingList(plan, lang);
  const state = await syncShoppingState(weeklyItems, lang);

  const weeklyByKey = new Map(weeklyItems.map((item) => [item.key, item]));
  weeklyItems.forEach((item) => {
    if (item.key.startsWith(`${lang}|`)) {
      const legacyKey = itemKey(item.name, item.unit);
      if (!weeklyByKey.has(legacyKey)) {
        weeklyByKey.set(legacyKey, item);
      }
    }
  });

  const shoppingItems: ShoppingItemWithDefaults[] = [];
  Object.entries(state).forEach(([key, stored]) => {
    const weekly = weeklyByKey.get(key);
    if (weekly) {
      shoppingItems.push({
        ...weekly,
        name: stored.name ?? weekly.name,
        unit: stored.unit ?? weekly.unit,
        quantity: stored.quantity ?? weekly.quantity,
        key,
        default_quantity: weekly.quantity,
        default_unit: weekly.unit,
      });
    } else if (stored.manual) {
      shoppingItems.push({
        name: stored.name ?? "",
        unit: stored.unit ?? "",
        quantity: stored.quantity ?? "",
        recipes_count: 0,
        recipe_ids: [],
        key,
        default_quantity: "",
        default_unit: "",
      });
    }
  });

  const weeklyList = weeklyItems.filter((item) => !(item.key in state));

  return jsonWithCache({ weekly_list: weeklyList, shopping_items: shoppingItems, lang });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as ShoppingActionRequest | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const { action, lang = "en" } = payload;
  const state = await getShoppingState();

  if (action === "add") {
    const { key, name, unit, quantity } = payload;
    if (!key || !name) {
      return NextResponse.json({ error: "Missing item fields." }, { status: 400 });
    }
    state[key] = { name, unit: unit ?? "", quantity: quantity ?? "", manual: false, lang };
  } else if (action === "remove") {
    const { key } = payload;
    if (key) delete state[key];
  } else if (action === "update") {
    const { key, quantity } = payload;
    if (key && state[key]) {
      state[key].quantity = quantity ?? state[key].quantity;
    }
  } else if (action === "add-manual") {
    const { name, unit, quantity } = payload;
    if (!name) {
      return NextResponse.json({ error: "Missing item name." }, { status: 400 });
    }
    const key = `manual:${crypto.randomUUID().replace(/-/g, "")}`;
    state[key] = { name, unit: unit ?? "", quantity: quantity ?? "", manual: true, lang };
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  await saveShoppingState(state);
  return NextResponse.json({ ok: true });
}

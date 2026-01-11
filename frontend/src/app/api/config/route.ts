import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/data";
import type { AppConfig, ConfigResponse, ConfigUpdateRequest } from "@/lib/types";

export async function GET() {
  const config = await getConfig();
  return NextResponse.json<ConfigResponse>({ config });
}

export async function PUT(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as ConfigUpdateRequest;
  if (!payload.config) {
    return NextResponse.json({ error: "Missing config payload." }, { status: 400 });
  }
  await saveConfig(payload.config);
  const updated = await getConfig();
  return NextResponse.json<ConfigResponse>({ config: updated });
}

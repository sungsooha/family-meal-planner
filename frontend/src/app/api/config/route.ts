import { NextResponse } from "next/server";
import { getConfig, saveConfig, AppConfig } from "@/lib/data";

export async function GET() {
  const config = await getConfig();
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { config?: AppConfig };
  if (!payload.config) {
    return NextResponse.json({ error: "Missing config payload." }, { status: 400 });
  }
  await saveConfig(payload.config);
  const updated = await getConfig();
  return NextResponse.json({ config: updated });
}

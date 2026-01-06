import { NextResponse } from "next/server";
import { getSupabaseAdmin, isEmailAllowed } from "@/lib/supabase";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = payload.email?.trim() ?? "";
  const password = payload.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json({ error: "This email is not allowed." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ user_id: data.user?.id ?? null });
  } catch {
    return NextResponse.json({ error: "Unable to create user." }, { status: 500 });
  }
}

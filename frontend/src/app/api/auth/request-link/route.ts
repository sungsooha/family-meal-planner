import { NextResponse } from "next/server";
import { isEmailAllowed, getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const email = payload?.email?.toString().trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    return NextResponse.json({ error: "This email is not allowed." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: payload?.redirectTo || undefined,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

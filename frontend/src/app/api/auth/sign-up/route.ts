import { NextResponse } from "next/server";
import { getSupabaseAdmin, isEmailAllowed } from "@/lib/supabase";
import type { AuthSignUpRequest, AuthSignUpResponse } from "@/lib/types";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as AuthSignUpRequest;
  const email = payload.email?.trim() ?? "";
  const password = payload.password ?? "";
  if (!email || !password) {
    return NextResponse.json<AuthSignUpResponse>({ error: "Email and password are required." }, { status: 400 });
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json<AuthSignUpResponse>({ error: "This email is not allowed." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json<AuthSignUpResponse>({ error: error.message }, { status: 400 });
    }
    return NextResponse.json<AuthSignUpResponse>({ user_id: data.user?.id ?? null });
  } catch {
    return NextResponse.json<AuthSignUpResponse>({ error: "Unable to create user." }, { status: 500 });
  }
}

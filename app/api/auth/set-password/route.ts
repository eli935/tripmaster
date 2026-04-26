import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/auth/set-password
 *
 * Lets a logged-in user set or update their password. After this,
 * the email/password login flow on /login works for them.
 *
 * Body: { password: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = (body.password ?? "").trim();
  if (password.length < 8) {
    return NextResponse.json(
      { error: "סיסמה חייבת להיות לפחות 8 תווים" },
      { status: 400 }
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

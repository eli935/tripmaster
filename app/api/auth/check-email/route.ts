import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/check-email
 * Body: { email: string }
 * Returns: { registered: boolean }
 *
 * "Registered" means either:
 *   - The email is in trip_invitations (someone invited them), OR
 *   - The email has an auth.users row (they previously logged in / signed up)
 *
 * Used by the login page to gate the OTP send: if not registered, we redirect
 * to the landing page with the email pre-filled in the lead form, instead of
 * sending a magic link that would land them on an empty dashboard.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // If service role is missing, fail-open (let login proceed) rather than
    // block users entirely.
    return NextResponse.json({ registered: true, reason: "no-service-key" });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // RPC checks both auth.users and trip_invitations in one DB call (security
  // definer function on the migration). Replaces the previous listUsers admin
  // call which was returning "Database error finding users" on this project.
  const { data, error } = await admin.rpc("is_email_registered", {
    check_email: email,
  });
  if (error) {
    // Fail-open: if the check itself fails, let the user try to log in rather
    // than block them at the gate. Worst case they hit the password screen
    // and get an "invalid credentials" error.
    return NextResponse.json({
      registered: true,
      reason: `rpc-error: ${error.message}`,
    });
  }
  return NextResponse.json({ registered: !!data });
}

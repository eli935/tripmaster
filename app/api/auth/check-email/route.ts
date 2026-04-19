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

  // 1) Check trip_invitations
  const { data: inviteRow } = await admin
    .from("trip_invitations")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (inviteRow) {
    return NextResponse.json({ registered: true, source: "invitation" });
  }

  // 2) Check auth.users via admin API (paginated, match by email).
  //    TripMaster scale is small — page 1 usually suffices; if we ever
  //    exceed a few hundred users we'll switch to an RPC or indexed query.
  try {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (!error) {
      const hit = data.users.some((u) => (u.email ?? "").toLowerCase() === email);
      if (hit) return NextResponse.json({ registered: true, source: "auth" });
    }
  } catch {
    // fail-open
  }

  return NextResponse.json({ registered: false });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { trip_id, email, message } = body as {
      trip_id?: string;
      email?: string;
      message?: string;
    };

    if (!trip_id || !email) {
      return NextResponse.json(
        { error: "missing_fields", fields: ["trip_id", "email"] },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { error: "invalid_email" },
        { status: 400 }
      );
    }

    // Fetch trip — RLS ensures only admins of this trip see it
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, name, destination")
      .eq("id", trip_id)
      .single();
    if (tripErr || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    // Fetch inviter name
    const { data: inviter } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Check for an existing pending invitation — if exists, refresh token + resend
    const { data: existing } = await supabase
      .from("trip_invitations")
      .select("id, token")
      .eq("trip_id", trip_id)
      .eq("email", cleanEmail)
      .eq("status", "pending")
      .maybeSingle();

    let token: string;
    let invitationId: string;

    if (existing) {
      token = existing.token;
      invitationId = existing.id;
    } else {
      const { data: created, error: insErr } = await supabase
        .from("trip_invitations")
        .insert({
          trip_id,
          email: cleanEmail,
          invited_by: user.id,
          message: message?.trim() || null,
        })
        .select("id, token")
        .single();

      if (insErr || !created) {
        return NextResponse.json(
          { error: "insert_failed", details: insErr?.message },
          { status: 500 }
        );
      }
      token = created.token;
      invitationId = created.id;
    }

    const origin =
      req.headers.get("origin") ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const acceptUrl = `${origin}/invite/accept/${token}`;

    const mail = await sendInvitationEmail({
      to: cleanEmail,
      tripName: trip.name,
      destination: trip.destination,
      inviterName: inviter?.full_name || "מנהל הטיול",
      acceptUrl,
      message,
    });

    return NextResponse.json({
      ok: true,
      invitation_id: invitationId,
      accept_url: acceptUrl,
      email_sent: mail.ok,
      email_skipped: "skipped" in mail ? mail.skipped : false,
      email_reason: "reason" in mail ? mail.reason : undefined,
      email_error: "error" in mail ? mail.error : undefined,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "server_error", details: e?.message },
      { status: 500 }
    );
  }
}

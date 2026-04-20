import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/admin/update-participant
 * Body: { trip_id, profile_id, full_name?, phone?, adults?, children? }
 *
 * Trip admin only: updates another participant's profile row AND their
 * trip_participants row (for headcount). Uses service role because the
 * profiles RLS policy restricts UPDATE to the owner — admins managing
 * concierge clients need to override that, but only for participants
 * of their own trip.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    trip_id?: string;
    profile_id?: string;
    full_name?: string;
    phone?: string;
    adults?: number;
    children?: number;
  };
  const { trip_id, profile_id } = body;
  if (!trip_id || !profile_id) {
    return NextResponse.json({ error: "trip_id + profile_id required" }, { status: 400 });
  }

  // Verify caller is the trip admin (i.e., the trip creator).
  const { data: trip } = await supabase
    .from("trips")
    .select("created_by")
    .eq("id", trip_id)
    .single();
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });
  if (trip.created_by !== user.id) {
    return NextResponse.json({ error: "only the trip admin can edit participants" }, { status: 403 });
  }

  // Verify target is actually a participant of this trip.
  const { data: participant } = await supabase
    .from("trip_participants")
    .select("id")
    .eq("trip_id", trip_id)
    .eq("profile_id", profile_id)
    .maybeSingle();
  if (!participant) {
    return NextResponse.json(
      { error: "target is not a participant of this trip" },
      { status: 400 }
    );
  }

  // Admin client — bypasses RLS.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "service role missing" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ── Profile update (name + phone) ──
  const profilePatch: Record<string, unknown> = {};
  if (typeof body.full_name === "string" && body.full_name.trim()) {
    profilePatch.full_name = body.full_name.trim();
  }
  if (typeof body.phone === "string") {
    const cleanPhone = body.phone.trim().replace(/[^\d+]/g, "");
    if (cleanPhone.length < 9) {
      return NextResponse.json({ error: "phone must have at least 9 digits" }, { status: 400 });
    }
    profilePatch.phone = cleanPhone;
  }
  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin.from("profiles").update(profilePatch).eq("id", profile_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Trip participant headcount ──
  const partPatch: Record<string, unknown> = {};
  if (typeof body.adults === "number" && body.adults >= 0) partPatch.adults = Math.floor(body.adults);
  if (typeof body.children === "number" && body.children >= 0)
    partPatch.children = Math.floor(body.children);
  if (Object.keys(partPatch).length > 0) {
    const { error } = await admin
      .from("trip_participants")
      .update(partPatch)
      .eq("trip_id", trip_id)
      .eq("profile_id", profile_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

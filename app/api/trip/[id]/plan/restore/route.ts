import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/trip/[id]/plan/restore
 * Body: { snapshot_id: string }
 *
 * Restores a previous plan snapshot by overwriting each trip_day's
 * generated_plan JSONB with the saved payload. Does NOT touch `bookings`
 * (the user's committed items remain untouched).
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await ctx.params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { snapshot_id?: string };
  if (!body.snapshot_id) {
    return NextResponse.json({ error: "snapshot_id required" }, { status: 400 });
  }

  const { data: snap } = await supabase
    .from("plan_snapshots")
    .select("*")
    .eq("id", body.snapshot_id)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!snap) return NextResponse.json({ error: "snapshot not found" }, { status: 404 });

  const daysPayload = (snap.days_payload as Array<{ day_id: string; items: unknown[] }>) ?? [];

  await Promise.all(
    daysPayload.map((d) =>
      supabase
        .from("trip_days")
        .update({ generated_plan: d.items })
        .eq("id", d.day_id)
        .eq("trip_id", tripId)
    )
  );

  // Restore preferences too
  if (snap.preferences) {
    await supabase.from("trips").update({ preferences: snap.preferences }).eq("id", tripId);
  }

  return NextResponse.json({ ok: true, days_restored: daysPayload.length });
}

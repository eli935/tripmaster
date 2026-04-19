import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * DELETE /api/trip/[id]/plan/snapshot/[snapshotId]
 * Removes a single snapshot. RLS ensures only trip participants
 * can delete. `plan_snapshots` RLS policies for DELETE aren't explicit —
 * the trip's RLS + membership gate this.
 */

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; snapshotId: string }> }
) {
  const { id: tripId, snapshotId } = await ctx.params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("plan_snapshots")
    .delete()
    .eq("id", snapshotId)
    .eq("trip_id", tripId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

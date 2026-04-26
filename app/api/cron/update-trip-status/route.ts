import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/cron/update-trip-status
 *
 * Auto-transitions trip.status based on dates (Asia/Jerusalem):
 *   • planning → active     when start_date ≤ today ≤ end_date
 *   • active   → completed  when end_date < today
 *   • planning → completed  when end_date < today (back-fill for trips that
 *                            were never marked active because the cron didn't
 *                            exist yet, or a trip created with a past end_date)
 *
 * Trips already in 'completed' or 'review' are never touched — those are
 * terminal states an admin moved them into deliberately.
 *
 * Auth: Vercel cron sets Authorization: Bearer <CRON_SECRET>.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const IL_TZ = "Asia/Jerusalem";

function isoDateInIL(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: IL_TZ }); // YYYY-MM-DD
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "service role missing" }, { status: 500 });
  }
  const admin = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });

  const todayIL = isoDateInIL(new Date());

  // 1. planning → active: today is inside [start_date, end_date]
  const { data: toActive, error: e1 } = await admin
    .from("trips")
    .update({ status: "active" })
    .eq("status", "planning")
    .lte("start_date", todayIL)
    .gte("end_date", todayIL)
    .select("id, name, start_date, end_date");
  if (e1) {
    return NextResponse.json({ error: `to_active_failed: ${e1.message}` }, { status: 500 });
  }

  // 2. active → completed: end_date is in the past
  const { data: toCompletedFromActive, error: e2 } = await admin
    .from("trips")
    .update({ status: "completed" })
    .eq("status", "active")
    .lt("end_date", todayIL)
    .select("id, name, end_date");
  if (e2) {
    return NextResponse.json({ error: `to_completed_active_failed: ${e2.message}` }, { status: 500 });
  }

  // 3. planning → completed: trip ended before we ever flipped it to active
  //    (back-fill for legacy trips and for short trips that started+ended
  //    between two cron runs).
  const { data: toCompletedFromPlanning, error: e3 } = await admin
    .from("trips")
    .update({ status: "completed" })
    .eq("status", "planning")
    .lt("end_date", todayIL)
    .select("id, name, end_date");
  if (e3) {
    return NextResponse.json({ error: `to_completed_planning_failed: ${e3.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    today_il: todayIL,
    transitioned_to_active: toActive ?? [],
    transitioned_to_completed: [...(toCompletedFromActive ?? []), ...(toCompletedFromPlanning ?? [])],
  });
}

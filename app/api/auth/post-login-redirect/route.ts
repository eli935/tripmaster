import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/auth/post-login-redirect
 *
 * Called by /login right after a successful sign-in. Returns the URL
 * the client should navigate to:
 *   • super_admin → /dashboard (overview of all trips)
 *   • regular user with one currently-active trip → /trip/<id>
 *   • everyone else → /dashboard (lets them pick from their list)
 *
 * "Currently-active" prefers status='active' first, then 'planning'
 * with the soonest start_date, then anything within the access window.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ redirect_to: "/login" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_super_admin) {
    return NextResponse.json({ redirect_to: "/dashboard" });
  }

  // Fetch participant trips for this user, prefer active → soon-to-start
  // planning → recently completed.
  const { data: rows } = await supabase
    .from("trip_participants")
    .select("trip:trips!inner(id, status, start_date, end_date)")
    .eq("profile_id", user.id);

  type TripRef = {
    trip:
      | { id: string; status: string; start_date: string; end_date: string }
      | Array<{ id: string; status: string; start_date: string; end_date: string }>
      | null;
  };
  const trips = ((rows ?? []) as TripRef[])
    .map((r) => (Array.isArray(r.trip) ? r.trip[0] : r.trip))
    .filter((t): t is { id: string; status: string; start_date: string; end_date: string } => !!t);

  if (trips.length === 0) {
    return NextResponse.json({ redirect_to: "/dashboard" });
  }

  const active = trips.find((t) => t.status === "active");
  const soonest =
    active ??
    trips
      .filter((t) => t.status === "planning")
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ??
    trips[0];

  return NextResponse.json({ redirect_to: `/trip/${soonest.id}` });
}

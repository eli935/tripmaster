import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Stage 8 — Fetch fresh recommendations for a destination.
 *
 * GET /api/recommendations/for-destination?destination=Rome
 * Returns up to 10 items, ordered by popularity_score DESC, collected_at DESC.
 * Filters: collected_at within last 30d AND expires_at > now().
 *
 * Public endpoint (no auth) — the UI calls this directly.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const destination = (searchParams.get("destination") || "").trim();
  if (!destination) {
    return NextResponse.json(
      { error: "destination required" },
      { status: 400 }
    );
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ items: [] });
  }

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("trip_recommendations")
    .select(
      "id, destination, source, source_url, title, quote, sentiment, popularity_score, tags, collected_at, expires_at"
    )
    .eq("destination", destination)
    .gte("collected_at", thirtyDaysAgo)
    .gt("expires_at", nowIso)
    .order("popularity_score", { ascending: false })
    .order("collected_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ items: [], error: error.message });
  }

  return NextResponse.json({ items: data ?? [] });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findDestination } from "@/lib/destinations";

/**
 * POST /api/admin/backfill-meal-locations
 *
 * Retroactive fix: scans every `meals` row that lacks location info,
 * tries to match its name (or description) against the destination's
 * kosher-restaurants catalog, and fills in:
 *   - location_name
 *   - location_address
 *   - location_lat
 *   - location_lng
 *
 * Idempotent. Runs per-trip via joined lookup (meals → trip_days → trips).
 * Auth: Bearer CRON_SECRET.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev fallback
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

function normalize(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "no service role" }, { status: 500 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Pull every meal that's missing location info along with its trip's
  // country_code + destination name (we need them for catalog lookup).
  const { data: meals, error } = await db
    .from("meals")
    .select(
      "id, name, description, location_name, location_lat, location_lng, " +
        "trip_day:trip_days(trip_id, trip:trips(destination, country_code))"
    )
    .or("location_lat.is.null,location_lng.is.null");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const m of (meals ?? []) as unknown as Array<{
    id: string;
    name: string | null;
    description: string | null;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    trip_day:
      | { trip_id: string; trip: { destination: string; country_code: string } | { destination: string; country_code: string }[] | null }
      | Array<{ trip_id: string; trip: { destination: string; country_code: string } | { destination: string; country_code: string }[] | null }>
      | null;
  }>) {
    scanned++;
    const td = Array.isArray(m.trip_day) ? m.trip_day[0] : m.trip_day;
    const trip = td ? (Array.isArray(td.trip) ? td.trip[0] : td.trip) : null;
    if (!trip) {
      skipped++;
      continue;
    }
    const destination = findDestination(trip.destination, trip.country_code);
    if (!destination || destination.restaurants.length === 0) {
      skipped++;
      continue;
    }

    const needle = normalize(m.location_name || m.name || m.description || "");
    if (!needle) {
      skipped++;
      continue;
    }

    const match = destination.restaurants.find((r) => {
      const n = normalize(r.name);
      return needle.includes(n.slice(0, 6)) || n.includes(needle.slice(0, 6));
    });

    if (!match) {
      skipped++;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (!m.location_name) patch.location_name = match.name;
    if (!m.location_lat && typeof match.lat === "number") patch.location_lat = match.lat;
    if (!m.location_lng && typeof match.lng === "number") patch.location_lng = match.lng;
    if (match.address) patch.location_address = match.address;

    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }

    const { error: upErr } = await db.from("meals").update(patch).eq("id", m.id);
    if (upErr) {
      failures.push({ id: m.id, reason: upErr.message });
      continue;
    }
    updated++;
  }

  return NextResponse.json({
    ok: true,
    scanned,
    updated,
    skipped,
    failed: failures.length,
    failures,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkFlightStatus, hasChanged, type FlightStatus } from "@/lib/flight-status";

/**
 * Stage 7 — Flight status cron
 *
 * Vercel Cron calls this endpoint every few hours (see vercel.json).
 * - Finds trips whose outbound/return flight is in the next 24h
 * - Looks up current status (AviationStack or placeholder)
 * - INSERTs a new row in flight_status_log on change
 * - Posts a system message into trip_messages for unnotified changes
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TripRow {
  id: string;
  created_by: string;
  outbound_flight_number: string | null;
  outbound_flight_datetime: string | null;
  outbound_terminal: string | null;
  return_flight_number: string | null;
  return_flight_datetime: string | null;
  return_terminal: string | null;
}

interface LogRow {
  id: string;
  trip_id: string;
  flight_number: string;
  scheduled_datetime: string;
  current_datetime: string | null;
  current_terminal: string | null;
  status: string | null;
  checked_at: string | null;
  notified: boolean | null;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function describeChange(
  prev: LogRow | null,
  next: FlightStatus,
  flightNumber: string,
  scheduled: string
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("he-IL", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });

  if (next.status === "cancelled") {
    return `[מערכת] 🚫 טיסה ${flightNumber} בוטלה! פנה לחברת התעופה בהקדם.`;
  }

  if (next.status === "delayed") {
    const delayMin = Math.round(
      (new Date(next.current_datetime).getTime() -
        new Date(scheduled).getTime()) /
        60000
    );
    return `[מערכת] ⏰ טיסה ${flightNumber} עוכבה ב-${delayMin} דק' — מועד חדש ${fmt(
      next.current_datetime
    )}${next.current_terminal ? ` · טרמינל ${next.current_terminal}` : ""}.`;
  }

  const prevTerm = prev?.current_terminal || null;
  const nextTerm = next.current_terminal || null;
  if (prevTerm !== nextTerm && nextTerm) {
    return `[מערכת] 🔄 שינוי טרמינל לטיסה ${flightNumber}: טרמינל ${nextTerm}. מועד: ${fmt(
      next.current_datetime
    )}.`;
  }

  return `[מערכת] 🛫 עדכון טיסה ${flightNumber}: ${next.status}${
    nextTerm ? ` · טרמינל ${nextTerm}` : ""
  } · ${fmt(next.current_datetime)}.`;
}

export async function GET(req: Request) {
  // Auth: Vercel Cron includes Authorization: Bearer ${CRON_SECRET}
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 }
    );
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const horizonIso = horizon.toISOString();

  // Fetch trips with any flight in the next 24h.
  const { data: trips, error: tripsErr } = await supabase
    .from("trips")
    .select(
      "id, created_by, outbound_flight_number, outbound_flight_datetime, outbound_terminal, return_flight_number, return_flight_datetime, return_terminal"
    )
    .or(
      `and(outbound_flight_datetime.gte.${nowIso},outbound_flight_datetime.lte.${horizonIso}),and(return_flight_datetime.gte.${nowIso},return_flight_datetime.lte.${horizonIso})`
    );

  if (tripsErr) {
    console.error("[cron/check-flights] trips query failed:", tripsErr);
    return NextResponse.json({ error: tripsErr.message }, { status: 500 });
  }

  const summary: Array<{
    trip_id: string;
    flight_number: string;
    status: string;
    changed: boolean;
    notified: boolean;
  }> = [];

  for (const trip of (trips ?? []) as TripRow[]) {
    const legs: Array<{
      number: string;
      scheduled: string;
      terminal: string | null;
    }> = [];

    if (
      trip.outbound_flight_number &&
      trip.outbound_flight_datetime &&
      new Date(trip.outbound_flight_datetime) >= now &&
      new Date(trip.outbound_flight_datetime) <= horizon
    ) {
      legs.push({
        number: trip.outbound_flight_number,
        scheduled: trip.outbound_flight_datetime,
        terminal: trip.outbound_terminal,
      });
    }
    if (
      trip.return_flight_number &&
      trip.return_flight_datetime &&
      new Date(trip.return_flight_datetime) >= now &&
      new Date(trip.return_flight_datetime) <= horizon
    ) {
      legs.push({
        number: trip.return_flight_number,
        scheduled: trip.return_flight_datetime,
        terminal: trip.return_terminal,
      });
    }

    for (const leg of legs) {
      // Fetch latest log row for this leg.
      const { data: prevRows } = await supabase
        .from("flight_status_log")
        .select(
          "id, trip_id, flight_number, scheduled_datetime, current_datetime, current_terminal, status, checked_at, notified"
        )
        .eq("trip_id", trip.id)
        .eq("flight_number", leg.number)
        .eq("scheduled_datetime", leg.scheduled)
        .order("checked_at", { ascending: false })
        .limit(1);

      const prev: LogRow | null =
        (prevRows && (prevRows[0] as LogRow)) || null;

      const status = await checkFlightStatus(
        leg.number,
        leg.scheduled,
        leg.terminal
      );
      if (!status) continue;

      const changed = hasChanged(
        prev
          ? {
              status: prev.status,
              current_datetime: prev.current_datetime,
              current_terminal: prev.current_terminal,
            }
          : null,
        status
      );

      // Always insert the first observation so we have a baseline;
      // after that only insert on change.
      if (!prev || changed) {
        const { data: inserted, error: insErr } = await supabase
          .from("flight_status_log")
          .insert({
            trip_id: trip.id,
            flight_number: leg.number,
            scheduled_datetime: leg.scheduled,
            current_datetime: status.current_datetime,
            current_terminal: status.current_terminal,
            status: status.status,
            notified: false,
          })
          .select("id")
          .single();

        if (insErr) {
          console.warn("[cron/check-flights] insert failed:", insErr);
          continue;
        }

        let notified = false;

        // Notify only on actual changes (not the first baseline record).
        if (prev && changed) {
          const msg = describeChange(prev, status, leg.number, leg.scheduled);
          const { error: msgErr } = await supabase
            .from("trip_messages")
            .insert({
              trip_id: trip.id,
              sender_id: trip.created_by,
              content: msg,
            });

          if (!msgErr && inserted?.id) {
            await supabase
              .from("flight_status_log")
              .update({ notified: true })
              .eq("id", inserted.id);
            notified = true;
          } else if (msgErr) {
            console.warn("[cron/check-flights] chat insert failed:", msgErr);
          }
        }

        summary.push({
          trip_id: trip.id,
          flight_number: leg.number,
          status: status.status,
          changed: !!prev && changed,
          notified,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: nowIso,
    trips: trips?.length ?? 0,
    updates: summary,
  });
}

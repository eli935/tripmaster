import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppBulk, type WhatsAppMessage } from "@/lib/whatsapp";
import type { DayBooking, Meal } from "@/lib/supabase/types";
import { MEAL_TYPE_DEFAULT_TIME, MEAL_TYPE_LABEL } from "@/lib/destinations";

/**
 * GET /api/cron/daily-whatsapp?kind=morning|evening
 *
 * For every active trip (today falls inside start_date…end_date), send the
 * daily WhatsApp broadcast to all participants with a phone number:
 *   • morning → today's itinerary + Google Maps multi-stop link
 *   • evening → "לילה טוב, נפגש מחר" + tomorrow tease
 *
 * De-duped via whatsapp_log: won't resend the same (trip, day, kind) twice.
 *
 * Auth: Vercel cron sets Authorization: Bearer <CRON_SECRET>. Manual triggers
 *       (e.g. external cron-job.org or Eli clicking a link) must pass the
 *       same header.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const IL_TZ = "Asia/Jerusalem";

function isoDateInIL(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: IL_TZ }); // YYYY-MM-DD
}

function minutesSinceMidnightIL(d: Date): number {
  const hhmm = d.toLocaleTimeString("en-GB", {
    timeZone: IL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function parseHHMM(s: string | undefined | null): number | null {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function buildGmapsMultiStop(
  origin: { lat: number; lng: number } | null,
  stops: Array<{ lat: number; lng: number }>
): string | null {
  if (stops.length === 0) return null;
  const parts: string[] = [];
  if (origin) parts.push(`${origin.lat},${origin.lng}`);
  for (const s of stops) parts.push(`${s.lat},${s.lng}`);
  return `https://www.google.com/maps/dir/${parts.join("/")}`;
}

function formatMorningMessage(
  tripName: string,
  dateLabel: string,
  bookings: DayBooking[],
  meals: Meal[],
  gmapsUrl: string | null
): string {
  const lines: string[] = [];
  lines.push(`☀️ *בוקר טוב מ-TripMaster!*`);
  lines.push(`${tripName} · ${dateLabel}`);
  lines.push("");

  // Chronological merge: bookings + meals by time
  type Row = { time: string; text: string };
  const rows: Row[] = [];
  for (const b of bookings) {
    const time = (b.time || "12:00").slice(0, 5);
    rows.push({ time, text: `📍 ${b.name || b.attraction_name}` });
  }
  for (const m of meals) {
    const time = (m.time || MEAL_TYPE_DEFAULT_TIME[m.meal_type] || "12:00").slice(0, 5);
    const label = MEAL_TYPE_LABEL[m.meal_type] ?? m.meal_type;
    rows.push({ time, text: `🍽️ ${label}${m.name ? ` — ${m.name}` : ""}` });
  }
  rows.sort((a, b) => a.time.localeCompare(b.time));

  if (rows.length === 0) {
    lines.push("היום פנוי להתארגנות — יום נפלא!");
  } else {
    for (const r of rows) {
      lines.push(`🕐 ${r.time}  ${r.text}`);
    }
  }

  if (gmapsUrl) {
    lines.push("");
    lines.push(`🗺️ מפת היום: ${gmapsUrl}`);
  }

  lines.push("");
  lines.push(`יום מקסים! 🌻`);
  return lines.join("\n");
}

function formatEveningMessage(tripName: string, tomorrowPreview: string | null): string {
  const lines: string[] = [];
  lines.push(`🌙 *לילה טוב מ-TripMaster!*`);
  lines.push(`${tripName}`);
  lines.push("");
  lines.push("מקווים שהיה יום מושלם. הגיע הזמן לנוח ולהכין אנרגיה ליום הבא.");
  if (tomorrowPreview) {
    lines.push("");
    lines.push(`☀️ מחר מחכה לכם:`);
    lines.push(tomorrowPreview);
  }
  lines.push("");
  lines.push(`נפגש מחר בבוקר ✨`);
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  // Vercel cron → Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "evening" ? "evening" : "morning";

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "service role missing" }, { status: 500 });
  }
  const admin = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });

  const now = new Date();
  const todayIL = isoDateInIL(now);
  const nowMinIL = minutesSinceMidnightIL(now);

  // Active trips: status=active OR planning, and today between start/end
  const { data: trips } = await admin
    .from("trips")
    .select(
      "id, name, start_date, end_date, preferences, accommodation_lat, accommodation_lng"
    )
    .lte("start_date", todayIL)
    .gte("end_date", todayIL);

  let tripsProcessed = 0;
  let messagesSent = 0;
  let skipped = 0;

  for (const trip of trips ?? []) {
    tripsProcessed++;
    const prefs = (trip.preferences ?? {}) as {
      daily_start?: string;
      daily_end?: string;
    };
    const startMin = parseHHMM(prefs.daily_start) ?? 9 * 60;
    const endMin = parseHHMM(prefs.daily_end) ?? 20 * 60;

    // Morning window: starts 30 min before daily_start. If cron ran earlier,
    // we still send (cron fires once; we don't wait for the exact minute).
    // Evening window: starts 30 min after daily_end.
    const morningTarget = startMin - 30;
    const eveningTarget = endMin + 30;

    if (kind === "morning" && nowMinIL + 60 < morningTarget) {
      // If current time is still >60 min before the target, skip (too early)
      skipped++;
      continue;
    }
    if (kind === "evening" && nowMinIL + 60 < eveningTarget) {
      skipped++;
      continue;
    }

    // Find today's trip_day (and tomorrow for evening preview)
    const { data: allDays } = await admin
      .from("trip_days")
      .select("id, date, bookings")
      .eq("trip_id", trip.id)
      .order("date", { ascending: true });
    if (!allDays || allDays.length === 0) {
      skipped++;
      continue;
    }
    const todayDay = allDays.find((d) => d.date === todayIL);
    if (!todayDay) {
      skipped++;
      continue;
    }

    // De-dup: has this (trip_id, trip_day_id, kind) been logged already?
    const { data: existingLog } = await admin
      .from("whatsapp_log")
      .select("id")
      .eq("trip_id", trip.id)
      .eq("trip_day_id", todayDay.id)
      .eq("kind", kind)
      .limit(1)
      .maybeSingle();
    if (existingLog) {
      skipped++;
      continue;
    }

    // Build message
    let text: string;
    if (kind === "morning") {
      const { data: meals } = await admin
        .from("meals")
        .select("*")
        .eq("trip_day_id", todayDay.id);
      const bookings = (todayDay.bookings as DayBooking[] | null) ?? [];
      const origin =
        typeof trip.accommodation_lat === "number" && typeof trip.accommodation_lng === "number"
          ? { lat: trip.accommodation_lat, lng: trip.accommodation_lng }
          : null;
      const stops = bookings
        .filter((b) => typeof b.lat === "number" && typeof b.lng === "number")
        .map((b) => ({ lat: b.lat as number, lng: b.lng as number }));
      const gmapsUrl = buildGmapsMultiStop(origin, stops);
      const dateLabel = new Date(todayIL).toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      text = formatMorningMessage(trip.name, dateLabel, bookings, (meals as Meal[]) ?? [], gmapsUrl);
    } else {
      // Evening: build a small preview of tomorrow
      const tomorrowIdx = allDays.findIndex((d) => d.date === todayIL) + 1;
      const tomorrowDay = tomorrowIdx < allDays.length ? allDays[tomorrowIdx] : null;
      let preview: string | null = null;
      if (tomorrowDay) {
        const tomB = (tomorrowDay.bookings as DayBooking[] | null) ?? [];
        if (tomB.length > 0) {
          preview = tomB
            .slice(0, 3)
            .map((b) => `• ${b.name || b.attraction_name}`)
            .join("\n");
          if (tomB.length > 3) preview += `\n• ועוד ${tomB.length - 3}...`;
        }
      }
      text = formatEveningMessage(trip.name, preview);
    }

    // Recipients: all participants with phone
    const { data: participants } = await admin
      .from("trip_participants")
      .select("profile:profiles(phone)")
      .eq("trip_id", trip.id);
    const phones = ((participants ?? []) as unknown as Array<{ profile: { phone: string | null } | Array<{ phone: string | null }> | null }>)
      .map((p) => {
        const prof = Array.isArray(p.profile) ? p.profile[0] : p.profile;
        return prof?.phone ?? "";
      })
      .filter((s) => s.length >= 9)
      .map((s) => s.replace(/[^0-9]/g, ""));
    if (phones.length === 0) {
      skipped++;
      continue;
    }

    const msgs: WhatsAppMessage[] = phones.map((to) => ({ to, text }));
    const sent = await sendWhatsAppBulk(msgs);
    messagesSent += sent;

    // Log (so we don't resend)
    await admin.from("whatsapp_log").insert({
      trip_id: trip.id,
      trip_day_id: todayDay.id,
      kind,
      recipients: sent,
      payload_preview: text.slice(0, 200),
    });
  }

  return NextResponse.json({
    ok: true,
    kind,
    trips_processed: tripsProcessed,
    messages_sent: messagesSent,
    skipped,
    now_il: new Date().toLocaleString("he-IL", { timeZone: IL_TZ }),
  });
}

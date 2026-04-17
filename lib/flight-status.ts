/**
 * Flight status checker — Stage 7
 *
 * Fetches real-time flight status from AviationStack (if API key present)
 * or returns a safe "on_time" placeholder otherwise.
 *
 * Graceful fallback: any failure returns null ⇒ caller skips the update.
 */

export type FlightStatusValue =
  | "on_time"
  | "delayed"
  | "cancelled"
  | "boarding"
  | "departed";

export interface FlightStatus {
  status: FlightStatusValue;
  current_datetime: string; // ISO
  current_terminal: string | null;
  source: "aviationstack" | "placeholder";
}

/**
 * Look up current status for a flight.
 * @param flightNumber IATA flight number (e.g. "LY315")
 * @param scheduledDatetime ISO datetime of scheduled departure
 * @param originalTerminal The terminal as recorded in trips (fallback)
 */
export async function checkFlightStatus(
  flightNumber: string,
  scheduledDatetime: string,
  originalTerminal?: string | null
): Promise<FlightStatus | null> {
  const key = process.env.AVIATIONSTACK_API_KEY;

  // No API key → placeholder "on_time" with original schedule.
  if (!key) {
    return {
      status: "on_time",
      current_datetime: scheduledDatetime,
      current_terminal: originalTerminal ?? null,
      source: "placeholder",
    };
  }

  try {
    const iata = flightNumber.replace(/\s+/g, "").toUpperCase();
    const url = `http://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(
      key
    )}&flight_iata=${encodeURIComponent(iata)}`;
    const res = await fetch(url, {
      // Never cache live status.
      cache: "no-store",
      // Keep a reasonable timeout — AviationStack can be slow.
      signal: AbortSignal.timeout?.(10_000),
    });

    if (!res.ok) {
      console.warn(
        `[flight-status] AviationStack HTTP ${res.status} for ${iata}`
      );
      return null;
    }

    const data = (await res.json()) as {
      data?: Array<{
        flight_status?: string;
        departure?: {
          scheduled?: string;
          estimated?: string;
          actual?: string;
          terminal?: string;
        };
      }>;
    };

    // Pick the record whose scheduled datetime is closest to ours.
    const records = data?.data ?? [];
    if (!records.length) return null;

    const wanted = new Date(scheduledDatetime).getTime();
    let best: (typeof records)[number] | null = null;
    let bestDiff = Infinity;
    for (const r of records) {
      const s = r.departure?.scheduled;
      if (!s) continue;
      const diff = Math.abs(new Date(s).getTime() - wanted);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = r;
      }
    }
    if (!best) return null;

    const rawStatus = (best.flight_status ?? "scheduled").toLowerCase();
    const normalized: FlightStatusValue =
      rawStatus === "cancelled"
        ? "cancelled"
        : rawStatus === "active"
        ? "departed"
        : rawStatus === "landed"
        ? "departed"
        : rawStatus === "incident" || rawStatus === "diverted"
        ? "delayed"
        : "on_time";

    const estimated =
      best.departure?.actual ||
      best.departure?.estimated ||
      best.departure?.scheduled ||
      scheduledDatetime;

    // If estimated time shifts ≥ 10 minutes later than scheduled → mark delayed.
    const delayMin =
      (new Date(estimated).getTime() - new Date(scheduledDatetime).getTime()) /
      60000;
    const status: FlightStatusValue =
      normalized === "cancelled"
        ? "cancelled"
        : delayMin >= 10
        ? "delayed"
        : normalized;

    return {
      status,
      current_datetime: new Date(estimated).toISOString(),
      current_terminal: best.departure?.terminal ?? originalTerminal ?? null,
      source: "aviationstack",
    };
  } catch (err) {
    console.warn("[flight-status] lookup failed:", err);
    return null;
  }
}

/**
 * Compare two snapshots and decide if there's a meaningful change.
 */
export function hasChanged(
  prev: {
    status: string | null;
    current_datetime: string | null;
    current_terminal: string | null;
  } | null,
  next: FlightStatus
): boolean {
  if (!prev) return false; // first check — not a "change"
  if (prev.status !== next.status) return true;
  if ((prev.current_terminal || null) !== (next.current_terminal || null))
    return true;
  if (prev.current_datetime && next.current_datetime) {
    const diffMin = Math.abs(
      (new Date(next.current_datetime).getTime() -
        new Date(prev.current_datetime).getTime()) /
        60000
    );
    if (diffMin >= 5) return true;
  }
  return false;
}

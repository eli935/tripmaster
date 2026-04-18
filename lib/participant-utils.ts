import type { Trip, TripParticipant } from "./supabase/types";

/**
 * Returns whether a given participant row should be counted in headcount /
 * quantity math. The admin (trip creator) is excluded when the trip has
 * `admin_participates === false` — meaning the admin is organising but not
 * physically on the trip.
 *
 * Admin is still included in:
 *  - participant list UI (with a subtle badge)
 *  - permissions / access control
 *  - expense payer role (if they paid)
 *  - chat
 *
 * See v9.0 `admin_participates` column on `trips`.
 */
export function isCountedParticipant(
  participant: Pick<TripParticipant, "profile_id">,
  trip: Pick<Trip, "created_by" | "admin_participates">
): boolean {
  // Default is true (legacy rows); only exclude when explicitly false.
  if (trip.admin_participates === false && participant.profile_id === trip.created_by) {
    return false;
  }
  return true;
}

/**
 * Filter the raw participants list down to only those who should be counted.
 * Returns the same array reference when nothing is filtered (micro-optimisation
 * for React memoisation upstream).
 */
export function getCountedParticipants<
  P extends Pick<TripParticipant, "profile_id">
>(
  participants: P[],
  trip: Pick<Trip, "created_by" | "admin_participates">
): P[] {
  if (trip.admin_participates !== false) return participants;
  return participants.filter((p) => isCountedParticipant(p, trip));
}

/**
 * Returns the aggregate headcount for a trip:
 *   { adults, children, total, families }
 *
 * `adults` and `children` sum across counted participants. `families` is the
 * number of participant rows that actually count (i.e. excludes the admin
 * when admin_participates=false). `total = adults + children`.
 *
 * Important: this is used for equipment qty, shopping qty, meal default
 * servings, and per-person expense splits. If you need to display the
 * participant list UI, iterate `participants` directly — not the result of
 * this helper.
 */
export function getTotalHeadcount(
  participants: TripParticipant[],
  trip: Pick<Trip, "created_by" | "admin_participates">
): { adults: number; children: number; total: number; families: number } {
  let adults = 0;
  let children = 0;
  let families = 0;
  for (const p of participants) {
    if (!isCountedParticipant(p, trip)) continue;
    adults += p.adults || 0;
    children += p.children || 0;
    families += 1;
  }
  return { adults, children, total: adults + children, families };
}

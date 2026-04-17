# Stage 7 — Flight status cron & notifications (v1.0)

**Agents:** `database-expert` + `destinations-expert`
**Date:** 2026-04-17 15:25 | **TripMaster v9.0**

---

## 🎯 מטרה | Goal

הוספת ניטור סטטוס טיסות אוטומטי לטיולים פעילים — בעזרת Vercel Cron שרץ כל 4 שעות, בודק טיסות יוצאות/חוזרות ב-24 השעות הקרובות, רושם שינויים ב-`flight_status_log` ומפרסם הודעות מערכת בצ'אט הטיול. מבוסס על AviationStack בפרודקשן; נופל חלק לפלייסהולדר בטוח ללא מפתח API.

Add automatic flight-status monitoring for active trips via a Vercel Cron job running every 4 hours. It scans flights scheduled in the next 24 h, appends rows to `flight_status_log` when a change is detected, and posts a system message into the trip chat. Works with AviationStack in production and gracefully falls back to a safe "on_time" placeholder when no API key is set.

---

## 📂 קבצים שנוצרו | Files Created

| Path | Purpose |
|---|---|
| `lib/flight-status.ts` | `checkFlightStatus()` + `hasChanged()` — AviationStack client + placeholder fallback + diff helper. |
| `app/api/cron/check-flights/route.ts` | `GET` endpoint for Vercel Cron. Bearer-token auth, scans trips, writes log rows, posts chat notifications. |
| `vercel.json` | Cron schedule — `0 */4 * * *` → `/api/cron/check-flights`. |

## ✏️ קבצים ששונו | Files Modified

| Path | Change |
|---|---|
| `.env.example` | Added `CRON_SECRET`, `AVIATIONSTACK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (all optional in dev). |
| `app/trip/[id]/destination-overview.tsx` | `FlightSummary` now queries `flight_status_log` for the latest row per flight and renders coloured live-status badges (delay / cancellation / terminal change) through a new `FlightLine` prop `live`. |

---

## 🧪 בדיקות | Tests

| Check | Status |
|---|---|
| `npx tsc --noEmit` | ✅ Exit 0 |
| No new npm packages | ✅ uses existing `@supabase/supabase-js` + `next` |
| First-check baseline (no notification) | ✅ `hasChanged()` returns `false` when `prev === null`; row is inserted with `notified=false` and no chat message. |
| Missing `CRON_SECRET` in dev | ✅ Auth is skipped when env var is unset (graceful dev). |
| Missing `AVIATIONSTACK_API_KEY` | ✅ `checkFlightStatus()` returns a placeholder `on_time` snapshot; no external call. |
| Missing Supabase URL/key | ✅ Endpoint returns `500 { error: "supabase not configured" }` instead of crashing. |

**Manual smoke (suggested):**
```bash
# With dev server running
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/check-flights
```

---

## 📋 Checklist

- [x] Part A — Cron endpoint at `app/api/cron/check-flights/route.ts` with Bearer auth.
- [x] Part B — `lib/flight-status.ts` helper with AviationStack integration + placeholder fallback (returns `null` on error).
- [x] Part C — Chat notifications via `trip_messages` using `created_by` as sender + `[מערכת]` prefix; `notified` flag flipped to `true` after insert.
- [x] Part D — `vercel.json` with 4-hour cron; `.env.example` updated.
- [x] Part E — Live-status badges on `FlightSummary`: yellow delay / red cancellation / orange terminal change.
- [x] No notification on first observation (only on subsequent changes).
- [x] `tsc --noEmit` passes.

---

## ❓ שאלות פתוחות | Open Questions

1. **Sender identity.** Chat messages are posted as the trip's `created_by` user with a `[מערכת]` text prefix. A dedicated `is_system` column (or a reserved system profile) would be cleaner — parked for a future migration as the task spec disallowed schema changes.
2. **Rate-limit guard.** Spec suggested storing a last-run timestamp in `app_versions`. Omitted — Vercel Cron itself enforces the 4-hour cadence, and manual `/admin/cron…` triggers are already rare. Re-add if user hits AviationStack free-tier quota.
3. **AviationStack plan.** Free tier is `http://` only (no HTTPS) and rate-limited to 100 calls/month. For ≥ 2 concurrent trips with 2 legs checking every 4 h we'd need ≈ 360 calls/month → a paid tier or a different provider (FlightAware, OpenSky) is worth evaluating.
4. **Terminal mismatch baseline.** If Stage 3b parsed the terminal as `"3"` but AviationStack returns `"B"` (different airport format), every check will flag a change. May need an airport-specific normalisation table later.
5. **Multiple recipients.** Currently a single chat message per change is posted; all trip participants already see it via Realtime. Explicit per-user push (web-push / WhatsApp) is deferred.

---

## 🔄 המלצה לשלב הבא | Recommendation for Next Stage

**Stage 8 — Trip-wide notification center**
Build a unified notifications UI that aggregates:
- `flight_status_log` changes (Stage 7) — already in DB.
- `trip_todos` due soon & `meal_attendance` missing RSVPs.
- Weather alerts for upcoming trip days.

Add a bell icon in the trip header with unread count, and reuse the `[מערכת]` message convention (or introduce a dedicated `notifications` table via migration 010). Also a good moment to add a small admin `/admin/cron/status` panel showing last cron run timestamp + summary from the JSON response.

Secondary follow-up: wire WhatsApp delivery for cancellations/major delays through the existing `lib/whatsapp.ts` path so users get notified even without the app open.

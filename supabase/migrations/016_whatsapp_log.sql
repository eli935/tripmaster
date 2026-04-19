-- ═══════════════════════════════════════════════════════════════════
-- 016 · WhatsApp daily message log
-- Prevents double-sending the daily itinerary broadcast to a trip.
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  trip_day_id    UUID REFERENCES public.trip_days(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('morning','evening','other')),
  recipients     INT NOT NULL DEFAULT 0,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_preview TEXT
);

CREATE INDEX IF NOT EXISTS idx_wa_log_trip_day_kind
  ON public.whatsapp_log(trip_id, trip_day_id, kind);

CREATE INDEX IF NOT EXISTS idx_wa_log_sent_at
  ON public.whatsapp_log(sent_at DESC);

-- Service-role writes only. No SELECT policy for authenticated — Eli can
-- read via Supabase dashboard if needed. Logged for audit, not display.
ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;

COMMIT;

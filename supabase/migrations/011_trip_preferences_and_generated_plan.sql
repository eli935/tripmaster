-- ═══════════════════════════════════════════════════════════════════
-- 011 · Trip Preferences + AI-generated Plan
-- תשתית ל-"תכנון מלא עם AI" (Wizard Phase 1):
--   1) trips.preferences JSONB — תשובות ה-wizard (pace, interests, transport,
--      daily_start/end, siesta, meals.*, budget_per_day)
--   2) trip_days.generated_plan JSONB — תוצאת ה-AI לכל יום (מערך items עם
--      time/type/title/duration_min/attraction_id/vendor/notes)
--
-- Idempotent — ניתן להריץ שוב בבטחה.
-- RLS: ללא שינוי (policies קיימות על trips + trip_days מכסות).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.trip_days
  ADD COLUMN IF NOT EXISTS generated_plan JSONB DEFAULT '[]'::jsonb;

-- הבטחת סוג תקין: preferences תמיד object, generated_plan תמיד array
UPDATE public.trips
  SET preferences = '{}'::jsonb
  WHERE preferences IS NULL OR jsonb_typeof(preferences) != 'object';

UPDATE public.trip_days
  SET generated_plan = '[]'::jsonb
  WHERE generated_plan IS NULL OR jsonb_typeof(generated_plan) != 'array';

DO $$
BEGIN
  ALTER TABLE public.trips
    ADD CONSTRAINT trips_preferences_is_object
    CHECK (jsonb_typeof(preferences) = 'object');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.trip_days
    ADD CONSTRAINT trip_days_generated_plan_is_array
    CHECK (jsonb_typeof(generated_plan) = 'array');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- 010 · Itinerary Foundation
-- תשתית ל"תוכניה יומית" — מיזוג אטרקציות + ארוחות בציר זמן חזותי.
--
-- שינויים:
--   1) meals — זמן מפורש, מיקום מסעדה (lat/lng/שם/כתובת)
--   2) trip_days.bookings JSONB — הרחבה ל-snapshot מלא:
--      description, image_url, lat, lng, duration_minutes,
--      order_index, user_notes, waze_url, category, website_url,
--      booking_id (UUID ייחודי לכל booking)
--   3) אינדקסים: meals(trip_day_id, time), trip_days(trip_id, date),
--      GIN על trip_days.bookings
--
-- אידמפוטנטית — ניתן להריץ שוב בבטחה.
-- RLS: לא נדרש שינוי (policies קיימות על trip_days + meals מכסות).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────
-- 1) meals — זמן מפורש + מיקום מסעדה
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS time TIME NULL,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS location_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS location_lng NUMERIC(10,7);

-- ───────────────────────────────────────────────────────────────────
-- 2) trip_days.bookings — backfill JSONB עם מפתחות חסרים
--    (כל booking קיים מקבל את השדות החדשים כ-null / defaults)
-- ───────────────────────────────────────────────────────────────────
UPDATE public.trip_days
SET bookings = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN jsonb_typeof(b) = 'object' THEN
        jsonb_build_object(
          'booking_id',       COALESCE(b->>'booking_id', gen_random_uuid()::text),
          'attraction_id',    b->'attraction_id',
          'attraction_name',  b->'attraction_name',
          'name',             COALESCE(b->'name', b->'attraction_name'),
          'description',      b->'description',
          'image_url',        b->'image_url',
          'category',         b->'category',
          'lat',              b->'lat',
          'lng',              b->'lng',
          'website_url',      b->'website_url',
          'waze_url',         b->'waze_url',
          'gmaps_url',        b->'gmaps_url',
          'time',             b->'time',
          'duration_minutes', b->'duration_minutes',
          'order_index',      COALESCE(b->'order_index', to_jsonb(0)),
          'user_notes',       b->'user_notes',
          'created_at',       COALESCE(b->'created_at', to_jsonb(now()))
        )
      ELSE b
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(bookings, '[]'::jsonb)) AS b
)
WHERE bookings IS NOT NULL AND jsonb_typeof(bookings) = 'array';

-- וידוא שכל הערכים הם array (גם אם NULL)
UPDATE public.trip_days
  SET bookings = '[]'::jsonb
  WHERE bookings IS NULL OR jsonb_typeof(bookings) != 'array';

-- Check constraint — bookings תמיד array
DO $$
BEGIN
  ALTER TABLE public.trip_days
    ADD CONSTRAINT trip_days_bookings_is_array
    CHECK (jsonb_typeof(bookings) = 'array');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

-- ───────────────────────────────────────────────────────────────────
-- 3) אינדקסים — timeline query + itinerary page load
-- ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meals_day_time
  ON public.meals(trip_day_id, time NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_trip_days_trip_date
  ON public.trip_days(trip_id, date);

CREATE INDEX IF NOT EXISTS idx_trip_days_bookings_gin
  ON public.trip_days USING gin (bookings);

COMMIT;

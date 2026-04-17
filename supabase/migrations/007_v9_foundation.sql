-- ═══════════════════════════════════════════════════════════════════
-- 007 · v9.0 Foundation
-- מיגרציה אחת הכוללת את כל השינויים הסכמתיים הדרושים לשלבים הבאים
-- של גרסה 9.0: סוגי טיולים, טיסות, לינה, מתכונים, נוכחות בארוחות,
-- המלצות מצד שלישי, מזג אויר, משימות משפחה, ולוג סטטוס טיסות.
-- אידמפוטנטית — ניתן להריץ שוב בבטחה.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────
-- 1) טבלת trips — עמודות חדשות (סוג טיול, לינה, טיסות, תמחור)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_type TEXT NOT NULL DEFAULT 'family'
    CHECK (trip_type IN ('private','family','friends','client')),
  ADD COLUMN IF NOT EXISTS location_type TEXT NOT NULL DEFAULT 'international'
    CHECK (location_type IN ('domestic','international')),
  ADD COLUMN IF NOT EXISTS admin_participates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS markup_type TEXT DEFAULT 'none'
    CHECK (markup_type IN ('none','percent','fixed')),
  ADD COLUMN IF NOT EXISTS markup_value NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accommodation_name TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_address TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS accommodation_lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS outbound_flight_number TEXT,
  ADD COLUMN IF NOT EXISTS outbound_flight_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outbound_airport TEXT,
  ADD COLUMN IF NOT EXISTS outbound_terminal TEXT,
  ADD COLUMN IF NOT EXISTS return_flight_number TEXT,
  ADD COLUMN IF NOT EXISTS return_flight_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_airport TEXT,
  ADD COLUMN IF NOT EXISTS return_terminal TEXT;

-- ───────────────────────────────────────────────────────────────────
-- 2) trip_days — הזמנות אטרקציות ליום
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.trip_days
  ADD COLUMN IF NOT EXISTS bookings JSONB DEFAULT '[]'::jsonb;

-- ───────────────────────────────────────────────────────────────────
-- 3) trip_files — תיאור חובה (עם backfill)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.trip_files
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.trip_files
  SET description = ''
  WHERE description IS NULL;

ALTER TABLE public.trip_files
  ALTER COLUMN description SET NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- 4) meals — כמות סועדים + קישור למתכון
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS attendees_count INT DEFAULT NULL;

-- ───────────────────────────────────────────────────────────────────
-- 5) meal_recipes — ספריית מתכונים + cache ל-AI
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meal_recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  ingredients   JSONB NOT NULL,          -- [{name, quantity_per_person, unit}]
  instructions  TEXT,
  source        TEXT DEFAULT 'ai'
                CHECK (source IN ('ai','manual','library')),
  created_by    UUID REFERENCES public.profiles(id),
  trip_id       UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  content_hash  TEXT UNIQUE,             -- dedup ל-AI cache
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_recipes_trip
  ON public.meal_recipes(trip_id);

-- עכשיו אפשר להוסיף ל-meals את ה-FK (אחרי יצירת meal_recipes)
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS recipe_id UUID
    REFERENCES public.meal_recipes(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────────────
-- 6) meal_attendance — מי אוכל איזו ארוחה
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meal_attendance (
  meal_id        UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.trip_participants(id) ON DELETE CASCADE,
  attending      BOOLEAN DEFAULT true,
  PRIMARY KEY (meal_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_attendance_participant
  ON public.meal_attendance(participant_id);

-- ───────────────────────────────────────────────────────────────────
-- 7) trip_recommendations — scraping agent (Reddit/TripAdvisor/Claude)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_recommendations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination       TEXT NOT NULL,
  source            TEXT
                    CHECK (source IN ('reddit','tripadvisor','facebook','blog','claude')),
  source_url        TEXT,
  title             TEXT,
  quote             TEXT,
  sentiment         TEXT
                    CHECK (sentiment IN ('positive','neutral','negative')),
  popularity_score  INT DEFAULT 0,
  tags              TEXT[] DEFAULT '{}',
  collected_at      TIMESTAMPTZ DEFAULT now(),
  expires_at        TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_trip_recommendations_dest_time
  ON public.trip_recommendations(destination, collected_at DESC);

-- ───────────────────────────────────────────────────────────────────
-- 8) destinations_cache — מנהגים מקומיים + cache מזג אוויר
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.destinations_cache
  ADD COLUMN IF NOT EXISTS local_customs JSONB,
  ADD COLUMN IF NOT EXISTS weather_cache JSONB,
  ADD COLUMN IF NOT EXISTS weather_cached_at TIMESTAMPTZ;

-- ───────────────────────────────────────────────────────────────────
-- 9) trip_todos — "מי מביא מה" למשפחה
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_todos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  assigned_to  UUID REFERENCES public.trip_participants(id) ON DELETE SET NULL,
  task         TEXT NOT NULL,
  category     TEXT CHECK (category IN ('bring','do','book','other')),
  done         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_todos_trip
  ON public.trip_todos(trip_id);

-- ───────────────────────────────────────────────────────────────────
-- 10) flight_status_log — מעקב סטטוס טיסות (cron בשלב 7)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flight_status_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  flight_number       TEXT NOT NULL,
  scheduled_datetime  TIMESTAMPTZ NOT NULL,
  current_datetime    TIMESTAMPTZ,
  current_terminal    TEXT,
  status              TEXT
                      CHECK (status IN ('on_time','delayed','cancelled','boarding','departed')),
  checked_at          TIMESTAMPTZ DEFAULT now(),
  notified            BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_flight_status_trip
  ON public.flight_status_log(trip_id);
CREATE INDEX IF NOT EXISTS idx_flight_status_flight_time
  ON public.flight_status_log(flight_number, scheduled_datetime);

-- ───────────────────────────────────────────────────────────────────
-- Realtime — הוספת טבלאות שזקוקות ל-Realtime לפובליקציה
-- (נעטף ב-DO block כדי להיות אידמפוטנטי ולא ליפול אם כבר קיים)
-- ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_attendance;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_todos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_recommendations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMIT;

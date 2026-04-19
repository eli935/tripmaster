-- ═══════════════════════════════════════════════════════════════════
-- 015 · Leads table
-- פניות מלקוחות פוטנציאליים מדף הנחיתה — שם, יעד, הרכב משפחתי,
-- מייל, טלפון. נשלח גם במייל ל-Eli.
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  destination    TEXT NOT NULL,
  travel_dates   TEXT,               -- free-text: "פסח 2026", "ספטמבר-אוקטובר"
  adults         INT NOT NULL DEFAULT 2,
  children       INT NOT NULL DEFAULT 0,
  message        TEXT,               -- "מה היית רוצה שנעזור לך איתו?"
  locale         TEXT DEFAULT 'he' CHECK (locale IN ('he','en')),
  status         TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','converted','archived')),
  user_agent     TEXT,
  referrer       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  contacted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- RLS: nobody reads from the client (service role only).
-- Public insert via API route only (API uses service key or anon+explicit policy).
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (lead form submits without login)
DO $$
BEGIN
  CREATE POLICY "leads_public_insert"
    ON public.leads FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- No SELECT policy by default — leads visible only via service role
-- (Eli reads via email or Supabase dashboard, never from client).

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- 012 · Vendors table (Phase 2 of Full Planning Wizard)
-- טבלת ספקים מאומתים לקישור עם AI-generated plan items.
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   TEXT NOT NULL,             -- 'ME', 'IT', 'GR'
  destination    TEXT NOT NULL,             -- free-form city/region ('Rome', 'Athens', 'Kotor')
  vendor_type    TEXT NOT NULL CHECK (vendor_type IN (
                    'tour','restaurant','guide','rental','activity',
                    'chabad','kosher_store','airport_transfer','other'
                 )),
  name           TEXT NOT NULL,
  name_en        TEXT,
  phone          TEXT,
  whatsapp       TEXT,
  website        TEXT,
  maps_url       TEXT,
  address        TEXT,
  lat            NUMERIC(10,7),
  lng            NUMERIC(10,7),
  hours          TEXT,                      -- free-text Hebrew
  notes          TEXT,                      -- "Eli's friend, speaks Hebrew", etc.
  tags           TEXT[],                    -- ['family-friendly','kosher','hebrew-speaking']
  verified       BOOLEAN NOT NULL DEFAULT false,
  verified_by    TEXT,                      -- 'eli', 'community', 'ai-suggestion'
  trusted_since  DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_country_type
  ON public.vendors(country_code, vendor_type);

CREATE INDEX IF NOT EXISTS idx_vendors_destination
  ON public.vendors(destination);

-- RLS: read-open (all authenticated users can see the vendor catalog),
-- write-closed (only service role / admin). Enable RLS then add policies.
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "vendors_read_all_authenticated"
    ON public.vendors FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- No INSERT/UPDATE/DELETE policy for authenticated → defaults to deny.
-- Writes only via service-role key (admin scripts / Eli's seeding).

COMMIT;

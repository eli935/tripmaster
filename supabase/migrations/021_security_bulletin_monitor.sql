-- ═══════════════════════════════════════════════════════════════════
-- 021 · Security bulletin monitor
-- Stores a content hash of external security pages (e.g. the Vercel
-- incident bulletin) so the daily cron knows when the page changed
-- and triggers an email alert to Eli.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.security_bulletins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url            TEXT NOT NULL UNIQUE,
  label          TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  content_excerpt TEXT,
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_count    INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_security_bulletins_url ON public.security_bulletins(url);

-- RLS: service role only (this table is watched by cron + read by admin).
ALTER TABLE public.security_bulletins ENABLE ROW LEVEL SECURITY;
-- No policies → default deny for authenticated. Only service role can
-- read/write.

COMMIT;

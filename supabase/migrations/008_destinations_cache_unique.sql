-- ═══════════════════════════════════════════════════════════════════
-- 008 — destinations_cache: ensure UNIQUE constraint on country_code
-- ═══════════════════════════════════════════════════════════════════
-- Context:
--   The client code uses .upsert({ onConflict: 'country_code' }) on
--   destinations_cache when writing weather cache. That requires a
--   UNIQUE or PRIMARY KEY on country_code. Earlier migrations only
--   ALTER the table (add columns) — they never created it or declared
--   the unique constraint, so the upsert could 23505-fail silently.
--
-- This migration adds the UNIQUE constraint idempotently (does nothing
-- if a constraint/index already enforces uniqueness on country_code).
-- We use a DO block since SQL lacks native IF NOT EXISTS for
-- table constraints.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Only add the constraint if nothing already enforces uniqueness on country_code
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'destinations_cache'
      AND c.contype IN ('u','p')
      AND c.conkey = ARRAY[(
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = t.oid AND attname = 'country_code'
      )]::smallint[]
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'destinations_cache'
      AND indexdef ILIKE '%UNIQUE%(country_code)%'
  )
  THEN
    ALTER TABLE public.destinations_cache
      ADD CONSTRAINT destinations_cache_country_code_unique UNIQUE (country_code);
  END IF;
END$$;

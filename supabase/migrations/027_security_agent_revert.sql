-- =====================================================================
-- Backup-before-change: every auto-fix logs a precomputed revert SQL
-- so it can be rolled back without forensics. The agent will refuse
-- to auto-apply anything that doesn't ship a revert (defense in depth
-- enforced in the route).
-- =====================================================================

-- 1) New columns on the audit log.
ALTER TABLE public.security_agent_log
  ADD COLUMN IF NOT EXISTS revert_sql   TEXT,
  ADD COLUMN IF NOT EXISTS reverted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reverted_by  UUID;

-- 2) Widen agent_apply_fix whitelist to also cover the revert shapes,
--    so the same gate enforces statement-level safety on rollback.
CREATE OR REPLACE FUNCTION public.agent_apply_fix(sql_to_run TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  trimmed TEXT := btrim(sql_to_run);
  upper_first TEXT := upper(left(trimmed, 80));
BEGIN
  IF NOT (
       upper_first LIKE 'ALTER TABLE PUBLIC.% ENABLE ROW LEVEL SECURITY%'
    OR upper_first LIKE 'ALTER TABLE PUBLIC.% DISABLE ROW LEVEL SECURITY%'
    OR upper_first LIKE 'ALTER FUNCTION PUBLIC.%SET SEARCH_PATH = PUBLIC, PG_CATALOG%'
    OR upper_first LIKE 'ALTER FUNCTION PUBLIC.%RESET SEARCH_PATH%'
  ) THEN
    RAISE EXCEPTION 'agent_apply_fix: statement not in whitelist (got: %)', left(trimmed, 100);
  END IF;
  EXECUTE trimmed;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_apply_fix(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_apply_fix(TEXT) TO service_role;

-- 3) Revert RPC. Reads the row, runs revert_sql via the gate, stamps the
--    reverted_at + reverted_by columns. Refuses to revert twice.
CREATE OR REPLACE FUNCTION public.agent_revert_fix(p_log_id UUID, p_actor UUID DEFAULT NULL)
RETURNS TABLE (id UUID, finding TEXT, reverted_at TIMESTAMPTZ, ran TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  row_revert  TEXT;
  row_action  TEXT;
  row_already TIMESTAMPTZ;
BEGIN
  SELECT sal.revert_sql, sal.action_taken, sal.reverted_at
    INTO row_revert, row_action, row_already
  FROM public.security_agent_log sal
  WHERE sal.id = p_log_id;

  IF row_revert IS NULL THEN
    RAISE EXCEPTION 'no revert_sql stored for log %', p_log_id;
  END IF;
  IF row_already IS NOT NULL THEN
    RAISE EXCEPTION 'log % already reverted at %', p_log_id, row_already;
  END IF;
  IF row_action <> 'auto_fixed' THEN
    RAISE EXCEPTION 'log % was not an auto_fixed entry (action=%)', p_log_id, row_action;
  END IF;

  PERFORM public.agent_apply_fix(row_revert);

  UPDATE public.security_agent_log
     SET reverted_at = NOW(),
         reverted_by = p_actor
   WHERE security_agent_log.id = p_log_id;

  RETURN QUERY
  SELECT sal.id, sal.finding, sal.reverted_at, row_revert
  FROM public.security_agent_log sal
  WHERE sal.id = p_log_id;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_revert_fix(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_revert_fix(UUID, UUID) TO service_role;

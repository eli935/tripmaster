-- =====================================================================
-- RPCs the security agent calls. SECURITY DEFINER + service_role only —
-- they bypass RLS but are not callable by anon / authenticated.
-- =====================================================================

-- 1) Tables in public schema without RLS enabled.
CREATE OR REPLACE FUNCTION public.agent_check_rls_disabled()
RETURNS TABLE (table_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.relname::TEXT
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity
  ORDER BY c.relname;
$$;
REVOKE ALL ON FUNCTION public.agent_check_rls_disabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_check_rls_disabled() TO service_role;

-- 2) SECURITY DEFINER functions in public with mutable search_path.
CREATE OR REPLACE FUNCTION public.agent_check_function_search_path()
RETURNS TABLE (function_name TEXT, arg_types TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    p.proname::TEXT,
    pg_get_function_identity_arguments(p.oid)::TEXT
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = TRUE
    AND p.proconfig IS NULL
  ORDER BY p.proname;
$$;
REVOKE ALL ON FUNCTION public.agent_check_function_search_path() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_check_function_search_path() TO service_role;

-- 3) Apply a fix. Whitelist of statement shapes only — prevents the agent
--    from accidentally running arbitrary SQL. Add new shapes here when we
--    want the agent to handle a new auto-fix pattern.
CREATE OR REPLACE FUNCTION public.agent_apply_fix(sql_to_run TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  trimmed TEXT := btrim(sql_to_run);
  upper_first TEXT := upper(left(trimmed, 64));
BEGIN
  IF NOT (
       upper_first LIKE 'ALTER TABLE PUBLIC.% ENABLE ROW LEVEL SECURITY%'
    OR upper_first LIKE 'ALTER FUNCTION PUBLIC.%SET SEARCH_PATH = PUBLIC, PG_CATALOG%'
  ) THEN
    RAISE EXCEPTION 'agent_apply_fix: statement not in whitelist (got: %)', left(trimmed, 100);
  END IF;
  EXECUTE trimmed;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_apply_fix(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_apply_fix(TEXT) TO service_role;

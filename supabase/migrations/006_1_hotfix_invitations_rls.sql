-- ═══════════════════════════════════════════════════════════════════
-- 006.1 · Hotfix — "permission denied for table users"
-- ═══════════════════════════════════════════════════════════════════
--
-- The SELECT policy on trip_invitations referenced auth.users directly.
-- Role `authenticated` cannot SELECT from auth.users by default, so the
-- policy check failed on both SELECT (list invitations) and INSERT
-- (PostgREST returns the inserted row, which evaluates the SELECT policy).
--
-- Fix: wrap auth.users access in a SECURITY DEFINER helper.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.my_email()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.my_email() TO anon, authenticated, service_role;

-- Replace the SELECT policy to use the helper instead of auth.users
DROP POLICY IF EXISTS trip_invitations_select ON public.trip_invitations;
CREATE POLICY trip_invitations_select ON public.trip_invitations
  FOR SELECT
  USING (
    public.is_trip_admin(trip_id)
    OR public.is_super_admin()
    OR email = public.my_email()
  );

NOTIFY pgrst, 'reload schema';

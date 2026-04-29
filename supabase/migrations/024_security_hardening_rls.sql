-- =====================================================================
-- Security hardening — triggered by Supabase advisor email (27 Apr 2026)
-- flagging 5 ERROR-level "rls_disabled_in_public" findings + a few WARNs.
-- =====================================================================

-- 1. flight_status_log — read=member, write=service role (cron only)
ALTER TABLE public.flight_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flight_status_log_select_member ON public.flight_status_log;
CREATE POLICY flight_status_log_select_member
  ON public.flight_status_log FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id));

-- 2. meal_attendance — member of the meal's trip (joined via meals→trip_days)
ALTER TABLE public.meal_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meal_attendance_member_read ON public.meal_attendance;
CREATE POLICY meal_attendance_member_read
  ON public.meal_attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.trip_days d ON d.id = m.trip_day_id
      WHERE m.id = meal_attendance.meal_id
        AND public.is_trip_member(d.trip_id)
    )
  );
DROP POLICY IF EXISTS meal_attendance_member_write ON public.meal_attendance;
CREATE POLICY meal_attendance_member_write
  ON public.meal_attendance FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.trip_days d ON d.id = m.trip_day_id
      WHERE m.id = meal_attendance.meal_id
        AND public.is_trip_member(d.trip_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.trip_days d ON d.id = m.trip_day_id
      WHERE m.id = meal_attendance.meal_id
        AND public.is_trip_member(d.trip_id)
    )
  );

-- 3. meal_recipes — member reads, creator writes
ALTER TABLE public.meal_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meal_recipes_member_read ON public.meal_recipes;
CREATE POLICY meal_recipes_member_read
  ON public.meal_recipes FOR SELECT TO authenticated
  USING (trip_id IS NULL OR public.is_trip_member(trip_id));
DROP POLICY IF EXISTS meal_recipes_member_insert ON public.meal_recipes;
CREATE POLICY meal_recipes_member_insert
  ON public.meal_recipes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (trip_id IS NULL OR public.is_trip_member(trip_id))
  );
DROP POLICY IF EXISTS meal_recipes_creator_update ON public.meal_recipes;
CREATE POLICY meal_recipes_creator_update
  ON public.meal_recipes FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS meal_recipes_creator_delete ON public.meal_recipes;
CREATE POLICY meal_recipes_creator_delete
  ON public.meal_recipes FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- 4. trip_recommendations — destination-keyed, signed-in read, service-role write
ALTER TABLE public.trip_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_recommendations_authenticated_read ON public.trip_recommendations;
CREATE POLICY trip_recommendations_authenticated_read
  ON public.trip_recommendations FOR SELECT TO authenticated
  USING (true);

-- 5. trip_todos — member can do anything within their trip
ALTER TABLE public.trip_todos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_todos_member_all ON public.trip_todos;
CREATE POLICY trip_todos_member_all
  ON public.trip_todos FOR ALL TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));

-- 6. is_email_registered() — was created in migration 022, advisor flagged
--    that anon/authenticated could call it. Lock to service_role only.
REVOKE EXECUTE ON FUNCTION public.is_email_registered(TEXT) FROM anon, authenticated;

-- 7. function_search_path_mutable — pin search_path on the two flagged funcs
ALTER FUNCTION public.lowercase_invitation_email() SET search_path = public, pg_catalog;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_catalog;

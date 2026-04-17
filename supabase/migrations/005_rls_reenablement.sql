-- =====================================================================
-- Migration 005: RLS Re-enablement for TripMaster
-- =====================================================================
-- Re-enables Row Level Security on all 18 tables using SECURITY DEFINER
-- helper functions to avoid the recursion issues that previously forced
-- RLS to be disabled.
--
-- Strategy:
--   1. SECURITY DEFINER helpers bypass RLS -> no self-reference recursion
--   2. Policies are wrapped in DROP IF EXISTS + CREATE for idempotency
--   3. service_role is never restricted (Supabase bypasses RLS for it,
--      but we also add permissive policies as belt-and-suspenders)
--   4. anon/authenticated roles get granular policies per table type
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 1: SECURITY DEFINER HELPER FUNCTIONS
-- ---------------------------------------------------------------------
-- These functions run with the privileges of their owner (postgres)
-- and bypass RLS. This is the ONLY safe way to query a table from
-- within its own policy without triggering infinite recursion.
-- ---------------------------------------------------------------------

-- Returns the current authenticated user's profile id (auth.uid()).
-- Wrapper kept for readability and future-proofing.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid();
$$;

-- Checks whether the current user is a super admin.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- Checks whether the current user participates in a given trip.
-- SECURITY DEFINER means this query does NOT go through RLS on
-- trip_participants, which is what broke the previous attempt.
CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id
      AND tp.profile_id = auth.uid()
  ) OR public.is_super_admin();
$$;

-- Checks whether the current user has admin-level role on a trip.
-- Used for audit_log and other admin-only surfaces.
CREATE OR REPLACE FUNCTION public.is_trip_admin(p_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Our schema uses roles: 'admin', 'manager', 'member', 'viewer'
  -- Admin has full trip control. Also allow trips.created_by = user.
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id
      AND tp.profile_id = auth.uid()
      AND tp.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = p_trip_id AND t.created_by = auth.uid()
  ) OR public.is_super_admin();
$$;

-- Returns all trip_ids the current user participates in.
-- Used by profiles policy (to show co-participants' profiles).
CREATE OR REPLACE FUNCTION public.my_trip_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT trip_id FROM public.trip_participants WHERE profile_id = auth.uid();
$$;

-- Returns all profile_ids that share at least one trip with the current user.
CREATE OR REPLACE FUNCTION public.my_co_participant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT tp.profile_id
  FROM public.trip_participants tp
  WHERE tp.trip_id IN (SELECT public.my_trip_ids());
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_id()   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin()       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trip_member(UUID)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trip_admin(UUID)    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_trip_ids()          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_co_participant_ids() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- SECTION 2: ENABLE RLS ON ALL 18 TABLES
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_equipment        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_days             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_payers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons_learned       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations_cache    ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- SECTION 3: DROP EXISTING POLICIES (idempotent re-run)
-- ---------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','trips','trip_participants','trip_permissions',
        'equipment_templates','trip_equipment','trip_days','meals',
        'meal_items','shopping_items','expenses','expense_payers',
        'expense_splits','trip_files','trip_messages','lessons_learned',
        'audit_log','app_versions','destinations_cache'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- SECTION 4: SERVICE ROLE BYPASS (belt-and-suspenders)
-- Every table gets a permissive service_role policy so server-side code
-- (edge functions, admin scripts) never gets filtered.
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','trips','trip_participants','trip_permissions',
    'equipment_templates','trip_equipment','trip_days','meals',
    'meal_items','shopping_items','expenses','expense_payers',
    'expense_splits','trip_files','trip_messages','lessons_learned',
    'audit_log','app_versions','destinations_cache'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY service_role_all ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- SECTION 5: POLICIES PER TABLE (authenticated role)
-- ---------------------------------------------------------------------

-- profiles --------------------------------------------------------------
-- SELECT: self + super_admin + anyone who shares a trip with me
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR id IN (SELECT public.my_co_participant_ids())
  );

-- INSERT: users only create their own profile row
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- UPDATE: self or super admin
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- DELETE: super admin only
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- trips -----------------------------------------------------------------
CREATE POLICY trips_select ON public.trips
  FOR SELECT TO authenticated
  USING (public.is_trip_member(id));

CREATE POLICY trips_insert ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY trips_update ON public.trips
  FOR UPDATE TO authenticated
  USING (public.is_trip_admin(id))
  WITH CHECK (public.is_trip_admin(id));

CREATE POLICY trips_delete ON public.trips
  FOR DELETE TO authenticated
  USING (public.is_trip_admin(id));

-- trip_participants -----------------------------------------------------
-- CRITICAL: this is the table that caused the original recursion.
-- We use SECURITY DEFINER helpers that bypass RLS, so no loop.
CREATE POLICY trip_participants_select ON public.trip_participants
  FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id));

CREATE POLICY trip_participants_insert ON public.trip_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_trip_admin(trip_id)
    OR NOT EXISTS (SELECT 1 FROM public.trip_participants WHERE trip_id = trip_participants.trip_id)
  );

CREATE POLICY trip_participants_update ON public.trip_participants
  FOR UPDATE TO authenticated
  USING (public.is_trip_admin(trip_id))
  WITH CHECK (public.is_trip_admin(trip_id));

CREATE POLICY trip_participants_delete ON public.trip_participants
  FOR DELETE TO authenticated
  USING (public.is_trip_admin(trip_id) OR profile_id = auth.uid());

-- trip_permissions ------------------------------------------------------
CREATE POLICY trip_permissions_select ON public.trip_permissions
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY trip_permissions_insert ON public.trip_permissions
  FOR INSERT TO authenticated WITH CHECK (public.is_trip_admin(trip_id));
CREATE POLICY trip_permissions_update ON public.trip_permissions
  FOR UPDATE TO authenticated
  USING (public.is_trip_admin(trip_id))
  WITH CHECK (public.is_trip_admin(trip_id));
CREATE POLICY trip_permissions_delete ON public.trip_permissions
  FOR DELETE TO authenticated USING (public.is_trip_admin(trip_id));

-- equipment_templates (PUBLIC SEED DATA) -------------------------------
CREATE POLICY equipment_templates_select ON public.equipment_templates
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY equipment_templates_write ON public.equipment_templates
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- trip_equipment --------------------------------------------------------
CREATE POLICY trip_equipment_select ON public.trip_equipment
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY trip_equipment_insert ON public.trip_equipment
  FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY trip_equipment_update ON public.trip_equipment
  FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY trip_equipment_delete ON public.trip_equipment
  FOR DELETE TO authenticated USING (public.is_trip_member(trip_id));

-- trip_days -------------------------------------------------------------
CREATE POLICY trip_days_select ON public.trip_days
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY trip_days_insert ON public.trip_days
  FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY trip_days_update ON public.trip_days
  FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY trip_days_delete ON public.trip_days
  FOR DELETE TO authenticated USING (public.is_trip_member(trip_id));

-- meals (FK -> trip_days.trip_id) --------------------------------------
CREATE POLICY meals_select ON public.meals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_days d
                 WHERE d.id = meals.trip_day_id
                   AND public.is_trip_member(d.trip_id)));
CREATE POLICY meals_insert ON public.meals
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.trip_days d
                      WHERE d.id = meals.trip_day_id
                        AND public.is_trip_member(d.trip_id)));
CREATE POLICY meals_update ON public.meals
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_days d
                 WHERE d.id = meals.trip_day_id
                   AND public.is_trip_member(d.trip_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trip_days d
                      WHERE d.id = meals.trip_day_id
                        AND public.is_trip_member(d.trip_id)));
CREATE POLICY meals_delete ON public.meals
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_days d
                 WHERE d.id = meals.trip_day_id
                   AND public.is_trip_member(d.trip_id)));

-- meal_items (FK -> meals.trip_day_id -> trip_days.trip_id) ------------
CREATE POLICY meal_items_select ON public.meal_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m
                 JOIN public.trip_days d ON d.id = m.trip_day_id
                 WHERE m.id = meal_items.meal_id
                   AND public.is_trip_member(d.trip_id)));
CREATE POLICY meal_items_insert ON public.meal_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.meals m
                      JOIN public.trip_days d ON d.id = m.trip_day_id
                      WHERE m.id = meal_items.meal_id
                        AND public.is_trip_member(d.trip_id)));
CREATE POLICY meal_items_update ON public.meal_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m
                 JOIN public.trip_days d ON d.id = m.trip_day_id
                 WHERE m.id = meal_items.meal_id
                   AND public.is_trip_member(d.trip_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meals m
                      JOIN public.trip_days d ON d.id = m.trip_day_id
                      WHERE m.id = meal_items.meal_id
                        AND public.is_trip_member(d.trip_id)));
CREATE POLICY meal_items_delete ON public.meal_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m
                 JOIN public.trip_days d ON d.id = m.trip_day_id
                 WHERE m.id = meal_items.meal_id
                   AND public.is_trip_member(d.trip_id)));

-- shopping_items --------------------------------------------------------
CREATE POLICY shopping_items_select ON public.shopping_items
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY shopping_items_insert ON public.shopping_items
  FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY shopping_items_update ON public.shopping_items
  FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY shopping_items_delete ON public.shopping_items
  FOR DELETE TO authenticated USING (public.is_trip_member(trip_id));

-- expenses --------------------------------------------------------------
CREATE POLICY expenses_select ON public.expenses
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY expenses_update ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY expenses_delete ON public.expenses
  FOR DELETE TO authenticated USING (public.is_trip_member(trip_id));

-- expense_payers --------------------------------------------------------
CREATE POLICY expense_payers_select ON public.expense_payers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                 WHERE e.id = expense_payers.expense_id
                   AND public.is_trip_member(e.trip_id)));
CREATE POLICY expense_payers_insert ON public.expense_payers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e
                      WHERE e.id = expense_payers.expense_id
                        AND public.is_trip_member(e.trip_id)));
CREATE POLICY expense_payers_update ON public.expense_payers
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                 WHERE e.id = expense_payers.expense_id
                   AND public.is_trip_member(e.trip_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e
                      WHERE e.id = expense_payers.expense_id
                        AND public.is_trip_member(e.trip_id)));
CREATE POLICY expense_payers_delete ON public.expense_payers
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                 WHERE e.id = expense_payers.expense_id
                   AND public.is_trip_member(e.trip_id)));

-- expense_splits --------------------------------------------------------
CREATE POLICY expense_splits_select ON public.expense_splits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                 WHERE e.id = expense_splits.expense_id
                   AND public.is_trip_member(e.trip_id)));
CREATE POLICY expense_splits_insert ON public.expense_splits
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e
                      WHERE e.id = expense_splits.expense_id
                        AND public.is_trip_member(e.trip_id)));
CREATE POLICY expense_splits_update ON public.expense_splits
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                 WHERE e.id = expense_splits.expense_id
                   AND public.is_trip_member(e.trip_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e
                      WHERE e.id = expense_splits.expense_id
                        AND public.is_trip_member(e.trip_id)));
CREATE POLICY expense_splits_delete ON public.expense_splits
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                 WHERE e.id = expense_splits.expense_id
                   AND public.is_trip_member(e.trip_id)));

-- trip_files ------------------------------------------------------------
CREATE POLICY trip_files_select ON public.trip_files
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY trip_files_insert ON public.trip_files
  FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY trip_files_update ON public.trip_files
  FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY trip_files_delete ON public.trip_files
  FOR DELETE TO authenticated USING (public.is_trip_member(trip_id));

-- trip_messages ---------------------------------------------------------
CREATE POLICY trip_messages_select ON public.trip_messages
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY trip_messages_insert ON public.trip_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_member(trip_id) AND sender_id = auth.uid());
CREATE POLICY trip_messages_update ON public.trip_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.is_trip_admin(trip_id))
  WITH CHECK (sender_id = auth.uid() OR public.is_trip_admin(trip_id));
CREATE POLICY trip_messages_delete ON public.trip_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_trip_admin(trip_id));

-- lessons_learned -------------------------------------------------------
CREATE POLICY lessons_learned_select ON public.lessons_learned
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id));
CREATE POLICY lessons_learned_insert ON public.lessons_learned
  FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY lessons_learned_update ON public.lessons_learned
  FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));
CREATE POLICY lessons_learned_delete ON public.lessons_learned
  FOR DELETE TO authenticated USING (public.is_trip_admin(trip_id));

-- audit_log (ADMIN-ONLY READ, server-only write) -----------------------
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    trip_id IS NULL AND public.is_super_admin()
    OR trip_id IS NOT NULL AND public.is_trip_admin(trip_id)
  );
-- No INSERT/UPDATE/DELETE policies for non-service-role; audit writes
-- should go through service_role (triggers / edge functions).

-- app_versions (PUBLIC CHANGELOG) --------------------------------------
CREATE POLICY app_versions_select ON public.app_versions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_versions_write ON public.app_versions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- destinations_cache (PUBLIC READ) -------------------------------------
CREATE POLICY destinations_cache_select ON public.destinations_cache
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY destinations_cache_write ON public.destinations_cache
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------
-- SECTION 6: SUPPORTING INDEXES (performance — avoid N+1 on policies)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_trip_participants_profile_trip
  ON public.trip_participants (profile_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_participants_trip_profile
  ON public.trip_participants (trip_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_meals_trip_day
  ON public.meals (trip_day_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal
  ON public.meal_items (meal_id);
CREATE INDEX IF NOT EXISTS idx_expense_payers_expense
  ON public.expense_payers (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense
  ON public.expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip
  ON public.trip_days (trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip
  ON public.expenses (trip_id);

-- =====================================================================
-- END OF MIGRATION 005
-- =====================================================================

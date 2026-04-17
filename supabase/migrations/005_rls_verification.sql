-- =====================================================================
-- Migration 005 Verification Script
-- =====================================================================
-- Run AFTER 005_rls_reenablement.sql to confirm policies are active and
-- behave correctly. Run as postgres/service_role first for inventory,
-- then use SET LOCAL ROLE + request.jwt.claim.sub to simulate users.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. INVENTORY: confirm RLS is enabled on all 18 tables
-- ---------------------------------------------------------------------
SELECT tablename,
       rowsecurity AS rls_enabled,
       (SELECT COUNT(*) FROM pg_policies p
        WHERE p.schemaname='public' AND p.tablename=t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','trips','trip_participants','trip_permissions',
    'equipment_templates','trip_equipment','trip_days','meals',
    'meal_items','shopping_items','expenses','expense_payers',
    'expense_splits','trip_files','trip_messages','lessons_learned',
    'audit_log','app_versions','destinations_cache'
  )
ORDER BY tablename;
-- EXPECTED: rls_enabled = true for all 18 rows; policy_count >= 2 each.

-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS EXIST AND ARE SECURITY DEFINER
-- ---------------------------------------------------------------------
SELECT proname, prosecdef AS is_security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('is_super_admin','is_trip_member','is_trip_admin',
                  'my_trip_ids','my_co_participant_ids','current_profile_id');
-- EXPECTED: all 6 rows with is_security_definer = true.

-- ---------------------------------------------------------------------
-- 3. SUPER ADMIN CAN SEE EVERYTHING
-- ---------------------------------------------------------------------
-- Simulate Eli's session:
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '2a1703fb-5b5e-4a22-b16a-943ffbd3ef2e';

SELECT 'trips'              AS t, COUNT(*) FROM public.trips
UNION ALL SELECT 'participants',   COUNT(*) FROM public.trip_participants
UNION ALL SELECT 'profiles',       COUNT(*) FROM public.profiles
UNION ALL SELECT 'expenses',       COUNT(*) FROM public.expenses
UNION ALL SELECT 'audit_log',      COUNT(*) FROM public.audit_log
UNION ALL SELECT 'app_versions',   COUNT(*) FROM public.app_versions;
-- EXPECTED: counts match unrestricted totals (run same queries as
--           service_role first to compare).
RESET ROLE;

-- ---------------------------------------------------------------------
-- 4. REGULAR USER — scoped to their trips only
-- ---------------------------------------------------------------------
-- Replace <regular_user_uuid> with a real non-admin profile id that
-- participates in at least one trip.
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '<regular_user_uuid>';
--
-- -- Should return ONLY trips they participate in:
-- SELECT id, name FROM public.trips;
--
-- -- Should return trip_participants rows only for their trips:
-- SELECT trip_id, profile_id, role FROM public.trip_participants;
--
-- -- Should return their own profile + co-participants' profiles:
-- SELECT id, display_name FROM public.profiles;
--
-- -- audit_log should be empty unless they are trip admin:
-- SELECT COUNT(*) FROM public.audit_log;
-- RESET ROLE;

-- ---------------------------------------------------------------------
-- 5. NON-MEMBER — should see ZERO rows, not errors
-- ---------------------------------------------------------------------
-- Pick a user id that is not a super_admin and not in any trip, or
-- create a throwaway profile. Verify no recursion / permission errors.
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '<isolated_user_uuid>';
--
-- SELECT COUNT(*) AS should_be_zero FROM public.trips;
-- SELECT COUNT(*) AS should_be_zero FROM public.trip_participants;
-- SELECT COUNT(*) AS should_be_zero FROM public.expenses;
-- SELECT COUNT(*) AS should_be_zero FROM public.audit_log;
--
-- -- Public tables must STILL be readable:
-- SELECT COUNT(*) AS should_be_nonzero FROM public.app_versions;
-- SELECT COUNT(*) AS should_be_nonzero FROM public.destinations_cache;
-- SELECT COUNT(*) AS should_be_nonzero FROM public.equipment_templates;
-- RESET ROLE;

-- ---------------------------------------------------------------------
-- 6. RECURSION SMOKE TEST — the original bug
-- ---------------------------------------------------------------------
-- Before the fix, this query produced:
--   ERROR: infinite recursion detected in policy for relation "trip_participants"
-- After the fix it should return rows (or zero rows) with NO error.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '2a1703fb-5b5e-4a22-b16a-943ffbd3ef2e';
SELECT COUNT(*) AS participants_visible FROM public.trip_participants;
RESET ROLE;

-- ---------------------------------------------------------------------
-- 7. PERFORMANCE — confirm index usage on the hot path
-- ---------------------------------------------------------------------
-- Check that the lookup used inside is_trip_member() uses the composite
-- index rather than a seq scan.
EXPLAIN (ANALYZE, BUFFERS)
SELECT 1 FROM public.trip_participants
WHERE trip_id = (SELECT id FROM public.trips LIMIT 1)
  AND profile_id = '2a1703fb-5b5e-4a22-b16a-943ffbd3ef2e';
-- EXPECTED: Index Scan using idx_trip_participants_trip_profile
--           (NOT Seq Scan).

-- ---------------------------------------------------------------------
-- 8. POLICY COUNT BY TABLE (sanity)
-- ---------------------------------------------------------------------
SELECT tablename, cmd, COUNT(*) AS policies
FROM pg_policies
WHERE schemaname='public'
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- =====================================================================
-- END OF VERIFICATION
-- =====================================================================

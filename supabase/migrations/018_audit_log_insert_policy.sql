-- ═══════════════════════════════════════════════════════════════════
-- 018 · audit_log INSERT policy for trip members
-- Historical gap: audit_log had SELECT policy but no INSERT policy, so
-- every client-side soft-delete log attempt was silently denied by RLS.
-- This only affected logging, not the deletes themselves, but we do want
-- the audit trail populated going forward.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  CREATE POLICY "audit_log_insert_trip_members"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (
      -- System rows (no trip) — only super admin
      (trip_id IS NULL AND public.is_super_admin())
      OR
      -- Trip-scoped rows — any trip member can write their own actions
      (trip_id IS NOT NULL AND public.is_trip_member(trip_id) AND actor_id = auth.uid())
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

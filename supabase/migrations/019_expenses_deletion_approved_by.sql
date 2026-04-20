-- ═══════════════════════════════════════════════════════════════════
-- 019 · Fix missing expenses.deletion_approved_by column
-- Migration 004_advanced.sql was supposed to add this column but it
-- didn't land on the live DB (schema drift). Result: every attempt to
-- soft-delete an expense from the UI failed with
-- "Could not find the 'deletion_approved_by' column of 'expenses' in
-- the schema cache" (PostgREST error).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS deletion_approved_by UUID REFERENCES public.profiles(id);

-- Nudge PostgREST to reload its schema cache so the column is visible
-- to the API layer immediately (without a manual dashboard refresh).
NOTIFY pgrst, 'reload schema';

COMMIT;

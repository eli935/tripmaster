-- ═══════════════════════════════════════════════════════════════════
-- 020 · Prevent duplicate meals per day
-- After running manual de-dup from stage-21, add a unique constraint so
-- repeated "אמץ" clicks can't create duplicates going forward.
-- The app already de-dups in code (adoptedMealKeys Set), but DB-level
-- enforcement is the belt to the suspenders.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  ALTER TABLE public.meals
    ADD CONSTRAINT meals_unique_per_day_type_name
    UNIQUE (trip_day_id, meal_type, name);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- 014 · Plan snapshots (Phase 3 of Full Planning Wizard)
-- שומר היסטוריה של תוכניות AI קודמות ליכולת undo/השוואה.
--
-- כל ריצה של wizard יוצרת snapshot (trip_id + preferences + all days' plans).
-- ניתן לשחזר snapshot קודם ב-click.
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES public.profiles(id),
  preferences    JSONB NOT NULL DEFAULT '{}'::jsonb,
  days_payload   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{day_id, items}]
  label          TEXT,                                -- auto ("ריצה #3") or user-given
  total_items    INT
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_trip_created
  ON public.plan_snapshots(trip_id, created_at DESC);

ALTER TABLE public.plan_snapshots ENABLE ROW LEVEL SECURITY;

-- Read: trip participants can read the trip's snapshots
DO $$
BEGIN
  CREATE POLICY "plan_snapshots_read_trip_members"
    ON public.plan_snapshots FOR SELECT
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.trip_participants tp
      WHERE tp.trip_id = plan_snapshots.trip_id
        AND tp.profile_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = plan_snapshots.trip_id AND t.created_by = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insert: same access as read
DO $$
BEGIN
  CREATE POLICY "plan_snapshots_insert_trip_members"
    ON public.plan_snapshots FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.trip_participants tp
      WHERE tp.trip_id = plan_snapshots.trip_id
        AND tp.profile_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = plan_snapshots.trip_id AND t.created_by = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

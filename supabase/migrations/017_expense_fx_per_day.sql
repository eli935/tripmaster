-- 017_expense_fx_per_day.sql
-- Per-day FX rates for expenses. Every expense records the *business* date
-- it occurred on and the FX rate as of that date, so a multi-week trip
-- doesn't convert all its foreign-currency expenses with one stale snapshot.
--
-- Safe to run repeatedly (IF NOT EXISTS / IF EXISTS guards).

-- 1. Add columns to expenses ---------------------------------------------

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS fx_rate_to_ils NUMERIC(12, 6);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS fx_locked_at   TIMESTAMPTZ;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_date   DATE;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;

-- Backfill expense_date from created_at for legacy rows.
UPDATE public.expenses
   SET expense_date = created_at::date
 WHERE expense_date IS NULL;

-- After backfill, default future inserts to today if caller omits the field.
-- We intentionally don't set NOT NULL yet — the backfill endpoint handles
-- any remaining edge cases.
ALTER TABLE public.expenses
  ALTER COLUMN expense_date SET DEFAULT (now() AT TIME ZONE 'Asia/Jerusalem')::date;

CREATE INDEX IF NOT EXISTS idx_expenses_expense_date
  ON public.expenses(expense_date);

-- 2. Daily FX cache ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.daily_fx_rates (
  date       DATE        NOT NULL,
  base       TEXT        NOT NULL,
  target     TEXT        NOT NULL,
  rate       NUMERIC(14, 6) NOT NULL,
  rate_date  DATE        NOT NULL,  -- the day Frankfurter actually priced
                                     -- (weekends fall back to prior biz day)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, base, target)
);

CREATE INDEX IF NOT EXISTS idx_daily_fx_rates_lookup
  ON public.daily_fx_rates(base, target, date DESC);

-- Cache is public-read (no PII), server-write only.
ALTER TABLE public.daily_fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_fx_rates_read ON public.daily_fx_rates;
CREATE POLICY daily_fx_rates_read ON public.daily_fx_rates
  FOR SELECT TO authenticated, anon
  USING (true);

-- No INSERT/UPDATE/DELETE policy → only service_role can write.

COMMENT ON TABLE public.daily_fx_rates IS
  'Cache of Frankfurter.app daily rates. (base, target, date) unique. '
  'rate_date is what Frankfurter returned — on weekends/holidays this is '
  'the prior business day.';

COMMENT ON COLUMN public.expenses.expense_date IS
  'Business date of the expense. Defaults to created_at::date; user can '
  'backdate to align with receipts and local FX reality.';

COMMENT ON COLUMN public.expenses.fx_rate_date IS
  'Which day''s FX rate (from daily_fx_rates) was applied. Usually equals '
  'expense_date; on weekends this is the prior business day Frankfurter '
  'returned.';

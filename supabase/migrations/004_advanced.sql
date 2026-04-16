-- === Multi-Payer Expenses + Soft Delete + Audit Log + Chat + Versions ===

-- 1. Expense payers (1 expense → many payers with different amounts)
CREATE TABLE IF NOT EXISTS expense_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(expense_id, profile_id)
);
ALTER TABLE expense_payers DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_expense_payers_expense ON expense_payers(expense_id);

-- Migrate existing expenses: copy paid_by/amount into expense_payers
INSERT INTO expense_payers (expense_id, profile_id, amount)
SELECT id, paid_by, amount FROM expenses
WHERE NOT EXISTS (
  SELECT 1 FROM expense_payers ep WHERE ep.expense_id = expenses.id
)
ON CONFLICT DO NOTHING;

-- 2. Soft delete columns on major tables
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deletion_approved BOOLEAN;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deletion_approved_by UUID REFERENCES profiles(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS deletion_approved BOOLEAN;

ALTER TABLE trip_equipment ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE trip_equipment ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE trip_equipment ADD COLUMN IF NOT EXISTS deletion_approved BOOLEAN;

ALTER TABLE meals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE meals ADD COLUMN IF NOT EXISTS deletion_approved BOOLEAN;

ALTER TABLE trip_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE trip_files ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE trip_files ADD COLUMN IF NOT EXISTS deletion_approved BOOLEAN;

-- 3. Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete_request','delete_approve','delete_reject','restore')),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  old_data JSONB,
  new_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_trip ON audit_log(trip_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- 4. Trip chat
CREATE TABLE IF NOT EXISTS trip_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  reply_to UUID REFERENCES trip_messages(id),
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE trip_messages DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trip_messages_trip ON trip_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_messages_created ON trip_messages(trip_id, created_at DESC);

-- 5. App versions (changelog)
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  changes JSONB,
  git_sha TEXT,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_by UUID REFERENCES profiles(id)
);
ALTER TABLE app_versions DISABLE ROW LEVEL SECURITY;

-- Seed some past versions
INSERT INTO app_versions (version, title, description, changes) VALUES
  ('v1.0', 'השקה ראשונית', 'פתיחת TripMaster עם תכנון טיולים בסיסי', '["טיולים","משתתפים","ציוד","קניות"]'::jsonb),
  ('v2.0', 'נתוני אמת מהגוגל שיטס', 'מחקנו הוצאות מדומות והזנו נתונים אמיתיים', '["45 הוצאות אמיתיות","חלוקה לפי נפש"]'::jsonb),
  ('v3.0', 'Dark Theme', 'המרה מלאה לעיצוב כהה מובילי', '["dark mode","glass morphism","animations"]'::jsonb),
  ('v4.0', 'Premium + קבצים', 'עיצוב בסגנון wearebrand.io + מערכת קבצים', '["premium login","file upload","categories"]'::jsonb),
  ('v5.0', 'אנימציות', 'framer-motion אנימציות מלאות', '["page transitions","stagger","hover effects"]'::jsonb),
  ('v6.0', 'מודיעין יעד', 'חב״ד, מסעדות, אטרקציות, מטבע חי', '["מונטנגרו/רומא/אתונה","Chabad","currency"]'::jsonb),
  ('v7.0', 'הרשאות', 'מערכת תפקידים מלאה עם 16 הרשאות פרטניות', '["admin/manager/member/viewer","granular perms"]'::jsonb),
  ('v8.0', 'מהירות + ריבוי משלמים + לוגים', 'שיפורי ביצועים + multi-payer + soft delete + chat', '["parallel queries","multi-payer","audit log","trip chat","version history"]'::jsonb)
ON CONFLICT DO NOTHING;

SELECT 'v8 migration complete' as status;

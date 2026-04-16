-- === Permissions System ===

-- 1. Add super_admin role on profiles (global)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Expand trip_participants role enum
ALTER TABLE trip_participants DROP CONSTRAINT IF EXISTS trip_participants_role_check;
ALTER TABLE trip_participants ADD CONSTRAINT trip_participants_role_check
  CHECK (role IN ('admin', 'manager', 'member', 'viewer'));

-- 3. Per-participant permissions (granular)
CREATE TABLE IF NOT EXISTS trip_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- What tabs/features user can see
  can_see_destination BOOLEAN NOT NULL DEFAULT true,
  can_see_overview BOOLEAN NOT NULL DEFAULT true,
  can_see_meals BOOLEAN NOT NULL DEFAULT true,
  can_see_equipment BOOLEAN NOT NULL DEFAULT true,
  can_see_shopping BOOLEAN NOT NULL DEFAULT true,
  can_see_expenses BOOLEAN NOT NULL DEFAULT true,
  can_see_files BOOLEAN NOT NULL DEFAULT true,
  can_see_lessons BOOLEAN NOT NULL DEFAULT true,
  can_see_other_expenses BOOLEAN NOT NULL DEFAULT true, -- see only own expenses or all
  -- What user can edit
  can_edit_trip BOOLEAN NOT NULL DEFAULT false,
  can_edit_participants BOOLEAN NOT NULL DEFAULT false,
  can_edit_meals BOOLEAN NOT NULL DEFAULT false,
  can_edit_equipment BOOLEAN NOT NULL DEFAULT false,
  can_edit_shopping BOOLEAN NOT NULL DEFAULT true,
  can_edit_expenses BOOLEAN NOT NULL DEFAULT true,
  can_upload_files BOOLEAN NOT NULL DEFAULT true,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, profile_id)
);

-- RLS disabled (matching other tables for now)
ALTER TABLE trip_permissions DISABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX IF NOT EXISTS idx_trip_permissions_trip ON trip_permissions(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_permissions_profile ON trip_permissions(profile_id);

-- 4. Set Eli as super_admin
UPDATE profiles SET is_super_admin = true WHERE id = '2a1703fb-5b5e-4a22-b16a-943ffbd3ef2e';

-- 5. Default permissions for existing participants (admin role = full access)
INSERT INTO trip_permissions (trip_id, profile_id, can_edit_trip, can_edit_participants, can_edit_meals, can_edit_equipment)
SELECT
  trip_id,
  profile_id,
  CASE WHEN role = 'admin' THEN true ELSE false END,
  CASE WHEN role = 'admin' THEN true ELSE false END,
  CASE WHEN role = 'admin' THEN true ELSE false END,
  CASE WHEN role = 'admin' THEN true ELSE false END
FROM trip_participants
ON CONFLICT (trip_id, profile_id) DO NOTHING;

SELECT 'Permissions system ready' as status;

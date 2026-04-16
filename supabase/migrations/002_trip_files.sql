-- Trip Files table for document management
CREATE TABLE IF NOT EXISTS trip_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS disabled for now (matching other tables)
ALTER TABLE trip_files DISABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_trip_files_trip ON trip_files(trip_id);

-- TripMaster Database Schema
-- Run this in Supabase SQL Editor

-- Profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  adults INTEGER NOT NULL DEFAULT 2,
  children JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trips
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (holiday_type IN ('pesach','sukkot','rosh_hashana','shavuot','regular')),
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','active','completed','review')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trip Participants
CREATE TABLE trip_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  adults INTEGER NOT NULL DEFAULT 2,
  children INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, profile_id)
);

-- Equipment Templates
CREATE TABLE equipment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_type TEXT NOT NULL DEFAULT 'regular',
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity_per_person REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'יח׳',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);

-- Trip Equipment
CREATE TABLE trip_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  template_id UUID REFERENCES equipment_templates(id),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','packed','loaded','arrived')),
  notes TEXT
);

-- Trip Days
CREATE TABLE trip_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hebrew_date TEXT NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('erev_chag','chag','shabbat','shabbat_chol_hamoed','chol_hamoed','chol')),
  notes TEXT,
  UNIQUE(trip_id, date)
);

-- Meals
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  servings INTEGER NOT NULL DEFAULT 0
);

-- Meal Items (ingredients)
CREATE TABLE meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  ingredient TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'יח׳',
  category TEXT NOT NULL DEFAULT 'other'
);

-- Shopping Items
CREATE TABLE shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  ingredient TEXT NOT NULL,
  total_quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  is_purchased BOOLEAN NOT NULL DEFAULT false,
  purchased_by UUID REFERENCES profiles(id),
  price DECIMAL(10,2),
  purchased_at TIMESTAMPTZ
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ILS',
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  split_type TEXT NOT NULL DEFAULT 'equal'
    CHECK (split_type IN ('equal','per_person','custom','private')),
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expense Splits (for custom splits)
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL
);

-- Lessons Learned
CREATE TABLE lessons_learned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  action TEXT,
  item_ref TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons_learned ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update own
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Trips: participants can read, creator can update/delete
CREATE POLICY "Trips viewable by participants"
  ON trips FOR SELECT TO authenticated
  USING (id IN (SELECT trip_id FROM trip_participants WHERE profile_id = auth.uid()));
CREATE POLICY "Authenticated users can create trips"
  ON trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Trip creator can update"
  ON trips FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Participants: trip members can view, admins can manage
CREATE POLICY "Participants viewable by trip members"
  ON trip_participants FOR SELECT TO authenticated
  USING (trip_id IN (SELECT trip_id FROM trip_participants WHERE profile_id = auth.uid()));
CREATE POLICY "Trip admins can manage participants"
  ON trip_participants FOR ALL TO authenticated
  USING (trip_id IN (
    SELECT trip_id FROM trip_participants
    WHERE profile_id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "Users can join trips"
  ON trip_participants FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Equipment templates: readable by all authenticated
ALTER TABLE equipment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipment templates readable by all"
  ON equipment_templates FOR SELECT TO authenticated USING (true);

-- Trip-scoped tables: accessible by trip participants
CREATE POLICY "Trip equipment by participants"
  ON trip_equipment FOR ALL TO authenticated
  USING (trip_id IN (SELECT trip_id FROM trip_participants WHERE profile_id = auth.uid()));
CREATE POLICY "Trip days by participants"
  ON trip_days FOR ALL TO authenticated
  USING (trip_id IN (SELECT trip_id FROM trip_participants WHERE profile_id = auth.uid()));
CREATE POLICY "Meals by trip participants"
  ON meals FOR ALL TO authenticated
  USING (trip_day_id IN (
    SELECT td.id FROM trip_days td
    JOIN trip_participants tp ON tp.trip_id = td.trip_id
    WHERE tp.profile_id = auth.uid()
  ));
CREATE POLICY "Meal items by trip participants"
  ON meal_items FOR ALL TO authenticated
  USING (meal_id IN (
    SELECT m.id FROM meals m
    JOIN trip_days td ON td.id = m.trip_day_id
    JOIN trip_participants tp ON tp.trip_id = td.trip_id
    WHERE tp.profile_id = auth.uid()
  ));
CREATE POLICY "Shopping items by participants"
  ON shopping_items FOR ALL TO authenticated
  USING (trip_id IN (SELECT trip_id FROM trip_participants WHERE profile_id = auth.uid()));
CREATE POLICY "Expenses by participants"
  ON expenses FOR ALL TO authenticated
  USING (trip_id IN (SELECT trip_id FROM trip_participants WHERE profile_id = auth.uid()));
CREATE POLICY "Expense splits by participants"
  ON expense_splits FOR ALL TO authenticated
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN trip_participants tp ON tp.trip_id = e.trip_id
    WHERE tp.profile_id = auth.uid()
  ));
CREATE POLICY "Lessons by participants"
  ON lessons_learned FOR ALL TO authenticated
  USING (trip_id IN (SELECT trip_id FROM trip_participants WHERE profile_id = auth.uid()));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'משתמש חדש'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Indexes
CREATE INDEX idx_trip_participants_trip ON trip_participants(trip_id);
CREATE INDEX idx_trip_participants_profile ON trip_participants(profile_id);
CREATE INDEX idx_trip_days_trip ON trip_days(trip_id);
CREATE INDEX idx_meals_day ON meals(trip_day_id);
CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_shopping_trip ON shopping_items(trip_id);

-- Seed equipment templates for Pesach
INSERT INTO equipment_templates (holiday_type, name, category, quantity_per_person, unit, is_shared, notes) VALUES
  ('pesach', 'תנור נייד', 'מטבח', 0, 'יח׳', true, 'אחד לכל הקבוצה'),
  ('pesach', 'מעבד מזון', 'מטבח', 0, 'יח׳', true, NULL),
  ('pesach', 'פלטה חשמלית', 'מטבח', 0, 'יח׳', true, NULL),
  ('pesach', 'קומקום חשמלי', 'מטבח', 0, 'יח׳', true, NULL),
  ('pesach', 'סירים', 'מטבח', 0.5, 'יח׳', false, 'סיר לכל 2 נפשות'),
  ('pesach', 'מחבתות', 'מטבח', 0.3, 'יח׳', false, NULL),
  ('pesach', 'צלחות', 'כלי אוכל', 1, 'יח׳', false, 'צלחת לכל נפש'),
  ('pesach', 'סכום', 'כלי אוכל', 1, 'סט', false, 'סט לכל נפש'),
  ('pesach', 'כוסות', 'כלי אוכל', 2, 'יח׳', false, '2 לכל נפש'),
  ('pesach', 'מפות שולחן', 'שולחן', 0.2, 'יח׳', false, NULL),
  ('pesach', 'נייר כסף', 'מטבח', 0.5, 'גליל', false, NULL),
  ('pesach', 'נייר אפייה', 'מטבח', 0.3, 'גליל', false, NULL),
  ('pesach', 'מצות שמורות', 'אוכל פסח', 3, 'ק"ג', false, '3 ק"ג לנפש'),
  ('pesach', 'יין לארבע כוסות', 'אוכל פסח', 1.5, 'בקבוק', false, NULL),
  ('pesach', 'הגדות', 'ליל הסדר', 1, 'יח׳', false, 'הגדה לכל מבוגר'),
  ('pesach', 'קערת סדר', 'ליל הסדר', 0, 'יח׳', true, 'אחת לקבוצה');

-- Seed equipment templates for Sukkot
INSERT INTO equipment_templates (holiday_type, name, category, quantity_per_person, unit, is_shared, notes) VALUES
  ('sukkot', 'סוכה', 'סוכה', 0, 'יח׳', true, 'סוכה אחת לקבוצה'),
  ('sukkot', 'סכך', 'סוכה', 0, 'יח׳', true, NULL),
  ('sukkot', 'דפנות', 'סוכה', 0, 'יח׳', true, NULL),
  ('sukkot', 'נויי סוכה', 'סוכה', 0, 'סט', true, NULL),
  ('sukkot', 'לולב', 'ארבעת המינים', 1, 'יח׳', false, 'אחד לכל מבוגר'),
  ('sukkot', 'אתרוג', 'ארבעת המינים', 1, 'יח׳', false, NULL),
  ('sukkot', 'הדסים', 'ארבעת המינים', 3, 'יח׳', false, '3 לכל מבוגר'),
  ('sukkot', 'ערבות', 'ארבעת המינים', 2, 'יח׳', false, '2 לכל מבוגר'),
  ('sukkot', 'שולחן מתקפל', 'סוכה', 0, 'יח׳', true, NULL),
  ('sukkot', 'כיסאות מתקפלים', 'סוכה', 1, 'יח׳', false, 'כיסא לכל נפש'),
  ('sukkot', 'תאורה לסוכה', 'סוכה', 0, 'סט', true, NULL);

-- Seed equipment templates for Regular trips
INSERT INTO equipment_templates (holiday_type, name, category, quantity_per_person, unit, is_shared, notes) VALUES
  ('regular', 'מזוודה', 'אישי', 0.5, 'יח׳', false, 'מזוודה לכל 2 נפשות'),
  ('regular', 'מתאם חשמל', 'חשמל', 0.3, 'יח׳', false, NULL),
  ('regular', 'עגלת ילדים', 'ילדים', 0, 'יח׳', false, 'לפי הצורך'),
  ('regular', 'מושב בטיחות', 'ילדים', 0, 'יח׳', false, 'לפי הצורך'),
  ('regular', 'ערכת עזרה ראשונה', 'בריאות', 0, 'יח׳', true, NULL),
  ('regular', 'תרופות', 'בריאות', 1, 'סט', false, 'סט אישי');

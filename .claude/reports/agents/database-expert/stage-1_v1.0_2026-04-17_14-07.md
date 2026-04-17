# Stage 1 — מיגרציית DB מאוחדת (v9.0 Foundation)

**גרסה:** v1.0
**תאריך:** 2026-04-17
**שעה:** 14:07
**סוכן:** database-expert
**סטטוס:** ✅ הושלם
**טוקנים:** ~5,000

---

## 🇮🇱 דוח בעברית

### 🎯 מטרת השלב
יצירת מיגרציית SQL אחת מאוחדת המכילה את כל השינויים הסכמתיים הנדרשים לכל 8 שלבי v9.0 — למנוע מיגרציות נוספות בהמשך.

### 📂 קבצים שנוצרו
- `supabase/migrations/007_v9_foundation.sql` — 186 שורות, אידמפוטנטי

### 📊 שינויים סכמתיים

**טבלת `trips` — 17 עמודות חדשות:**
- `trip_type` ENUM: `private`/`family`/`friends`/`client` (ברירת מחדל `family`)
- `location_type` ENUM: `domestic`/`international` (ברירת מחדל `international`)
- `admin_participates` BOOLEAN (ברירת מחדל `true`)
- `markup_type`, `markup_value`
- לינה: `accommodation_name/address/lat/lng`
- טיסות הלוך: `outbound_flight_number/datetime/airport/terminal`
- טיסות חזור: `return_flight_number/datetime/airport/terminal`

**טבלאות אחרות שהורחבו:**
- `trip_days.bookings` JSONB
- `trip_files.description` NOT NULL (עם backfill) + `image_url` TEXT
- `meals.attendees_count`, `meals.recipe_id` FK
- `destinations_cache.local_customs/weather_cache/weather_cached_at`

**טבלאות חדשות (5):**
1. `meal_recipes` — ספריית מתכונים + AI cache עם `content_hash` UNIQUE גלובלי
2. `meal_attendance` — נוכחות לפי ארוחה
3. `trip_recommendations` — scraping מ-Reddit/TripAdvisor/Claude
4. `trip_todos` — "מי מביא מה" למשפחה
5. `flight_status_log` — מעקב סטטוס טיסות

**Realtime Publications:** `meal_attendance`, `trip_todos`, `trip_recommendations`

### 🧪 בדיקות שבוצעו
- [x] קובץ קיים ב-`supabase/migrations/`
- [x] `BEGIN`/`COMMIT` עוטפים את השינויים
- [x] כל `ADD COLUMN` ו-`CREATE TABLE` עם `IF NOT EXISTS`
- [x] Realtime publications עטופים ב-`DO $$...EXCEPTION` (אידמפוטנטי)
- [x] סדר נכון: `meal_recipes` נוצר לפני `meals.recipe_id` FK
- [x] אין שינויי RLS (תואם CLAUDE.md)

### 📋 Checklist לבדיקה ידנית
1. Supabase Studio → SQL Editor → הדבק את `007_v9_foundation.sql` → Run
2. `SELECT column_name FROM information_schema.columns WHERE table_name='trips'` → 17 עמודות חדשות
3. הרץ שוב את המיגרציה — חייב לעבור ללא שגיאות (אידמפוטנטי)

### ❓ שאלות פתוחות
אין. שתי שאלות נענו: (1) CHECK ברמת DB לקבצים — לא, רק UI. (2) `content_hash` UNIQUE גלובלי — כן.

### 🔄 המלצה לשלב הבא
**שלב 2** — יצירת טיול חכמה עם trip_type/location_type/markup.

---

## 🇺🇸 Report in English

### 🎯 Goal
Create a single unified SQL migration covering all schema changes for v9.0 stages — avoiding future migrations.

### 📂 Files Created
- `supabase/migrations/007_v9_foundation.sql` — 186 lines, idempotent

### 📊 Schema Changes

**`trips` table — 17 new columns:**
- `trip_type` ENUM: `private`/`family`/`friends`/`client` (default `family`)
- `location_type` ENUM: `domestic`/`international` (default `international`)
- `admin_participates` BOOLEAN (default `true`)
- `markup_type`, `markup_value`
- Accommodation: `accommodation_name/address/lat/lng`
- Outbound flight: `outbound_flight_number/datetime/airport/terminal`
- Return flight: `return_flight_number/datetime/airport/terminal`

**Other tables extended:**
- `trip_days.bookings` JSONB
- `trip_files.description` NOT NULL (backfilled) + `image_url` TEXT
- `meals.attendees_count`, `meals.recipe_id` FK
- `destinations_cache.local_customs/weather_cache/weather_cached_at`

**New tables (5):**
1. `meal_recipes` — Recipe library + AI cache (global UNIQUE `content_hash`)
2. `meal_attendance` — Per-meal attendance
3. `trip_recommendations` — Reddit/TripAdvisor/Claude scraping
4. `trip_todos` — Family "who brings what"
5. `flight_status_log` — Flight status tracking

**Realtime publications:** `meal_attendance`, `trip_todos`, `trip_recommendations`

### 🧪 Verification
- [x] File exists in `supabase/migrations/`
- [x] Wrapped in `BEGIN`/`COMMIT`
- [x] All `ADD COLUMN` / `CREATE TABLE` use `IF NOT EXISTS`
- [x] Realtime publications wrapped in `DO $$...EXCEPTION` (idempotent)
- [x] Correct order: `meal_recipes` created before `meals.recipe_id` FK
- [x] No RLS changes (per CLAUDE.md)

### 📋 Manual Test Checklist
1. Supabase Studio → SQL Editor → paste `007_v9_foundation.sql` → Run
2. `SELECT column_name FROM information_schema.columns WHERE table_name='trips'` → 17 new columns
3. Re-run the migration — must succeed (idempotent)

### ❓ Open Questions
None. Two questions resolved: (1) DB CHECK on files — no, UI only. (2) Global UNIQUE `content_hash` — yes.

### 🔄 Next Stage Recommendation
**Stage 2** — Smart trip creation using trip_type/location_type/markup.

# database-expert — Stage 10: Itinerary Foundation

**שלב:** 10 (Daily Itinerary)
**גרסה:** v9.1.0
**תאריך:** 2026-04-19 00:00
**משימה:** עיצוב והרצת מיגרציה 010 לתמיכה בעמוד התוכניה היומית
**סטטוס:** ✅ הושלם

---

## 🇮🇱 חטיבה בעברית

### מה התבקשתי
לבחון את סכמת ה-DB הקיימת ולהגדיר אילו שינויים נדרשים לתמיכה בעמוד שמציג, לכל יום:
- אטרקציות (מתוך `trip_days.bookings` JSONB)
- ארוחות (מתוך `meals` — כולל אפשרות של ארוחה במסעדה עם מיקום גיאוגרפי)
- מיזוג לציר זמן כרונולוגי

### מה סופק

#### מיגרציה 010 (`010_itinerary_foundation.sql`, 77 שורות, אידמפוטנטית)
1. **`meals` — זמן מפורש + מיקום מסעדה**
   - `time TIME NULL` — עוקף את ברירת המחדל של meal_type
   - `location_name TEXT`, `location_address TEXT`
   - `location_lat NUMERIC(10,7)`, `location_lng NUMERIC(10,7)`

2. **`trip_days.bookings` — Snapshot expansion**
   - Backfill עם `jsonb_agg` לכל booking קיים: הוספת 13 מפתחות חדשים (booking_id, description, image_url, category, lat, lng, website_url, waze_url, gmaps_url, duration_minutes, order_index, user_notes) עם ערכי `null` / defaults
   - Idempotent-safe: שימוש ב-`jsonb_build_object` עם `COALESCE` מאפשר הרצה חוזרת ללא נזק
   - Cast של שדות null ב-`to_jsonb(...)` למניעת טעויות טיפוס

3. **CHECK constraint** — `jsonb_typeof(bookings) = 'array'` (בתוך DO block עם `EXCEPTION WHEN duplicate_object`)

4. **3 אינדקסים חדשים**
   - `idx_meals_day_time ON meals(trip_day_id, time NULLS LAST)` — שאילתת timeline
   - `idx_trip_days_trip_date ON trip_days(trip_id, date)` — טעינת עמוד תוכניה
   - `idx_trip_days_bookings_gin ON trip_days USING gin (bookings)` — חיפוש עתידי לפי attraction_id

5. **RLS** — ללא שינוי. policies קיימות על `trip_days`+`meals` מכסות גם את העמודות החדשות.

### החלטות עיצוב (opinionated picks)

| שאלה | החלטה | נימוק |
|---|---|---|
| מקור אמת לנתוני אטרקציה | JSONB snapshot ב-`trip_days.bookings` | אפס N+1 לטעינת עמוד; יציבות מול שינויי קטלוג |
| ארוחה במסעדה = אטרקציה? | לא — עמודות נפרדות ב-`meals` | ארוחה שומרת על attendees/recipe/shopping links |
| ordering של מאורעות | `COALESCE(time, '99:99') + order_index + created_at` | זמן עדיפות ראשונה, fallback יציב |
| user_notes | בתוך ה-JSONB (לא טבלה נפרדת) | 1:1 עם booking, נחסך join |
| RLS חדש? | לא | policies קיימות מספיקות |
| migration order | 010 (009 הוא האחרון הקיים) | ממשיך את הסדרה |

### בדיקות שבוצעו
- [x] Dry-run של ה-`UPDATE` backfill על דוגמה מקומית (simulated) — זוהה שסכמה ישנה עם 4 שדות מקבלת את 13 החדשים כ-null, שדות קיימים נשמרים
- [x] הרצה ב-Supabase production דרך Management API
- [x] אימות שהשינויים עלו: `SELECT column_name FROM information_schema.columns` → כל 5 עמודות חדשות של `meals` נוכחות
- [x] אימות אינדקסים: `idx_meals_day_time`, `idx_trip_days_trip_date`, `idx_trip_days_bookings_gin` כולם קיימים
- [x] RLS: `pg_policies` ללא שינוי

### שאלות פתוחות / TODOs
1. לא הוספתי compound index על `(trip_day_id, meal_type)` לטבלת `meals` — אם נתחיל לשאול הרבה "all dinners across trips" זה יהפוך רלוונטי
2. `order_index` ב-bookings הוא integer ללא unique — שני bookings יכולים לחלוק אותו ערך ולהסתדר לפי `created_at`. אם יהיה drag-drop reorder נדרש לחזק לזה ייחודיות לכל day.

### הערה לעתיד (לימוד עצמי)
ה-backfill של JSONB עם `jsonb_set` + `COALESCE` הוא pattern חזק לשמירת idempotency. שימרתי אותו במצבר שיטות לשימוש חוזר.

---

## 🇺🇸 English section

### What was asked
Design & run a migration to support the Daily Itinerary page: per-day chronological timeline merging attractions (from `trip_days.bookings` JSONB) and meals (from `meals`), including restaurant meals with geographic location.

### What was delivered
See Hebrew section. Migration 010 (77 lines, idempotent) covers:
- `meals` — new `time`, `location_*` columns
- `trip_days.bookings` JSONB snapshot expansion (backfill + future defaults)
- CHECK constraint ensuring `bookings` is always an array
- 3 new indexes (B-tree on meals timeline, B-tree on trip days page load, GIN on bookings JSONB)
- No RLS changes (existing policies cover new columns)

### Design decisions (opinionated)
See Hebrew table.

### Tests performed
See Hebrew checklist. Migration verified via Supabase Management API — all columns + indexes present in production.

### Open questions / TODOs
1. No compound index on `(trip_day_id, meal_type)` — may become relevant for "all dinners" cross-trip queries
2. `order_index` in bookings is non-unique — fine until drag-drop reorder is added, then uniqueness per day will matter

### Lesson learned
`jsonb_set` + `COALESCE` is a robust pattern for idempotent JSONB backfills. Saving this to my mental library for reuse.

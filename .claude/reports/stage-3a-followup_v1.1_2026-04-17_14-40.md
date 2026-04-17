# Stage 3a — Follow-up Fixes | דוח מעקב

**Version:** v1.1
**Date:** 2026-04-17 14:40
**Agent:** destinations-expert
**Scope:** Execute user answers to 4 open questions from stage-3a v1.0.

---

## עברית

### סיכום בשורה אחת
בוצעו כל 4 התיקונים: גיאוקודינג אוטומטי דרך Open-Meteo, אימות סכמת `destinations_cache` והוספת מיגרציה 008, תמיכה ב-Affiliate IDs דרך משתני סביבה, והרחבת פילטר "בתשלום/חינם" לאטרקציות.

### בדיקת סכמת `destinations_cache` (Fix 2) — מה נמצא
- חיפשתי `CREATE TABLE destinations_cache` בכל מיגרציות ה-Supabase (001–007). **אין הגדרה מפורשת של הטבלה בשום מיגרציה.**
- מיגרציה 007 רק מריצה `ALTER TABLE public.destinations_cache ADD COLUMN IF NOT EXISTS ...` — כלומר מניחה שהטבלה כבר קיימת (כנראה נוצרה ידנית או ב-Studio).
- מיגרציות 005 מתייחסות אליה לצורך RLS בלבד.
- בקוד (`lib/destination-generator.ts`, `app/trip/[id]/destination-overview.tsx`) נעשה שימוש ב:
  - `destination_key` — lookup לוגי ראשי (מ-generator)
  - `country_code` — יעד ה-`onConflict` של upsert (מ-weather caching)
- **המסקנה:** לא ניתן לדעת מהמיגרציות אם יש `UNIQUE(country_code)`. לכן בחרתי באפשרות (a) — **הוספת מיגרציה 008 דפנסיבית** שמוסיפה את האילוץ רק אם אין כבר אילוץ/אינדקס ייחודי על העמודה (DO block).
- קובץ חדש: `supabase/migrations/008_destinations_cache_unique.sql`

### 4 התיקונים — סיכום

| # | תיקון | קבצים שהשתנו |
|---|---|---|
| 1 | **גיאוקודינג אוטומטי** — הוספת `geocode()` ב-`lib/weather.ts` (Open-Meteo, חינם, ללא מפתח). `destination-overview.tsx` משתמש ב-fallback אם `destination.coordinates` חסר; הוסר ה-fallback "מזג אוויר לא זמין" | `lib/weather.ts`, `app/trip/[id]/destination-overview.tsx` |
| 2 | **מיגרציית UNIQUE** ל-`destinations_cache.country_code` באופן idempotent (DO block בודק `pg_constraint` ו-`pg_indexes`) | `supabase/migrations/008_destinations_cache_unique.sql` (חדש) |
| 3 | **Affiliate IDs** — משתני סביבה ב-`.env.example` + שימוש מותנה ב-URLs של Booking (`&aid=`), Airbnb (`?enable_i18n=true&af=`), Rentalcars (`&affiliateCode=`). Kayak ללא שינוי | `.env.example`, `app/trip/[id]/destination-overview.tsx` |
| 4 | **פילטר "בתשלום"/"חינם"** מורחב עם מילות-מפתח עבריות ואנגליות (כרטיס/כניסה/תשלום/₪/ticket/fee/$/€ וכו'; חינם/ללא תשלום/free/no charge) | `app/trip/[id]/destination-overview.tsx` |

### אימות
- `npx tsc --noEmit` — עובר (exit 0)
- אין חבילות npm חדשות
- שימוש ב-Edit בלבד מלבד 2 קבצים חדשים (`008_*.sql`, עדכון `.env.example`)

### הערות
- מיגרציה 008 בטוחה לריצה חוזרת. אם כבר יש PK/UNIQUE על `country_code` — לא עושה כלום.
- אם בפועל העמודה הייחודית היא אחרת (נניח `destination_key`), upsert-ים קיימים עם `onConflict: 'country_code'` ייכשלו ב-DB ללא המיגרציה. לכן הוספת האילוץ היא הדרך הבטוחה.
- לקוח Airbnb חייב `enable_i18n=true` כדי ש-af tracking ייקלט — הוספתי אותו.

---

## English

### One-liner
All 4 follow-ups landed: automatic geocoding via Open-Meteo, `destinations_cache` schema verified and migration 008 added, env-driven affiliate IDs, and expanded paid/free attraction filter.

### `destinations_cache` schema — what I found
- Grepped every migration (001–007) for `CREATE TABLE destinations_cache`. **None exists.**
- Migration 007 only runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, assuming the table already exists (likely created manually or via Supabase Studio).
- Migrations 005 reference it for RLS only.
- Code uses two columns as logical keys: `destination_key` (destination-generator lookup) and `country_code` (weather upsert `onConflict`).
- **Conclusion:** migrations cannot prove the UNIQUE(country_code) exists. I chose **option (a) — add a defensive migration 008** via a DO block that inspects `pg_constraint` and `pg_indexes` and only adds the constraint if nothing already enforces uniqueness on `country_code`.
- New file: `supabase/migrations/008_destinations_cache_unique.sql`

### All 4 fixes

| # | Fix | Files |
|---|---|---|
| 1 | **Auto-geocoding** — `geocode()` added to `lib/weather.ts` (Open-Meteo, free, no key). `destination-overview.tsx` now resolves coords via geocoding when `destination.coordinates` is missing; legacy "מזג אוויר לא זמין" fallback removed | `lib/weather.ts`, `app/trip/[id]/destination-overview.tsx` |
| 2 | **Idempotent UNIQUE migration** on `destinations_cache.country_code` (checks `pg_constraint` + `pg_indexes` before ADD) | `supabase/migrations/008_destinations_cache_unique.sql` (new) |
| 3 | **Affiliate IDs** via env vars; URLs conditionally include affiliate params for Booking (`&aid=`), Airbnb (`?enable_i18n=true&af=`), Rentalcars (`&affiliateCode=`). Kayak skipped per spec | `.env.example`, `app/trip/[id]/destination-overview.tsx` |
| 4 | **Paid/Free filter expansion** with Hebrew + English keywords on name/description/price | `app/trip/[id]/destination-overview.tsx` |

### Verification
- `npx tsc --noEmit` passes (exit 0)
- No new npm packages
- Used `Edit` for all existing-file changes; new files only for migration 008 and `.env.example` update

### Manual test checklist
- [ ] Start app with all 3 `NEXT_PUBLIC_*_AFFILIATE_ID` env vars unset → links are clean (no affiliate params)
- [ ] Set `NEXT_PUBLIC_BOOKING_AFFILIATE_ID=12345` → Booking card URL includes `&aid=12345`
- [ ] Set `NEXT_PUBLIC_AIRBNB_AFFILIATE_ID=foo` → Airbnb URL includes `?enable_i18n=true&af=foo`
- [ ] Set `NEXT_PUBLIC_RENTALCARS_AFFILIATE_ID=bar` → Rentalcars URL includes `&affiliateCode=bar`
- [ ] Open a trip whose destination is NOT in `DESTINATIONS_DB` (no static `coordinates`) → weather still renders (geocode fallback)
- [ ] Open a trip to Montenegro/Italy/Greece (in DB) → weather still renders (no regression)
- [ ] Toggle "🎟️ בתשלום" chip on an attraction with `description: "כרטיס כניסה 20₪"` but no `price` field → appears in paid list
- [ ] Toggle "🎁 חינם" chip on an attraction with `description: "כניסה חופשי"` → appears in free list
- [ ] Apply migration 008 to Supabase → first run adds constraint, second run is a no-op (verify no error)
- [ ] Trigger a weather upsert from the browser (load trip page) → check `destinations_cache` row updated without 23505 conflict error

### Notes
- Migration 008 is safe to re-run.
- If the actual unique column turns out to be something else (e.g., `destination_key`), the constraint is additive and harmless — upserts with `onConflict: 'country_code'` will still work once the constraint exists.
- Airbnb requires `enable_i18n=true` alongside `af=` for affiliate tracking to register — both included.

---

## Files changed

- **Modified:** `lib/weather.ts` — added `geocode()` + `GeocodeResult` type
- **Modified:** `app/trip/[id]/destination-overview.tsx` — geocode fallback, affiliate URLs, expanded filter logic, removed legacy no-coords placeholder
- **Modified:** `.env.example` — added 3 affiliate env var placeholders
- **New:** `supabase/migrations/008_destinations_cache_unique.sql` — idempotent UNIQUE(country_code)

# Stage 10 — תוכניה יומית (Daily Itinerary Page) / Unified day planner

**גרסה:** v9.1.0
**תאריך:** 2026-04-19 (עבודה החלה 2026-04-18 בשעה ~23:30 והושלמה ~00:10 ב-04-19)
**סוכנים:** ui-designer, database-expert, destinations-expert (כולם במקביל), coordinator (Claude הראשי)
**סטטוס:** ✅ הושלם ונפרס לפרודקשן
**Commit:** `bbe1380` (+ `bbd18c3` cron hotfix)
**פרוס ב:** https://tripmaster-seven.vercel.app/trip/[id]/itinerary/[dayId]
**טוקנים מוערכים:** ~180K (כולל 3 סוכני מחקר + 1 סוכן backfill קואורדינטות + בנייה)

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
אחרי ששלבים 1-8 של v9.0 בנו את התשתית (סוגי טיולים, טיסות, לינה, מתכונים, המלצות, mobile realtime), חסר היה **חיבור רגשי** — מסך שמאחד את כל הנתונים היומיים של הטיול ונותן ללקוח תחושה של "תוכניה מוכנה לפעולה".

הלקוח ביקש: עמוד שמוצג אחרי ששריין אטרקציות לימים, מאגד את הארוחות + האתרים, מציג סדר יום מעוצב עם מפה אינטראקטיבית והסברים על האתרים — "משהו מעוצב ומעניין".

### 🗂️ קבצים שנוצרו (6) / שונו (5)

#### נוצרו
1. `supabase/migrations/010_itinerary_foundation.sql` — מיגרציה אידמפוטנטית
2. `app/trip/[id]/itinerary/[dayId]/page.tsx` — server component (Next.js App Router)
3. `app/trip/[id]/itinerary/[dayId]/itinerary-client.tsx` — client shell עם hero, ribbon, map, export
4. `components/itinerary/day-map.tsx` — רכיב MapLibre GL JS (tiles חינמיים מ-OpenFreeMap)
5. `components/itinerary/timeline.tsx` — ציר זמן ממוזג אטרקציות + ארוחות, buildTimeline helper
6. `components/itinerary/export-actions.tsx` — שיתוף בוואטסאפ + הדפסה

#### שונו
1. `lib/destinations.ts` — הוספת `AttractionCategory`, `CATEGORY_THEME`, helpers (`buildWazeLink`, `buildGmapsLink`, `buildAppleLink`, `MEAL_TYPE_DEFAULT_TIME`, `MEAL_TYPE_LABEL`) + backfill של 14 אטרקציות עם lat/lng/duration_minutes
2. `lib/supabase/types.ts` — ממשק חדש `DayBooking`, הרחבת `Meal` עם time/location_*
3. `app/trip/[id]/destination-overview.tsx` — addBooking חדש שומר snapshot מלא (12 שדות) במקום ID בלבד; קישור "פתח תוכניה יומית ←" על כל כרטיס יום
4. `package.json` / `package-lock.json` — הוספת `maplibre-gl` + `react-map-gl`
5. `vercel.json` — הורדת תדירות cron מ-4h ליומי (מגבלת Hobby)

### 🏗️ שינויים מרכזיים

#### מיגרציה 010 (אידמפוטנטית)
- `meals`: `time TIME`, `location_name/address`, `location_lat/lng NUMERIC(10,7)`
- `trip_days.bookings` JSONB: **הרחבת ה-snapshot** — מ-4 שדות (attraction_id, attraction_name, time, created_at) ל-17 שדות כולל description, image_url, category, lat/lng, website_url, waze_url, duration_minutes, order_index, user_notes, booking_id
- CHECK constraint: `jsonb_typeof(bookings) = 'array'`
- 3 אינדקסים חדשים: `idx_meals_day_time`, `idx_trip_days_trip_date`, `idx_trip_days_bookings_gin`
- RLS: ללא שינוי נדרש (policies קיימות מכסות)

#### Timeline אחוד (חדש)
ה-`buildTimeline(bookings, meals)` ממזג:
- אטרקציות עם/בלי `time` → מיון בזמן המפורש, ברירת-מחדל 12:00
- ארוחות עם/בלי `time` → נפילה ל-`MEAL_TYPE_DEFAULT_TIME[meal_type]` (breakfast=08:00, lunch=13:00, dinner=19:00, seuda_1-3=11:30/14:30/17:30)
- מיון לקסיקוגרפי על מחרוזות HH:MM

תצוגה: פס זהב אנכי RTL, node ממוספר + אייקון לפי category, בועת זמן (עם גבול מקווקו כש"משוערת"), כרטיס עם תמונה/תיאור/chips/4 כפתורי פעולה (website/Waze/Gmaps/expand), expanded state עם framer-motion `layout`+`layoutId` morph.

#### מפה MapLibre
- Style חינמי: `https://tiles.openfreemap.org/styles/liberty`
- סיכות custom HTML (צבוע לפי category, מספר על הכיפה, bounce ב-hover)
- קו מקווקו זהב (`#B08B3F`, dash [2,2]) מחבר את הנקודות בסדר הכרונולוגי
- fitBounds אוטומטי עם padding 60px
- Binding דו-כיווני: `activeId` state משותף בין timeline ל-map; hover בכרטיס → flyTo + pulse animation; לחיצה על pin → setActiveId → הכרטיס מודגש
- **Desktop:** sticky sidebar בשמאל (col-1), כל הגובה
- **Mobile:** כפתור floating "מפה · N נקודות" → bottom-sheet 75vh עם spring damping

#### Day-type ribbons (שבת/חג/חוה"מ)
מעל הציר, סרט שלם-רוחב עם gradient + אייקון (Flame לשבת, Sparkles לחג), label ("שבת קודש · אין נסיעות", "חג", "ערב חג · הכנות", "חול המועד", "שבת חול המועד"). **chol לא מציג סרט** (להימנע מרעש חזותי ביום חול רגיל).

#### Booking flow snapshot
ה-`addBooking` ב-`destination-overview.tsx` עבר refactor: מעבר מ-entry minimalist (4 שדות) ל-snapshot מלא. יתרון: העמוד היומי קורא מהירות מ-JSONB אחד בלי joins לקטלוג הסטטי. הוספנו:
- `booking_id` (UUID ייחודי)
- כל שדה מהקטלוג הסטטי הוקלט ל-JSONB ב-write time
- Waze URL ו-Gmaps URL נבנים *עכשיו* (לא רק נשמרים בדיעבד)

#### Export
- **WhatsApp:** טקסט מעוצב (1. 🕐 HH:MM — שם + Waze link), copy-to-clipboard + window.open(`https://wa.me/?text=...`)
- **Print:** `window.print()` + CSS `@media print` שמסתיר map/buttons/nav

### 🧪 בדיקות שבוצעו
- [x] `npx --package=typescript tsc --noEmit` → EXIT 0 (ניקי)
- [x] `npm run build` → עבר בהצלחה, הנתיב `/trip/[id]/itinerary/[dayId]` נרשם כ-dynamic route
- [x] Verified via Supabase REST API:
  - 5 עמודות חדשות ב-`meals` (time, location_name/address/lat/lng)
  - 3 אינדקסים חדשים + `idx_trip_days_bookings_gin`
- [x] Vercel deployment `● Ready` status
- [ ] בדיקה ידנית על מכשיר פיזי (טלפון + דסקטופ) — **בצד המשתמש**

### 📋 Checklist למשתמש לבדיקה ידנית
- [ ] היכנס לטיול עם אטרקציות משוריינות ליום → לחץ "פתח תוכניה יומית ←"
- [ ] בדוק ש-hero מציג תמונה + תאריך עברי + chip סיכום
- [ ] רחף על כרטיס → הסיכה על המפה מהבהבת + המפה מתמקדת
- [ ] לחיצה על סיכה → הכרטיס מסומן (ring זהב)
- [ ] לחיצה על Waze → נפתח עם הקואורדינטות הנכונות (`waze.com/ul?ll=...&navigate=yes`)
- [ ] שיתוף בוואטסאפ → טקסט מועתק + WhatsApp נפתח עם pre-filled
- [ ] יום שבת — בדוק שה-ribbon הכחול-סאפיר מוצג
- [ ] Mobile — פתח bottom-sheet → ודא swipe down סוגר

### ❓ שאלות פתוחות / החלטות שדורשות אישור
1. **Unsplash** — אטרקציות חסרות תמונה מקבלות placeholder של `hero_image` של היעד. לא מושך Unsplash בזמן אמת (חסרה spec על atrribution photographer). האם לפתוח follow-up להוספת Unsplash API + קרדיטים?
2. **PDF Export** — לא הוטמע בגרסה הזו. עלות: `@react-pdf/renderer` עם font loader לעברית (~300KB bundle). אם יש ביקוש — מיוחד ל-follow-up.
3. **Ken Burns zoom על תמונות** — לא הוטמע (החלטתי לשחרר מהר ולפלט זאת כפולש). לדון עם UI designer אם זה קריטי לתחושה.
4. **duration_minutes** — backfill נעשה מטקסט חופשי ("שעתיים" → 120). יש 2 אטרקציות עם `// TODO: verify coords` (Donkey Farm, Kotor Cable Car) — טעון אימות.

### ➡️ המלצה לשלב הבא
**Stage 11 (כבר בוצע):** אכיפת `admin_participates` flag — ראה `stage-11_v1.0_2026-04-19_00-20.md`.

שלבים עתידיים מומלצים:
- **Stage 12:** Zmanim integration עם חטיבת התוכניה — הוספת שורות של זמני תפילה/שקיעה לטיימליין בימי שבת/חג
- **Stage 13:** gesture-based reorder של האטרקציות בתוך יום (drag-drop)
- **Stage 14:** Auto-suggestion — ה-AI מציע סדר יום אופטימלי לפי קרבה גיאוגרפית ושעות פתיחה

---

## 🇺🇸 English section

### 🎯 Stage goal
After stages 1-8 of v9.0 built the foundation (trip types, flights, accommodation, recipes, recommendations, realtime sync), the **emotional hook** was missing — a single screen that unifies each day's data and gives the user the feeling of "plan ready to execute".

The user asked: a screen, shown after attractions are reserved to days, that combines meals + attractions, displays a designed daily schedule with an interactive map and attraction descriptions — "something designed and interesting."

### 🗂️ Files created (6) / modified (5)

Same list as above. Key point: all work done on a new route (`app/trip/[id]/itinerary/[dayId]/`), new component directory (`components/itinerary/`), and one new migration (`010`). Existing surfaces got additive changes only — no breaking removals.

### 🏗️ Core changes

#### Migration 010 (idempotent)
- `meals`: `time TIME`, `location_name/address`, `location_lat/lng NUMERIC(10,7)`
- `trip_days.bookings` JSONB: **snapshot expansion** from 4 fields → 17 fields including description, image_url, category, lat/lng, website_url, waze_url, duration_minutes, order_index, user_notes, booking_id
- CHECK constraint ensuring `bookings` is always a JSON array
- Three indexes added, including a GIN on the JSONB for future attraction lookups
- RLS: no changes (existing policies on `trip_days`+`meals` cover new columns)

#### Unified timeline
`buildTimeline(bookings, meals)` merges both streams into a single chronological list. Meals without explicit `time` fall back to `MEAL_TYPE_DEFAULT_TIME` defaults. Sort is lexicographic on HH:MM strings (works because zero-padded).

Visual: vertical gold rail on the right (RTL), numbered category-colored nodes with icons, time bubbles (dashed border = "estimated"), content cards with image/description/chips/4 action buttons (website/Waze/Gmaps/expand), expanded state using framer-motion `layout` + `layoutId` for smooth morph.

#### MapLibre integration
- Free tile provider: `https://tiles.openfreemap.org/styles/liberty` (no API key, no quota)
- Custom HTML markers (category-colored, numbered badges, hover bounce)
- Dashed gold route line connecting pins in chronological order
- Auto `fitBounds` with 60px padding
- Two-way binding between timeline and map via shared `activeId` state: hover card → `flyTo` + pulse animation; click pin → highlight corresponding card (`ring`)
- **Desktop:** sticky left sidebar, full column height
- **Mobile:** floating "Map · N points" button → 75vh bottom-sheet with spring damping

#### Day-type ribbons (Shabbat/Chag/Chol Hamoed)
Full-width gradient ribbon below hero with icon (Flame for Shabbat, Sparkles for Chag), label ("שבת קודש · אין נסיעות", etc). `chol` (regular weekday) shows no ribbon — deliberate, to avoid visual noise.

#### Booking snapshot refactor
`addBooking` in `destination-overview.tsx` now writes a full enriched object to JSONB (12 fields) instead of just `attraction_id`. Trade-off: more DB write bytes, zero N+1 reads on itinerary page. Waze/Gmaps URLs are built at write-time using lat/lng from the static catalog, so they stay stable even if the catalog updates.

#### Export
- **WhatsApp:** formatted text (1. 🕐 HH:MM — name + Waze link), copy to clipboard + `window.open('https://wa.me/?text=...')`
- **Print:** `window.print()` + `@media print` CSS hiding map/buttons/nav

### 🧪 Tests performed
- [x] `tsc --noEmit` → EXIT 0 (clean)
- [x] `npm run build` → passed, `/trip/[id]/itinerary/[dayId]` registered as dynamic route
- [x] Supabase REST API verification of new columns + indexes
- [x] Vercel production `● Ready` status confirmed
- [ ] Physical device manual testing — **pending user**

### 📋 Manual test checklist (user)
See Hebrew section above.

### ❓ Open questions / decisions needing sign-off
1. Unsplash auto-fill for missing attraction images (attribution requirements)
2. Server-side PDF export via `@react-pdf/renderer` (Hebrew font support)
3. Ken Burns zoom animation on expanded attraction images (deferred for speed)
4. Two attractions flagged `// TODO: verify coords` (Donkey Farm, Kotor Cable Car) — need physical verification

### ➡️ Recommended next stage
**Stage 11 (already done):** admin_participates flag enforcement — see `stage-11_v1.0_2026-04-19_00-20.md`.

Future recommended stages:
- **Stage 12:** Zmanim integration into the timeline (prayer times rendered as events on Shabbat/Chag days)
- **Stage 13:** Gesture-based drag-drop reorder of attractions within a day
- **Stage 14:** AI auto-suggestion — propose optimal day order by geographic proximity + opening hours

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- דיספטצ' של 3 סוכנים מקבילים (ui-designer, database-expert, destinations-expert) לתכנון → חסכו שעות
- Snapshot-at-write-time במקום lookup-at-render-time → performance נקי ב-production
- MapLibre GL + OpenFreeMap → אפס עלות, אפס API key, עובד מהר
- שימוש ב-framer-motion `layoutId` ליצירת morph בין מצב מצומצם למורחב → תחושה מלוטשת

**מה לא עבד / טעויות:**
- **טעות חמורה:** לא כתבתי דוח בזמן השחרור. הלקוח תפס אותי ב-commit הבא. **שמור כלל בזיכרון (ראה memory/feedback_mandatory_agent_reports.md).**
- לא זיהיתי מראש את מגבלת Vercel Hobby על cron → הנחתי בלי לבדוק → נדרש hotfix commit נוסף (bbd18c3). לעתיד: לבדוק `vercel.json` → מגבלת plan לפני deploy.
- Unsplash fallback לא הוטמע — החלטה נכונה למהירות, אבל המשתמש לא קיבל על כך זהירה מראש.

**מה ללמוד:**
- **חוק הדוחות:** אף שלב לא "הושלם" בלי דוח + עדכון README + push באותו commit או ברגע שאחריו. נכתב ל-memory permanent.
- **תאימות CI:** לפני deploy לבדוק מגבלות cron/bandwidth/build minutes של ה-plan.
- **Flag visible side-effects:** אם החלטתי לוותר על פיצ'ר שדובר עליו (כמו Ken Burns), לציין זאת מפורשות בסיכום לפני ה-deploy.

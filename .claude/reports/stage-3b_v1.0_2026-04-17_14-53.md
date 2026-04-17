# Stage 3b — דוח ביצוע (destinations-expert)

**תאריך:** 2026-04-17 14:53
**גרסה:** v1.0
**סוכן:** destinations-expert
**סטטוס:** הושלם — `tsc --noEmit` עובר ללא שגיאות

---

## עברית

### סקירה
Stage 3b הוסיף ניהול מלא של פרטי טיסות ולינה לטיול, כולל גיאוקוד אוטומטי
של כתובת המלון, פרסר מספרי טיסה (ללא API חיצוני בשלב זה), ותצוגה של
זמני הליכה מהלינה לבתי חב״ד ביעדים בחו״ל.

### קבצים שנערכו / נוצרו
1. **חדש** — `app/api/flights/parse/route.ts`
   - Route `POST /api/flights/parse`
   - קלט: `{ flightNumber, date }`
   - פלט: `{ airport, terminal, airline }` או `null` לשדות שלא זוהו
   - טבלת lookup פנימית (35+ חברות תעופה): חברות ישראליות/full-service → TLV T3;
     LCCs (W6/FR/U2/EZY/PC/VY/DY וכו') → TLV T1
   - מטפל ב-prefixes של 2-3 תווים, קודי שם מלא ("EL AL", "WIZZ"), ורווחים

2. **נערך** — `app/trip/[id]/trip-settings.tsx`
   - הוסף כרטיס "🏨 לינה": שם, כתובת, גיאוקוד on-blur דרך `geocode()`
     מ-`lib/weather.ts`, ✓ ירוק ליד כתובת שזוהתה, שמירת lat/lng שקטה ב-DB
   - הוסף כרטיס "✈️ פרטי טיסות" עם שני בלוקים (הלוך / חזור): מספר טיסה,
     datetime-local, שדה תעופה, טרמינל. on-blur על מספר הטיסה קורא ל-API
     החדש וממלא אוטומטית את airport/terminal אם הם ריקים (לא דורס override)
   - עבור טיול `location_type === "domestic"`: הכותרת משתנה ל-"🚗 נסיעה",
     "יציאה"/"חזרה" במקום "הלוך"/"חזור"

3. **נערך** — `app/trip/[id]/destination-overview.tsx`
   - הוסף `<FlightSummary>` בראש העמוד (מעל רצועת מזג האוויר). מציג רק אם
     קיימים פרטי טיסה; כרטיס קומפקטי עם תווית, מספר, שדה תעופה + טרמינל,
     ותאריך/שעה בפורמט `he-IL`. כותרת מתחלפת לטיולים פנים-ארציים.
   - הוסף `<WalkingBadge>` לכל כרטיס בית חב״ד — מופיע רק ב-`!isDomestic`
     וכאשר `accommodation_lat/lng` קיימים. משתמש בנוסחת Haversine מקומית
     (ללא קריאות API), ממיר למטרים לדקות ב-80 מ׳/דק׳, עיגול כלפי מעלה.
     >30 דק׳ → badge "🚗 X ק״מ" במקום הליכה.
   - Effect חדש שגאוקודד כתובות בתי חב״ד ברקע (sequential, אחת אחרי השניה)
     באמצעות `geocode()` הקיימת. רץ רק כאשר יש lat/lng ללינה.

### עיצוב / UX
- כל הסוגיות/תוויות בעברית RTL
- שדות ASCII (מספרי טיסה, קודי שדה תעופה, datetime) עם `dir="ltr"`
- Badge ירוק להליכה, כחול לרכב — ללא הפרעה לטיפוגרפיה הקיימת
- גיאוקוד שקט: אם נכשל, פשוט אין badge ואין הודעת שגיאה

### בדיקות שבוצעו
- `npx tsc --noEmit` — עובר
- בדיקת ידנית של הפרסר: `LY315` → T3, `W6 1234` → T1, `EZY2201` → T1
- רענון שקט של lat/lng: `trips.update` שקט על blur של הכתובת

### אזורי פעילות חדשים ב-DB
משתמש בעמודות הקיימות ממיגרציה 007 — ללא שינוי סכמה:
- `accommodation_{name,address,lat,lng}`
- `outbound_{flight_number,flight_datetime,airport,terminal}`
- `return_{flight_number,flight_datetime,airport,terminal}`

### מגבלות ידועות / הערות לשלב הבא
- הפרסר מניח שכל הטיסות עוברות דרך TLV — לטיולי חיבור (double-leg)
  יידרש טיפול רחב יותר
- אין גיאוקוד למסעדות כשרות / אטרקציות — כרגע walking times רק לחב״ד
  (ה-Task דרש "Chabad houses / synagogues / Jewish POI" — במבנה הנוכחי
  רק Chabad מצוי כקטגוריה ייעודית)
- Stage 7 יחליף את הפרסר הסטטי עם lookup חי של סטטוס טיסה

---

## English

### Summary
Stage 3b adds flight + accommodation management to trip settings, with an
internal flight-number parser (no external APIs), silent Open-Meteo
geocoding of the lodging address, and walking-time badges from lodging to
Chabad houses on the destination overview (international trips only).

### Files
1. **NEW** `app/api/flights/parse/route.ts` — POST handler with a 35+ airline
   inline lookup. Israeli full-service + international legacy carriers map
   to TLV Terminal 3; low-cost carriers (Wizz/Ryanair/easyJet/Pegasus/Vueling/
   Norwegian/etc.) map to TLV Terminal 1. Handles 2–3 char IATA codes and
   common full-name prefixes ("EL AL", "WIZZ"). Returns
   `{ airport, terminal, airline }` or nulls on total failure.

2. **EDIT** `app/trip/[id]/trip-settings.tsx` — two new admin cards:
   - 🏨 Accommodation: name + address with on-blur geocode via existing
     `geocode()`; green ✓ when resolved; lat/lng persisted silently.
   - ✈️ Flights: outbound + return blocks (flight#, datetime-local,
     airport, terminal). On-blur of flight# calls `/api/flights/parse`
     and auto-fills empty airport/terminal fields (never clobbers overrides).
   - Domestic trips: title switches to "🚗 נסיעה" with "יציאה/חזרה" labels.

3. **EDIT** `app/trip/[id]/destination-overview.tsx`:
   - `<FlightSummary>` card at top — only renders when any flight field set.
   - `<WalkingBadge>` on each Chabad card when `!isDomestic` and accommodation
     coordinates exist. Uses local Haversine + 80 m/min conversion, ceil to
     nearest minute. Over 30 min → "🚗 X ק״מ" drive badge.
   - Sequential background geocoding of Chabad addresses, cached in component
     state by address string.

### Verification
- `npx tsc --noEmit` passes with no output.
- Parser hand-tested on `LY315`, `W6 1234`, `EZY2201`, `EL AL 17`.

### Future work
- Parser assumes TLV origin. Connecting flights / foreign-origin legs TBD.
- Walking badges only on Chabad (no kosher-restaurant coords in the DB).
- Stage 7 will replace the static parser with live flight-status API.

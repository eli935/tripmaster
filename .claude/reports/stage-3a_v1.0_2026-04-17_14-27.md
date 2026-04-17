# Stage 3a — יעד מועשר: מזג/אטרקציות/לינה/השכרות / Enriched Destination

**גרסה:** v1.0
**תאריך:** 2026-04-17
**שעה:** 14:27
**סוכן:** destinations-expert
**סטטוס:** ✅ הושלם
**טוקנים:** ~32k

---

## 🇮🇱 דוח בעברית

### 🎯 מטרת השלב
העשרת טאב "יעד" (DestinationOverview) עם ארבעה רכיבים חדשים:
1. תחזית מזג אוויר חיה (Open-Meteo) לכל ימי הטיול.
2. פילטר אטרקציות (הליכות/בתשלום/חינם/לילדים) + כפתור "שריין ליום" שמעדכן `trip_days.bookings` JSONB.
3. קישורי לינה — Booking.com + Airbnb (הסתרת Airbnb בטיול מקומי), עם המלצה לקרבה לבית חב״ד.
4. קישורי השכרת רכב — Rentalcars + Kayak, עם התאמת כותרת לטיול מקומי.

### 📂 קבצים שנוצרו
- `lib/weather.ts` — Fetcher ל-Open-Meteo, מיפוי WMO → אימוג׳י, `WeatherDay` type. חוזר `[]` בכישלון (לא זורק). משתמש ב-`next: { revalidate: 3h }`.

### ✏️ קבצים ששונו
- `app/trip/[id]/destination-overview.tsx` — שכתוב מקיף: הוספת פילטר אטרקציות עם 5 צ׳יפים, `WeatherStrip` מעל האינפו, `AttractionCard` נפרד עם `Popover` "שריין ליום" הכותב ל-`trip_days.bookings`, סקציות לינה והשכרת רכב. לוגיקה מותנית ב-`trip.location_type === 'domestic'` להסתרת חב״ד + Airbnb + הלכה. קאש מזג אוויר מתבצע fire-and-forget ל-`destinations_cache.weather_cache` כאשר > 3 שעות.
- `app/trip/[id]/trip-overview.tsx` — הוספת `trip={trip} days={days}` ל-`<DestinationOverview>`.

### 🧪 בדיקות שבוצעו
- `npx --package=typescript tsc --noEmit` — עובר נקי (0 שגיאות).
- לא הותקנו חבילות חדשות — אימות על פי דרישת המשימה.
- תוקן שגיאת `asChild` ב-PopoverTrigger (זה base-ui, לא Radix) ע"י שינוי לשימוש ישיר ב-`<PopoverTrigger>` כפתור.

### 📋 Checklist לבדיקה ידנית
- [ ] מעבר לטאב "יעד" — תחזית 7 ימים נטענת מ-Open-Meteo (עם מטבע `מונטנגרו` למשל).
- [ ] לחיצה על "🥾 הליכות" / "🎟️ בתשלום" / "🎁 חינם" / "👶 לילדים" — סינון נכון של האטרקציות.
- [ ] לחיצה על "📅 שריין ליום" באטרקציה → בחירת יום → Toast הצלחה + רישום ב-`trip_days.bookings` ב-DB.
- [ ] כל הקישורים (Booking/Airbnb/Rentalcars/Kayak) נפתחים ב-tab חדש עם פרמטר destination תקין.
- [ ] טיול `location_type='domestic'` — בלי חב״ד, בלי Airbnb, בלי הערות הלכתיות, כותרת "טיולי רכב בארץ".
- [ ] יעד בלי `coordinates` — מציג "מזג אוויר לא זמין ליעד זה".

### ❓ שאלות פתוחות
- האם לנסות להסיק `lat/lng` אוטומטית (גיאוקודינג) כאשר יעד אינו ב-`DESTINATIONS_DB`? כרגע: לא זמין → placeholder.
- `destinations_cache` מסתמך על `country_code` כ-PK — יש לוודא שזו אכן העמודה הייחודית. אם לא, ה-`.upsert({ onConflict: 'country_code' })` ייכשל בשקט.
- קישור Booking/Airbnb — האם להוסיף affiliate IDs בעתיד?
- סינון "paid" כרגע דורש שדה `price` במפורש — אולי לסמוך על רשימת סוגים (לא כל "בתשלום" כתוב מפורש ב-seed).

### 🔄 המלצה לשלב הבא
**Stage 3b** מוצע: מעקב אחרי הזמנות בתצוגת היום (trip day view) — להציג את ה-`bookings` שנשמרו, עם drag-to-reorder ושעות מדויקות. בנוסף, להוסיף UI למחיקת bookings מיום ספציפי.

---

## 🇺🇸 Report in English

### 🎯 Goal
Enrich the Destination tab with: live weather (Open-Meteo), attractions filters + "book to day" flow writing to `trip_days.bookings`, lodging affiliate cards (Booking/Airbnb), and car-rental cards (Rentalcars/Kayak). Adapt UI conditionally for `trip.location_type === 'domestic'`.

### 📂 Files Created
- `lib/weather.ts` — Open-Meteo fetcher, `WeatherDay` type, WMO→emoji mapping. Returns `[]` on failure. Uses Next.js `revalidate: 3h` cache hint.

### ✏️ Files Modified
- `app/trip/[id]/destination-overview.tsx` — major extension: accepts `trip` + `days` props; adds `WeatherStrip` (horizontal scroll, he-IL labels), 5-chip attractions filter bar with client-side keyword/field matching, `AttractionCard` subcomponent with `Popover`-based day picker that appends to `trip_days.bookings` JSONB, Lodging and Car-rental sections with affiliate links. Fire-and-forget cache write to `destinations_cache.weather_cache` every 3h. Chabad/Halachic/Airbnb sections hidden when `location_type === 'domestic'`.
- `app/trip/[id]/trip-overview.tsx` — passes new `trip` and `days` props to `<DestinationOverview />`.

### 🧪 Verification
- `tsc --noEmit` passes clean.
- Zero new npm dependencies (constraint respected).
- Adjusted `PopoverTrigger` usage (base-ui, no `asChild`) so trigger element is the button directly.

### 📋 Manual Test Checklist
- [ ] Destination tab renders 7-day Open-Meteo forecast for a trip to Montenegro/Rome/Athens.
- [ ] Filter chips (hiking/paid/free/kid_friendly) correctly narrow the attractions list.
- [ ] "📅 שריין ליום" popover opens, day select succeeds, toast fires, `trip_days.bookings` grows.
- [ ] All affiliate links open in new tab with correct destination slug.
- [ ] For a `domestic` trip: Chabad, Airbnb, Halachic notes hidden; car-rental title is "טיולי רכב בארץ".
- [ ] Destination without coordinates shows "מזג אוויר לא זמין" placeholder.

### ❓ Open Questions
- Auto-geocode destinations not in the static DB? Currently we show a placeholder.
- Confirm `destinations_cache` uses `country_code` as unique/PK for upsert's `onConflict`.
- Affiliate program IDs (Booking/Airbnb/Kayak) not yet wired.
- "Paid" filter relies on a `price` string being present — may miss paid attractions missing that field.

### 🔄 Next Stage Recommendation
**Stage 3b** — render bookings on the day-view timeline, with drag-to-reorder, time editing, and removal. Add small UI to display and manage saved attractions per day.

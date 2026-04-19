# Stage 13 — 5 שיפורי לקוחות דחופים + הכנה ל-Wizard / Customer urgent fixes + Wizard prep

**גרסה:** v9.3.0
**תאריך:** 2026-04-19
**שעה:** 02:00
**סוכנים:** 3 במקביל — performance-engineer + financial-expert (household) + tripmaster-manager (wizard design), coordinator (Claude הראשי)
**סטטוס:** ✅ 5 שיפורים הושלמו ונפרסים · 📋 Wizard Phase 1 design מוכן, ממתין לאישור לבנייה
**טוקנים:** ~280K (3 סוכנים + 2 תיקונים ידניים + build)

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
הלקוח פתח טיול עם לקוחות ראשונים ושלח 5 הערות דחופות:
1. חלוקת כספים — מודעת הרכב משק-בית (זוג אחד = אין התחשבנות)
2. אתר איטי — דחוף לשפר ביצועים
3. דף תכנון מלא בנפרד עם wizard + AI + vendor lookup
4. תמונות לא תמיד מופיעות
5. כל היציאות למקומות צריכות להיות ממקום הלינה

### 🗂️ קבצים שנוצרו (2) / שונו (12)

#### נוצרו
1. `lib/attraction-image.ts` — helper `resolveAttractionImage(image, category)` עם fallback מובנה לפי 8 הקטגוריות (Unsplash CDN)
2. `.claude/reports/agents/performance/stage-13-audit.md` — דוח audit מלא (מתועד בנפרד)

#### שונו
1. `next.config.ts` — remotePatterns ל-Unsplash/Supabase/Wikimedia + AVIF/WebP
2. `middleware.ts` — matcher צר (לא רץ על /api, /login, /invite, /auth, נכסים)
3. `app/trip/[id]/page.tsx` — trim `select("*")` על profiles + cast בטוח
4. `app/trip/[id]/destination-overview.tsx` — Chabad geocode **parallel** (Promise.all) במקום sequential loop; כרטיס אטרקציה עם fallback + loading lazy
5. `app/trip/[id]/itinerary/[dayId]/itinerary-client.tsx` — dynamic import של DayMap (חסכון ~800KB בבנדל); pin הוטל על המפה (🏨); origin מועבר ל-timeline
6. `components/itinerary/timeline.tsx` — image fallback; origin prop; Waze/Gmaps נבנים עם accommodation כ-origin
7. `lib/destinations.ts` — `buildGmapsLink` + `buildAppleLink` מקבלים param אופציונלי `origin: {lat, lng}` → Gmaps `&origin=...`, Apple `&saddr=...`
8-11. **Household** (בוצע ע"י financial-expert sub-agent, מסומן ב-`lib/participant-utils.ts`):
   - `lib/participant-utils.ts` — helper חדש `isMultiHouseholdTrip`
   - `app/trip/[id]/balance-dashboard.tsx` — early-return למצב single-household (מציג Trip Totals פשוט)
   - `app/trip/[id]/expense-dialog.tsx` — מקבל trip prop; ב-single-household מוחבא selector split-type, ברירת מחדל `private`
   - `app/trip/[id]/trip-overview.tsx` — מעביר trip ל-ExpenseDialog

### 🏗️ פירוט 5 השיפורים

#### 1️⃣ חלוקת כספים לפי הרכב (single vs multi household)
**כלל חדש:** `isMultiHouseholdTrip = countedParticipants >= 2`.
- משפחה אחת / זוג אחד → **אין התחשבנות**: מציג רק Trip Totals (סכום כללי + פירוט קטגוריות). ה-selector "חלק בין" מוסתר, split_type ברירת מחדל = `private`.
- 2+ משקי בית → הלוגיקה הקיימת (equal / per_person / custom + minimized-transfers).
- מעבר אוטומטי כשמצטרף משתתף שני: הוצאות קיימות נשארות `private`, חדשות נכנסות ל-settlement math.

#### 2️⃣ ביצועים — שיפורים חופשיים בלבד (בלי עלות חודשית)
דוח ה-audit זיהה 5 צווארי בקבוק. יושמו הפתרונות החופשיים:

| תיקון | השפעה משוערת |
|---|---|
| Dynamic import MapLibre (רק כשפותחים את עמוד יום) | **-500 עד -900ms** TTI על עמוד היום |
| Narrow middleware matcher (לא רץ על /api, נכסים, /login) | **-200 עד -400ms** על כל ניווט |
| Trim `select("*")` ל-profile fields שבאמת בשימוש | **-150 עד -400ms** בטיולים עם 8+ משתתפים |
| Chabad geocode parallel (6-10 כתובות במקביל) | **-800ms עד -2s** על הטאב "יעד" |
| lazy-loading + async decoding על תמונות | -200-400ms על fast-load של first-paint |

**פתרון בתשלום שלא יושם (דורש אישור):** Vercel Pro $20/חודש = אזור פרנקפורט (קרוב לישראל) → חוסך עוד ~120ms כל קריאה server-side. כדאי כשיש 50+ משתמשים פעילים ליום, **לא עכשיו**.

#### 3️⃣ Full Planning Wizard — **Design done, Phase 1 ממתין לאישור**
מנהל המוצר (sub-agent) הוציא תוכנית של 4 שלבים, ~15 שעות עבודה:
- **Phase 1 (6 שעות):** migration + wizard 5 steps + /api/plan/generate (Claude) + "אמץ הצעה" buttons
- **Phase 2 (4 שעות):** טבלת `vendors` + seed דל Rome/Montenegro/Athens + hybrid AI-fallback
- **Phase 3 (3 שעות):** re-plan + history
- **Phase 4 (2 שעות):** polish + mobile UX

**החלטה נדרשת:** להתחיל Phase 1 עכשיו או לאחר שהלקוחות ראו את 5 השיפורים הראשונים?
**המלצתי:** לפרוס קודם את השיפורים (הם תיקוני baseline חיוניים), לאסוף פידבק 24h, ואז Phase 1.

#### 4️⃣ תמונות — helper מרכזי עם fallback
כל אטרקציה עם `image` ריק/null מקבלת תמונה מקטגורית (nature/historic/beach...) מ-Unsplash curated. אף אטרקציה לא מוצגת ללא תמונה.

#### 5️⃣ יציאות ממקום לינה
- `buildGmapsLink` ו-`buildAppleLink` מקבלים origin אופציונלי. כשהמלון יש לו lat/lng — הלינקים נבנים עם `&origin=...` (Gmaps) / `&saddr=...` (Apple) אז הניווט מתחיל אוטומטית מהמלון.
- **Waze** לא תומך בזה ב-URL (תמיד מתחיל מה-GPS הנוכחי). במקום זה, עיצוב: המלון מופיע כסיכה זהובה על המפה (אייקון 🏨), כך שהמשתמש רואה חזותית את המרחק.

### 🧪 בדיקות שבוצעו
- [x] `tsc --noEmit` → EXIT 0
- [x] `next build` → passed (כל הנתיבים נרשמים, כולל `/trip/[id]/itinerary/[dayId]` כ-dynamic)
- [x] Vercel deploy ● Ready
- [ ] בדיקת Lighthouse על פרודקשן — **ממתין למשתמש / אחרי 24h**

### 📋 Checklist למשתמש
- [ ] פתח את הטיול שלך עם לקוחות → ודא שהאתר מהיר בצורה מורגשת
- [ ] בדוק שזוג יחיד לא רואה "יתרות" בטאב הוצאות (רק סכומים)
- [ ] בדוק שכל האטרקציות מציגות תמונה
- [ ] לחץ על Gmaps בכרטיס אטרקציה → ודא שהמסלול מתחיל מהמלון שלך
- [ ] פתח את עמוד היום היומי → ודא שסיכת המלון (🏨) מופיעה על המפה

### ❓ החלטות פתוחות
1. **Wizard Phase 1 — אור ירוק?** (6 שעות עבודה, מוצע Claude API ~₪0.08 לריצה)
2. **Vercel Pro** — עולה לי $20/חודש, שווה רק ב-50+ DAU. נחכה
3. **Vendor table seed** — כמה שליחי חב"ד / סוכנים מקומיים יש לך ברשימת קשר אישי? נתחיל מהם
4. **"אמץ הצעה"** vs "תוכנית AI מחליפה ישירות" — בחרתי in-between (AI כותב ל-`generated_plan`, bookings לא נפגע, המשתמש לוחץ "אמץ" פר-פריט). מסכים?

### ➡️ המלצה לשלב הבא
**Stage 14 מוצע:** Wizard Phase 1 (MVP: wizard 5-step + Claude plan → `generated_plan` → רינדור כ"הצעות" עם "אמץ" button). מצריך אישור על 4 השאלות לעיל.

---

## 🇺🇸 English section

### 🎯 Stage goal
User opened a trip with real customers and sent 5 urgent feedback items. All 5 addressed; major wizard feature designed but not yet built.

### 🗂️ Files created (2) / modified (12)
See Hebrew list.

### 🏗️ 5 fixes detail

1. **Household-aware expense splitting** — single-couple trip shows just totals, no settlement UI. Via `isMultiHouseholdTrip` helper. Auto-transitions when 2nd participant joins.

2. **Performance** — 5 free fixes shipped:
   - Dynamic import of MapLibre (-500-900ms TTI on itinerary page)
   - Narrowed middleware matcher (-200-400ms on every navigation)
   - Trimmed `select("*")` on profiles (-150-400ms on trips w/ 8+ participants)
   - Parallel Chabad geocoding (-800ms-2s on destination tab)
   - Lazy + async image loading

   Paid fix NOT shipped: Vercel Pro $20/mo (Frankfurt region, -120ms to Supabase). Recommend waiting until 50+ DAU.

3. **Full Planning Wizard** — DESIGN COMPLETE by tripmaster-manager agent. 4 phases, ~15h total. Phase 1 = 6h. **Awaiting green-light before building.**

4. **Images** — `resolveAttractionImage(image, category)` central helper with category-based Unsplash fallback. No attraction renders without an image.

5. **Accommodation as origin** — `buildGmapsLink` + `buildAppleLink` now accept optional `origin: {lat, lng}`. When trip has accommodation coords, nav links start from hotel. Waze (URL doesn't support `from=`) compensates with a gold hotel pin (🏨) rendered on the itinerary map so users see distance visually.

### 🧪 Tests performed
See Hebrew.

### ❓ Open questions
See Hebrew 4-question list.

### ➡️ Recommended next stage
Stage 14 = Wizard Phase 1. Needs answers to the 4 questions above.

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- **3 סוכנים במקביל** לאחר prompt מפורט → חסך 2-3 שעות של מחקר ידני. validation חזק של ההחלטות כשהן מתלכדות.
- **הזרקת performance agent עם הוראה מפורשת "פרוגת לפי השפעת משתמש"** → קיבלתי רשימה עם מספרים, לא abstractions.
- **Agent של household already built** — חסך לי עוד 45 דק'. הגישה של "לכתוב דוח + לבצע ב-Edit tool + להשאיר uncommited לסקירה" הייתה יעילה.
- **לא קפצתי ישר ל-Wizard** למרות שהוא הכי יפה — שימור discipline לטובת shipping fixes ל-baseline.

**מה לא עבד / טעויות:**
- במיגרציה הקודמת (Stage 11), הסוכן תיקן 8 call-sites ואני לא הצגתי למשתמש את הרשימה לפני ביצוע. **תוקן** — הפעם ה-household agent דיווח לי לפני commit, ואני דיווחתי למשתמש לפני deploy (במקרה שישמר בסוף השרשור).
- נגעתי ב-`page.tsx` על select שידרש cast — לא ציפיתי לכשל types. בפעם הבאה לפני trim של selects, להריץ type-check על השינוי הבודד לפני לחתום.

**מה ללמוד:**
- **"Performance audit first, then fix"** הוא patrn נכון יותר מ"fix blindly". דוח ה-audit חסך שעה של ניחושים.
- **3 סוכנים + synthesis + execution בידית** = סגנון עבודה יעיל לסשנים עמוסים. לשמור ב-memory.
- כשמבצעים "מהירות חופשית" (free tier), לכלול בדוח **גם את מה שלא יושם וכמה זה עולה** — משמר אמון עם הלקוח שמחליט על הוצאות.

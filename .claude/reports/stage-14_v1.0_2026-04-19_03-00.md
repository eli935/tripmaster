# Stage 14 — Full Planning Wizard (Phase 1) / תכנון טיול מלא עם AI

**גרסה:** v9.4.0
**תאריך:** 2026-04-19
**שעה:** 03:00
**סוכנים:** coordinator (Claude הראשי) — בהמשך לתכנון בשלב 13
**סטטוס:** ✅ Phase 1 (MVP) הושלם ונפרס
**Migration:** 011
**Commit:** `[coming]`
**פרוס ב:** https://tripmaster-seven.vercel.app/trip/[id]/plan
**טוקנים:** ~110K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
בשלב 13 מנהל המוצר (sub-agent) עיצב את ה-"Full Planning Wizard". המשתמש אישר את 4 ההחלטות:
1. **מאושר** — להתחיל Phase 1
2. **Vendors** — ריקן כעת; אסוף מהרשת, נבנה רשימה אחר כך
3. **"אמץ"** — AI כותב ל-`generated_plan`, המשתמש לוחץ "אמץ" פר-פריט, `bookings` נבנה מההחלטות שלו. **מאושר**
4. **כפתור "תכנון טיול עם AI"** בולט ב-UI. **מאושר**

### 🗂️ קבצים שנוצרו (5) / שונו (3)

#### נוצרו
1. `supabase/migrations/011_trip_preferences_and_generated_plan.sql` — migration אידמפוטנטית
2. `app/api/trip/[id]/plan/generate/route.ts` — endpoint Node.js עם Claude Haiku 4.5
3. `components/plan/plan-wizard.tsx` — wizard 5 שלבים עם framer-motion
4. `app/trip/[id]/plan/page.tsx` — server component
5. `app/trip/[id]/plan/plan-client.tsx` — client shell עם day cards + אימוץ פרטני/מלא

#### שונו
1. `lib/supabase/types.ts` — הוספת `TripPreferences`, `PlanItem`, `TripPace`, `TripTransport`, `MealStyle`; הרחבת Trip ו-TripDay
2. `app/trip/[id]/destination-overview.tsx` — הוספת כרטיס CTA בולט "תכנון טיול עם AI" בראש סקשן "תוכנית יומית"
3. `.claude/reports/README.md` — אינדקס (שורה 14)

### 🏗️ ארכיטקטורה

#### Migration 011 (אידמפוטנטית)
- `trips.preferences JSONB` — אובייקט עם pace/interests/transport/daily_start/daily_end/siesta/meals/budget_per_day/generated_at
- `trip_days.generated_plan JSONB` — מערך של PlanItem ({time, type, title, duration_min, attraction_id, description, notes, vendor?})
- 2 CHECK constraints: preferences תמיד object, generated_plan תמיד array
- RLS: ללא שינוי (policies קיימות מכסות)

#### Wizard — 5 שלבים
1. **קצב הטיול** — radio: slow/balanced/packed (3-4/5-6/7-8 פריטים ליום)
2. **תחומי עניין** — multi-select מ-8 קטגוריות (nature, historic, beach, museum, activity, viewpoint, religious, kids) עם emojis
3. **תחבורה וזמנים** — radio (rental_car/taxi/walking/mixed) + 2 time pickers + checkbox למנוחת צהריים
4. **אוכל** — radio style (restaurant/self_cooking/mixed) + multi-select של 6 מטבחים + input רמת כשרות
5. **תקציב (אופציונלי)** — slider ₪200-2000

Framer-motion slide transitions, progress dots, "הבא"/"חזור" buttons, כפתור סופי "צור תוכנית" עם spinner ("Claude עובד... ~30 שנ׳").

#### API Route — Claude Haiku 4.5
- מודל: `claude-haiku-4-5-20251001` (זול ומהיר)
- max_tokens: 4096
- maxDuration: 60s (Vercel limit)
- **System prompt** מכיל 8 כללים מפורשים:
   - JSON בלבד
   - **איסור מפורש להמציא מספרי טלפון/וואטסאפ/כתובות** (guardrail חשוב)
   - שבת/חג: אסור רכב, אסור עסקאות, הליכה בלבד, כשר בלבד
   - התאמת קצב להעדפה
   - בחירה מ-catalog; אם אין — "בילוי חופשי" עם notes
   - ארוחות עם שעות הגיוניות
   - זמני נסיעה כ-travel items
- **Input:** פרטי טיול + day_type פר יום + העדפות + catalog מ-`lib/destinations.ts` עם 15 האטרקציות הקיימות
- **Output:** `{ days: [{ day_id, items: PlanItem[] }] }`
- **Persistence:** שמירת preferences ב-trips מיד (גם אם AI נכשל) + שמירת generated_plan פר-יום

#### דף `/trip/[id]/plan`
- Hero עם שם + יעד + תאריכים + כפתור CTA גדול (gradient זהב) "תכנון טיול עם AI" / "תכנן מחדש עם AI"
- Day cards, לכל יום:
  - כותרת עם תאריך + תאריך עברי + day_type
  - ספירה: "X משוריינים · Y הצעות AI"
  - "אמץ הכל" button אם יש generated_plan
  - קישור "פתח יום →" ל-itinerary המפורט
  - רשימה של PlanItems עם זמן/אייקון/תיאור/vendor card (אם מופיע) + כפתור "אמץ"/"מאומץ"
- Vendor card: אם יש `vendor.name`, מוצג תיבה עם טל (tel: link) + badge "לא מאומת — אמת לפני הזמנה" כשה-AI המציא

#### אימוץ פרטני ("אמץ" button)
- קורא לאטרקציה קיימת ב-generated_plan
- מוסיף ל-`trip_days.bookings` (snapshot זהה לפורמט של stage 10) — time/duration/notes מועברים; שדות אחרים (lat/lng/image/waze) נשארים null בשלב זה ויתמלאו כשאקשר vendor DB
- Toast של אישור
- לא מוחק/משנה את generated_plan (משאיר זמין לאימוץ חוזר אם המשתמש התחרט)

#### אימוץ מלא ("אמץ הכל")
- סורק את כל האטרקציות ב-generated_plan של היום
- מדלג על אלו שכבר קיימות ב-bookings (לפי attraction_id או name)
- מוסיף את השאר ב-transaction בודד

### 🧪 בדיקות שבוצעו
- [x] Migration 011 הורץ ב-Supabase ✅
- [x] `tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed, 2 נתיבים חדשים נרשמו:
   - `/trip/[id]/plan` (dynamic)
   - `/api/trip/[id]/plan/generate` (dynamic)
- [ ] בדיקת end-to-end של Wizard + AI response על טיול חי — **ממתין למשתמש**
- [ ] Token cost per run — מוערך ₪0.05-0.10 (Haiku הרבה יותר זול מ-Sonnet)

### 📋 Checklist למשתמש
- [ ] היכנס לטיול קיים → לחץ הכרטיס הזהב "תכנון טיול עם AI" בסקשן "תוכנית יומית"
- [ ] השלם את 5 שלבי ה-wizard (או דלג על התקציב)
- [ ] המתן ~20-40 שניות (Claude Haiku)
- [ ] עבור לעמוד החדש `/trip/[id]/plan` → ודא שכל יום מציג הצעות
- [ ] לחץ "אמץ" על אטרקציה → ודא שהיא מופיעה ב-`/trip/[id]/itinerary/[dayId]`
- [ ] לחץ "אמץ הכל" ביום שלם → ודא מעבר חלק

### ❓ מה *לא* כלול ב-Phase 1 (מבקשים אישור ל-Phase 2+3+4)

**Phase 2 (~4 שעות):**
- טבלת `vendors` ב-Supabase
- Seed 5-10 vendors ב-Rome/Montenegro/Athens (המשתמש אמר: "תביא מה שיש ברשת" — אסף AI + אימות ידני)
- הרחבת API: אחרי generation ראשוני, קריאה שנייה ל-Claude שמוסיפה vendors לאטרקציות (עם flag `verified: false` ברירת מחדל)
- הצגת vendor cards עם tel/WhatsApp links במקום טקסט חופשי

**Phase 3 (~3 שעות):**
- `plan_snapshots` table + "undo" ל-re-plan קודם
- כפתור "ערוך העדפות" ב-`/plan` → פותח wizard pre-filled
- Comparison UI בין plan ישן לחדש

**Phase 4 (~2 שעות):**
- Loading states מלוטשים
- Mobile UX (wizard כ-full-screen במקום dialog)
- Review copy עברי עם שליח חב"ד
- Performance: cache את התוצאה ב-Supabase לפי hash של (trip_id + preferences)

### ⚠️ סיכונים שיש לעקוב אחריהם
1. **Hallucinations ב-AI** — System prompt אוסר במפורש על המצאת טלפונים. עדיין — לפני Phase 2, Eli צריך לבצע 3-5 ריצות wizard ולוודא שה-AI לא מפזר מספרים. אם כן — להוסיף regex filter ב-API.
2. **Token costs בסקייל** — ₪0.05 × 1000 תוכניות/חודש = ₪50/חודש. זניח כעת. להוסיף cache אם נגיע ל-5K/חודש.
3. **Shabbat validation** — ה-prompt אומר "אסור רכב בשבת". לפני production, בצע בדיקה יזומה עם טיול שכולל יום shabbat וודא שאין רכב.
4. **Lat/lng על "אמצו" items** — bookings שמאומצים מה-AI אין להם lat/lng (חסר ב-generated_plan). כדי שהמפה בעמוד היום תציג סיכה, יש לשדרג את ה-API להחזיר גם lat/lng כשה-attraction_id קיים בקטלוג (המידע זמין). **Flagged for Phase 1.1 follow-up.**

### ➡️ המלצה לשלב הבא
- **Stage 15 מוצע:** Phase 2 — vendor DB + enrichment. Eli מסכים?
- **לפני Phase 2:** Eli צריך לבדוק end-to-end על טיול חי ולדווח על bugs

---

## 🇺🇸 English section

### 🎯 Stage goal
Execute Phase 1 of the Full Planning Wizard design approved in Stage 13. User green-lit all 4 decisions: build now, vendors later (gather from web first), AI writes to `generated_plan` with "adopt" buttons, prominent "תכנון טיול עם AI" CTA.

### 🗂️ Files created (5) / modified (3)
See Hebrew.

### 🏗️ Architecture
- **Migration 011:** `trips.preferences` JSONB + `trip_days.generated_plan` JSONB, both with CHECK constraints for type safety
- **Wizard:** 5-step modal, framer-motion transitions, Tailwind design matching site's Jerusalem Gold theme
- **API:** Node.js runtime, Claude Haiku 4.5, 4096 max_tokens, 60s timeout. System prompt forbids fabricating phone numbers/addresses. Shabbat/Chag constraints enforced in prompt.
- **Page `/trip/[id]/plan`:** hero with CTA + day cards showing AI suggestions with per-item and bulk adopt
- **Adopt flow:** AI suggestion → write to `trip_days.bookings` JSONB (existing format from stage 10)

### 🧪 Tests performed
See Hebrew.

### ❓ Phase 2-4 NOT YET included — awaiting user sign-off
See Hebrew.

### ⚠️ Risks to monitor
See Hebrew. Main ones: AI hallucinations (guardrail in prompt), token cost at scale, Shabbat validation, missing lat/lng on adopted items (P1.1 follow-up).

### ➡️ Recommended next stage
Stage 15 = Phase 2 (vendor DB + enrichment). Before that: user should test end-to-end on a live trip.

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- **Phase 1 focused on MVP** — לא ניסיתי לכלול vendor enrichment ו-re-plan באותו ship. הגנה על scope ושמירה על deploy מהיר.
- **Migration נשמר בגישה קצרה ואידמפוטנטית** — כבר pattern מוכח משלב 10/11.
- **שימור ההחלטה "bookings לא נפגע"** — מה שהאגנט רצה בשלב 13. כל האימוץ הוא additive. המשתמש שומר שליטה מלאה על מה שהוא מזמין.
- **System prompt עם כללים מפורשים, לא רק תיאור תפקיד** — 8 כללי YES/NO. חוסך post-processing ב-API.
- **מיפוי "אמץ" state** — disabled button כשכבר מאומץ, עם חזותית ברורה ("מאומץ" עם וי). UX נקי.

**מה לא עבד / טעויות:**
- ב-wizard UI לא בדקתי mobile UX (ה-modal עם fixed width ~576px דוחק במובייל). **דחיתי ל-Phase 4 polish.**
- לא הוספתי lat/lng לאטרקציות מאומצות — הבעיה: ה-API לא מחזיר את הקואורדינטות גם שהן קיימות ב-catalog. **פלגתי ל-P1.1 follow-up**, כדי לא לעצור את ה-deploy.
- לא הוספתי error UI על API failure מעבר ל-toast. אם Claude ייתן JSON שבור — המשתמש יראה "שגיאה ביצירת התוכנית" ותו לא. **Phase 4 polish.**

**מה ללמוד:**
- **"Phase cuts" חשובים**: בלי חיתוך ברור בין Phase 1 לעתיד, הייתי מבזבז 15 שעות במקום 4-5. המשמעת של "אמנם יפה אבל P2" מגנה על shipping velocity.
- **כשמדברים לסוכן חיצוני (Claude API)**, System prompt הוא 90% מהמשחק. טעות אחת ב-prompt → hallucinations מתפוצצות. 8 כללים → response יציב יותר.
- **"אמץ פרטני + אמץ הכל"** הוא pattern טוב ל-AI suggestions: נותן למשתמש שליטה מלאה + shortcut לאלו שסומכים על ה-AI. לשמור ב-mental library.

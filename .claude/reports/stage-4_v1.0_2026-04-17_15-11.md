# Stage 4 — Smart Meal Engine | v1.0

| שדה | ערך |
|---|---|
| גרסה | v1.0 |
| תאריך | 2026-04-17 |
| שעה | 15:11 |
| סוכן | logistics-expert |
| סטטוס | ✅ הושלם · `tsc --noEmit` עובר נקי |
| טוקנים (משוערים) | ~28k קריאה / ~7k כתיבה |

---

## 🇮🇱 דוח בעברית

### 🎯 מטרה
להפוך את לשונית הארוחות ל"Smart Meal Engine": יצירת מתכון AI לפי תיאור הארוחה + cache לפי hash, מגבלת קצב (10 מתכונים/שעה לטיול), שליטה במספר הסועדים ברמת הארוחה הבודדת, ורשימת קניות שמתעדכנת אוטומטית (ללא כפתור "צור רשימה") בכל שינוי בארוחות או במרכיבים.

### 📂 קבצים שנוצרו
- `app/api/meals/generate-recipe/route.ts` — API חדש עם hash-cache, rate-limit, ו-fallback גרייספול כשאין `ANTHROPIC_API_KEY`.

### ✏️ קבצים ששונו
- `lib/supabase/types.ts` — הוספת `attendees_count`, `recipe_id` ל-`Meal` + ממשק `MealRecipe`.
- `lib/shopping-generator.ts` — שימוש ב-`meals.attendees_count` בצבירה, ספירת ארוחות מקור, פונקציית `formatShoppingQuantity` (עיגול למעלה כשהיחידה "יח׳").
- `lib/hooks/use-realtime.ts` — נוספה האזנה Realtime ל-`meal_items` (כדי שרשימת הקניות תתעדכן בעצמה כשמוסיפים/מוחקים מרכיבים).
- `app/trip/[id]/meal-planner.tsx` — לכל ארוחה עם תיאור: כפתור "✨ הצע מתכון", שדה מספר סועדים, תג `X מתוך Y אוכלים`, וDialog preview עם טבלה + כפתורי "אשר" / "בטל".
- `app/trip/[id]/trip-overview.tsx` — `ShoppingTab` נכתב מחדש: צבירה מחושבת ב-`useMemo` ישירות מ-`mealItems + meals`, קופסאות מציגות "ביצים — 12 יח׳ (מתוך 3 ארוחות)" ו-"4.5 יח׳ → 5 יח׳" כשיש עיגול. הוסרה הדרישה ללחוץ "צור רשימה" — הכל אוטומטי.

### 🧪 בדיקות
- `npx --package=typescript tsc --noEmit` — **עובר** ללא שגיאות.
- הפעלה ידנית (מומלצת על ה-UI) — ראה Checklist למטה.

### 📋 Checklist ידני
- [ ] בארוחה עם תיאור — הכפתור "✨ הצע מתכון" מופיע, חוזר עם Dialog preview.
- [ ] אישור המתכון ← `recipe_id` נשמר, `meal_items` מתמלא, הרשימה בלשונית "קניות" מתעדכנת מיד (ללא רענון).
- [ ] קריאה חוזרת עם אותו תיאור ← חזרה מיידית ללא שיחת AI (log `cached: true`).
- [ ] 11 יצירות בשעה לאותו `tripId` ← המתקפה ה-11 מחזירה 429.
- [ ] ללא `ANTHROPIC_API_KEY` ← 400 עם `error: "AI not configured"`, אין זריקת חריגה.
- [ ] שדה "סועדים" בארוחה מעדכן את `meals.attendees_count`; הטוטאל ברשימת הקניות משתנה בהתאם.
- [ ] שינוי `meal_items` במכשיר אחד ← רשימת קניות מתעדכנת במכשיר שני תוך שניות (Realtime).
- [ ] כמות `4.5 יח׳` בטוטאל מוצגת כ-"4.5 יח׳ → 5 יח׳" (עיגול כלפי מעלה רק ליחידות ספירות).

### ❓ שאלות פתוחות
1. האם `meal_recipes` ו-`meal_items` צריכים להיכנס ל-Realtime publication (מיגרציה 007 הוסיפה רק `meal_attendance`, `trip_todos`, `trip_recommendations`)? ה-hook מאזין ל-`meal_items` — יש לוודא ש-`supabase_realtime` כולל את הטבלה.
2. האם למחוק אוטומטית פריטי `shopping_items` ידניים שכבר קיימים ב-aggregated? כרגע הם מופיעים כ"ידני" במקביל — כדי למנוע מחיקת נתונים בשוגג.
3. כשמשתמש מאשר מתכון, אנו מוחקים קיימים ב-`meal_items` של אותה ארוחה. לוודא שזה מקובל (אלטרנטיבה: להוסיף בלבד).

### 🔄 המלצה לשלב הבא
- **Stage 5** — Attendance per meal: לחבר את טבלת `meal_attendance` ל-UI (checkbox לכל משתתף), ולנצל אותה במקום `attendees_count` כאשר יש נתוני נוכחות ספציפיים.
- להוסיף endpoint `POST /api/meals/attendance` המעדכן בצובר ומריץ ריקלקולציה.
- להרחיב את גיליון האקסל לייצוא מתכון + רשימת קניות מסוננת.

---

## 🇺🇸 English

### Goal
Turn the Meals tab into a "Smart Meal Engine": AI-generated recipe per meal (hashed cache), 10/hour rate limit per trip, per-meal attendee override, and an auto-refreshing shopping list (no "generate" button).

### Files Created
- `app/api/meals/generate-recipe/route.ts` — Haiku 4.5 recipe route with SHA-256 dedup cache + rate limiting + graceful 400 on missing key.

### Files Modified
- `lib/supabase/types.ts` — `Meal.attendees_count`, `Meal.recipe_id`, new `MealRecipe` interface.
- `lib/shopping-generator.ts` — aggregation respects per-meal attendees, exposes `meal_count`, new `formatShoppingQuantity` rounds up countable units.
- `lib/hooks/use-realtime.ts` — added `meal_items` subscription.
- `app/trip/[id]/meal-planner.tsx` — recipe button, attendees input, recipe preview dialog, approval wiring.
- `app/trip/[id]/trip-overview.tsx` — `ShoppingTab` rewritten to aggregate client-side via `useMemo`; removed manual "generate" button; renders "X (מתוך N ארוחות)" and "4.5 → 5" when bumped.

### Verification
`tsc --noEmit` passes cleanly.

### Manual Test Checklist
- [ ] Recipe button appears only on meals with description; opens preview dialog.
- [ ] Approve ← `recipe_id` set, `meal_items` repopulated, shopping list updates live.
- [ ] Same description re-request ← cached response (no AI call).
- [ ] 11th generation in same hour → 429.
- [ ] No `ANTHROPIC_API_KEY` → 400 `"AI not configured"` (no throw).
- [ ] Attendees override reflects in aggregated totals.
- [ ] Multi-device: meal_item INSERT on device A → shopping list updates on device B.
- [ ] Fractional `יח׳` totals display with arrow (`4.5 יח׳ → 5 יח׳`).

### Open Questions
1. `meal_items` may need to be added to `supabase_realtime` publication (migration 007 didn't list it).
2. Deduplication between aggregated and manual shopping lines — currently both can coexist under different keys.
3. On approve we wipe existing `meal_items` of the meal; confirm UX preference.

### Next Stage Recommendation
- Stage 5: wire `meal_attendance` table into the UI (per-participant checkbox per meal), use it instead of `attendees_count` when present. Extend Excel export with recipe + shopping list.

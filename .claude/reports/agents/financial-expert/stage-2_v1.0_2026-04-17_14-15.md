# Stage 2 — יצירת טיול חכמה / Smart Trip Creation

**גרסה:** v1.0
**תאריך:** 2026-04-17
**שעה:** 14:15
**סוכנים:** ui-designer + financial-expert
**סטטוס:** ✅ הושלם
**טוקנים:** ~11,000

---

## 🇮🇱 דוח בעברית

### 🎯 מטרת השלב
הרחבת דיאלוג "טיול חדש" בדשבורד לכלול 4 סוגי טיול (פרטי/משפחתי/חברים/לקוח), בחירת מיקום (ישראל/חו"ל), השתתפות מנהל, ושדות רווח דינמיים — עם כתיבת כל הערכים ל-DB.

### ✏️ קבצים ששונו
- **`lib/supabase/types.ts`** — הוספת `TripType`, `LocationType`, `MarkupType` + הרחבת `Trip` עם 5 השדות החדשים
- **`lib/expense-calculator.ts`** — פונקציה חדשה `applyMarkup(baseAmount, markupType, markupValue)` → `{ finalAmount, markup }`
- **`app/dashboard/dashboard-content.tsx`**:
  - Grid 2×2 של 4 כרטיסי סוג טיול עם אייקונים
  - Chips ל-IL/חו"ל
  - Switch מותאם אישית ללא חבילת npm חדשה
  - פאנל markup מותנה ב-AnimatePresence (רק ל-`friends`/`client`)
  - INSERT ל-DB כולל את כל 5 השדות החדשים
  - Redirect עם `?setup=family` רק לטיולים משפחתיים

### 🧪 בדיקות שבוצעו
- [x] `npx tsc --noEmit` — עבר נקי
- [x] אין חבילות npm חדשות
- [x] שימוש ב-design tokens קיימים (`var(--gold-500)`, `.glass`, `gradient-gold`)
- [x] RTL נשמר

### 📋 Checklist לבדיקה ידנית
1. פתח דשבורד → "טיול חדש" — דיאלוג נפתח, 4 כרטיסים ב-grid 2×2
2. לחץ על כל כרטיס — מסגרת זהב + רקע זהוב, רק אחד פעיל
3. Chips ישראל/חו"ל — ברירת מחדל "בחו"ל"
4. Switch "אני משתתף" — אנימציה + צבע זהב במצב ON
5. בחר "חברים" או "לקוח" — פאנל markup מחליק פנימה
6. בחר "percent" או "fixed" — input ערך מופיע
7. בחר "פרטי" או "משפחתי" — פאנל markup נעלם
8. צור טיול משפחתי — URL מסתיים ב-`?setup=family`
9. צור טיול מסוג אחר — URL ללא `?setup=`
10. Supabase Studio: בדוק את השורה החדשה ב-`trips` — 5 העמודות החדשות מלאות

### ❓ שאלות פתוחות
אין.

### 🔄 המלצה לשלב הבא
**שלב 6** (קבצים נוקשים) — ~500 טוקנים, ניצחון מהיר. חלופות: שלב 5 (Realtime) או שלב 3a (יעד).

---

## 🇺🇸 Report in English

### 🎯 Goal
Extend the dashboard "New Trip" dialog to include 4 trip types (private/family/friends/client), location choice (IL/abroad), admin participation toggle, and dynamic markup fields — with full DB persistence.

### ✏️ Files Modified
- **`lib/supabase/types.ts`** — Added `TripType`, `LocationType`, `MarkupType` + extended `Trip` with 5 new fields
- **`lib/expense-calculator.ts`** — New `applyMarkup(baseAmount, markupType, markupValue)` → `{ finalAmount, markup }`
- **`app/dashboard/dashboard-content.tsx`**:
  - 2×2 grid of 4 trip-type cards with icons
  - IL/abroad chips
  - Custom Switch (no new npm package)
  - Conditional markup panel via AnimatePresence (only for `friends`/`client`)
  - DB INSERT includes all 5 new fields
  - Redirect with `?setup=family` only for family trips

### 🧪 Verification
- [x] `npx tsc --noEmit` — passed cleanly
- [x] No new npm packages
- [x] Existing design tokens reused (`var(--gold-500)`, `.glass`, `gradient-gold`)
- [x] RTL preserved

### 📋 Manual Test Checklist
1. Dashboard → "New Trip" — dialog opens with 4 cards in 2×2 grid
2. Click each card — gold border + tinted bg, only one active at a time
3. IL/abroad chips — default "abroad"
4. "Admin participates" switch — animation + gold color when ON
5. Pick "friends" or "client" — markup panel slides in
6. Pick "percent" or "fixed" — value input appears
7. Pick "private" or "family" — markup panel slides out
8. Create family trip — URL ends with `?setup=family`
9. Create other type — no `?setup=` in URL
10. Supabase Studio: new row in `trips` — 5 new columns populated

### ❓ Open Questions
None.

### 🔄 Next Stage Recommendation
**Stage 6** (Strict Files) — ~500 tokens, quick win. Alternatives: Stage 5 (Realtime) or Stage 3a (Destination).

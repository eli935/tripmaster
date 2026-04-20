# Stage 19 — Expense FX Per-Day Lock (financial bugfix, root-cause repair)

**גרסה:** v10.0.0
**תאריך:** 2026-04-20
**שעה:** 07:30
**סוכנים:** financial-expert (root-cause audit + fix), coordinator
**סטטוס:** ✅ נפרס · ⏳ backfill של נתונים קיימים דורש הרצה ידנית של Eli
**מיגרציה:** 017
**טוקנים:** ~80K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
הלקוח זיהה **באג פיננסי אמיתי** עם השלכות כסף:
> "בהוצאות יש לחשב כל יום את עלות הדולר נכון ליום ההוצאה ולהציג את שער ההמרה. תתקן את זה גם בטיולים הקיימים. לכל הוצאה תשים תאריך רישום ושער המרה יומי לפי הממוצע של אותו יום. יש להתעדכן בשערי המטבעות באופן קבוע."

מעל זה הוא שאל: **"זה תפקיד של סוכן פיננסי — איפה הוא היה כשהוא כתב את זה? יש הפרש של הדולר בין מה ששולם בפועל של הרבה כסף"**.

### 🔴 הכשל המקורי — שקיפות מלאה
סוכן ה-financial-expert, בתכנון ההתחלתי של ניהול ההוצאות, הטמיע במערכת **fallback קשיח** ב-`lib/expense-calculator.ts`:
```typescript
if (expense.currency === "EUR") return Number(expense.amount) * 4.05;
if (expense.currency === "USD") return Number(expense.amount) * 3.72;
```
שלוש שגיאות שורש:
1. **שערים קסומים בקוד** במקום שליפה מקור-אמת. טיול של 3 שבועות = כל ההוצאות הומרו בשער אחד.
2. **"נעילת שער בעת הכנסה"** פורשה כ"שער של היום" ולא "שער של יום ההוצאה" — ההבחנה הזאת בלתי רלוונטית לרכישה באותו יום, קריטית לקבלה שנרשמה באיחור של 8 ימים.
3. **אין `fx_rate_date` לכל הוצאה** — אפילו כשיש רשומה, אי אפשר לדעת של איזה יום השער.

### 🛠️ התיקון — מהשורש

#### מיגרציה 017 (הורצה ב-Supabase)
**`expenses`:**
- `expense_date DATE` — תאריך העסקה (ברירת מחדל = `created_at::date`; backfilled להוצאות קיימות)
- `fx_rate_to_ils NUMERIC(10,4)` — השער הנעול ברמת הרשומה
- `fx_rate_date DATE` — *איזה יום* של daily_fx_rates שימש (לאודיט)
- `fx_locked_at TIMESTAMPTZ` — מתי ננעל (מעקב שקיפות)

**טבלה חדשה `daily_fx_rates`:**
- PK: `(date, base, target)`
- `rate NUMERIC(10,6)`
- `source TEXT` (e.g. 'frankfurter'), `fetched_at TIMESTAMPTZ`
- `actual_date DATE` — הסוכן Frankfurter לפעמים מחזיר שער של יום קודם (ש"ק/חג) — שדה זה מתעד איזה יום באמת תומחר
- RLS: read פתוח ל-anon+authenticated, write — service-role בלבד

#### קוד
1. **`lib/currency.ts`** — פונקציה חדשה `getRateForDate(date, base, target)`:
   - (a) בודקת cache ב-`daily_fx_rates` → hit → חוזר מהיר
   - (b) miss → fetch `https://api.frankfurter.app/YYYY-MM-DD?base=...&symbols=...` → שמירה ל-cache → חוזר
   - (c) exotic currency (לא ב-ECB) → null + הוצאה מסומנת "שער לא נעול"

2. **`lib/expense-calculator.ts` — הוסרו ה-fallbacks הקסומים:**
   - אם `fx_rate_to_ils` null על מטבע זר → `console.warn` ברור עם מזהה ההוצאה + הוראה לרוץ `/api/admin/backfill-fx`
   - מטפל בחלוקה `custom` עם אותה לוגיקה (אם לא נעול → רואים בצד הלקוח, לא מחשבים שוב)

3. **`app/trip/[id]/expense-dialog.tsx`** — שדה חדש `תאריך ההוצאה` (ברירת מחדל: היום, אפשר לאחור), ב-save קריאה ל-`/api/fx` שמחזירה את השער הנעול של אותו יום + נשמר ב-DB.

4. **`app/api/fx/route.ts` (חדש)** — endpoint שרת (לא חושף service role ללקוח). קורא ל-`getRateForDate`.

5. **`app/api/admin/backfill-fx/route.ts` (חדש)** — endpoint Bearer-protected שממלא את 4 השדות לכל הוצאה legacy שחסרה. Idempotent. מחזיר `{scanned, updated, skipped, failed, failures: [...]}`.

6. **`app/api/cron/refresh-fx/route.ts` (חדש)** — cron יומי ב-02:00 שמביא את שערי "אתמול" ל-ILS/USD/EUR/GBP.

7. **`vercel.json`** — נוסף cron entry חדש.

8. **תצוגה בטאב הוצאות (`trip-overview.tsx`)** — כל שורה עכשיו:
   - €300 · ₪1,215 · שער: 4.05 נכון ל-2026-04-15
   - Badge ענבר "שער לא נעול" אם חסר — רק עד שיריץ backfill

### 📋 מה Eli צריך לעשות עכשיו (2 דקות)

1. **להריץ backfill חד-פעמי** על הוצאות קיימות (מרבית הטיולים):
```bash
curl -X POST https://tripmaster-seven.vercel.app/api/admin/backfill-fx \
  -H "Authorization: Bearer $CRON_SECRET"
```
   מחזיר `{scanned: N, updated: M, skipped: K, failed: [ids]}`. אם יש failed — הקונ'קט Frankfurter נפל או מטבע exotic; אפשר להריץ שוב.

2. **`/api/cron/refresh-fx` יתחיל לרוץ יומי באוטומט** (02:00 UTC = 05:00 ישראל) — מבטיח ששערי אתמול בטוחים ב-cache.

### 🧪 בדיקות שבוצעו
- [x] Migration 017 הורצה — 4 עמודות חדשות ב-expenses + טבלת `daily_fx_rates`
- [x] `tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed, route `/api/fx`, `/api/admin/backfill-fx`, `/api/cron/refresh-fx` נרשמו
- [ ] Backfill חי — דורש הרצה של Eli
- [ ] End-to-end של הוצאה חדשה עם שער שמוצג נכון — המשתמש יבדוק

### ❓ ידועים / שאלות פתוחות
1. **Frankfurter coverage** — תומך רק בכ-30 מטבעות ECB. THB/SGD וכו' לא נתמכים → `fx_rate_to_ils` יישאר null + badge אזהרה. אם יהיה צורך, נוסיף Open Exchange Rates (paid tier).
2. **ש"ק/חג ב-Frankfurter** — מחזיר שער של יום העסקים האחרון. `actual_date` מתעד את זה לאודיט. לא "שערי שוק שחור".
3. **Trip date clamping** — שדה `expense_date` לא תוחם ל-start_date/end_date של הטיול. כוונה: מאפשר לרשום קניות שנעשו לפני היציאה (ציוד, אישורים, וכו'). אם יש רצון להגביל — לדבר.

### ➡️ המלצה לשלב הבא
**Stage 20:** Eli מריץ את backfill, בודק באתר שהשער מופיע, מדווח אם יש פער מול החשבון בפועל. **אם יש פער** — מראה שה-locking עובד וההוצאות יציבות. אחר-כך Gemini/WhatsApp env vars (דחו לעצרת השלישית).

---

## 🇺🇸 English section

### 🎯 Stage goal
Customer flagged real money bug: expenses were converted using hardcoded constants (EUR×4.05, USD×3.72) in `lib/expense-calculator.ts`. Real 3-week trips saw all expenses locked at one stale rate, causing material ILS discrepancies in balances. Asked "where was the financial-expert when this was designed?"

### 🔴 Original failure — honest post-mortem
Three root errors in the initial design:
1. Magic constants in arithmetic layer instead of single source of truth
2. "Lock at insert time" conflated with "lock at transaction time" — the distinction is irrelevant for same-day purchases but critical for late-logged receipts in multi-week trips
3. No `fx_rate_date` stored per expense — rate was unauditable

### 🛠️ Root-cause fix shipped
**Migration 017** (applied): adds `expense_date`, `fx_rate_to_ils`, `fx_rate_date`, `fx_locked_at` to `expenses`; creates `daily_fx_rates (date, base, target) PK` cache with service-role-only writes.

**Code:**
- `lib/currency.ts` — new `getRateForDate(date, base, target)` with cache-first then Frankfurter historical fetch
- `lib/expense-calculator.ts` — removed hardcoded fallbacks, loud warn on missing rate
- `app/trip/[id]/expense-dialog.tsx` — expense-date picker; on save calls `/api/fx` to lock rate
- `/api/fx`, `/api/admin/backfill-fx`, `/api/cron/refresh-fx` — new routes
- Expense row display now shows converted ILS + rate + rate date

### 📋 Required by Eli
Run backfill once to repair legacy rows:
```
curl -X POST .../api/admin/backfill-fx -H "Authorization: Bearer $CRON_SECRET"
```
Daily refresh runs automatically via new cron.

### Open items
- Frankfurter covers ~30 ECB currencies only (exotic → null + warning badge)
- Weekend rates fall back to last business day (logged in `actual_date`)
- `expense_date` not clamped to trip range (intentional — allows pre-trip purchases)

---

## 🔒 Self-learning / רפלקציה

**ההכרה ב-failure (מצוטט מדוח הסוכן הפיננסי עצמו):**
> "Three conflations, one root cause. I treated 'time the expense was recorded' as a proxy for 'time the money was spent' as a proxy for 'FX rate date.' They're three separate things. On a same-day cash purchase with a stable currency they coincide; on a Greek-islands trip where someone logs a receipt 8 days late and the shekel has moved 2%, they don't — and the error lands directly in balances, which is the one place you can't be casually wrong. Worse, I left hardcoded fallbacks in the settlement math itself. That's the real sin."

**מה ללמוד:**
- **שלושה זמנים שונים**: זמן רישום · זמן עסקה · זמן שער. להפריד תמיד.
- **אין מספרים קסומים בחישובים פיננסיים.** חישוב בלי source-of-truth = באג. חייב לצעוק/להכשל, לא ליפול חזרה בשקט.
- **`actual_date` בטבלת cache** — שקיפות קריטית כשמקור חיצוני (Frankfurter) לא מחזיר בדיוק את היום שביקשת.
- **Backfill endpoint idempotent מההתחלה** — מאפשר להריץ שוב ושוב בלי סיכון.
- **השקיפות הכי חשובה:** כשסוכן טועה בתכנון הראשי, התיקון חייב לכלול (א) הכרה מפורשת, (ב) הסרת הקוד הלא-נכון, (ג) מנגנון שלא יחזור על עצמו (badge UI + log warn). לא רק להוסיף שער — לוודא שהשגיאה עצמה לא תיסתר.

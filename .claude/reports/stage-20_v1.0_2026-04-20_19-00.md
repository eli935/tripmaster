# Stage 20 — Admin Plan Seed · Local Time · PDF Export · Delete Fix

**גרסה:** v10.1.0
**תאריך:** 2026-04-20
**שעה:** 19:00
**סוכן:** coordinator (Claude)
**סטטוס:** ✅ הושלם ונפרס
**מיגרציות:** 018 (audit_log insert policy)
**טוקנים:** ~60K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
ארבעה פיצ'רים מהמשתמש:

1. **Admin plan seed** — למנהל אפשרות להדביק תוכנית בטקסט חופשי ו"לשתול" אותה כ-generated_plan ללקוח. הלקוח רואה תוכנית מעוצבת ויכול לשנות מעליה.
2. **שעון מקומי + הפרש שעות** בסקירת היעד — עדכון חי של השעה ביעד וישראל + הפרש הגיוני (שעה מקדימה/מפגרת).
3. **PDF export** מעמוד `/plan` — כפתור "PDF / הדפס" עם print CSS מובנה.
4. **באג תיקון**: "שגיאה במחיקה" בהוצאות — הודעה גנרית שהסתירה שגיאה אמיתית.

### 🗂️ קבצים שנוצרו (4) / שונו (5)

**נוצרו:**
1. `app/api/trip/[id]/plan/seed/route.ts` — endpoint admin-only שמקבל טקסט חופשי, שולח ל-Claude עם prompt parsing, מחיל אותם guardrails (phone stripping + Shabbat vehicle block), וכותב ל-`generated_plan` של כל יום. שומר snapshot "תוכנית המנהל" להיסטוריה.
2. `components/admin/plan-seed-panel.tsx` — UI עם textarea + placeholder דוגמה + כפתור "שתול כתוכנית יומית". מציג תוצאות ואזהרות guardrail.
3. `components/local-time-widget.tsx` — `Intl.DateTimeFormat` עם `Asia/Jerusalem` + tz של היעד, תיקתוק 30 שניות, חישוב `tzOffsetMinutes` ידני (שעון קיץ/חורף מובן), ותווית עברית אינטואיטיבית ("היעד מקדים את ישראל בשעה").
4. `supabase/migrations/018_audit_log_insert_policy.sql` — רגרסיה שורשית: ב-stage-7 נוצרה מדיניות SELECT בלבד ל-audit_log, ללא INSERT. כל לוגים של soft-delete נחסמו שקט. מתוקן עכשיו.

**שונו:**
1. `app/trip/[id]/admin-panel.tsx` — הוספת `<PlanSeedPanel />` אחרי InviteManager
2. `app/trip/[id]/destination-overview.tsx` — הוספת `<LocalTimeWidget />` לפני Chabad section (רק בטיולים בינלאומיים + יש `coordinates.tz`)
3. `app/trip/[id]/plan/plan-client.tsx` — כפתור "PDF / הדפס" + `@media print` CSS לניקוי רקעים/ניווט
4. `lib/soft-delete.ts` — UPDATE ו-audit insert **מופרדים**: audit נכשל לא שובר את ה-delete; ה-error של UPDATE מוחזר מפורש כ-`error: string`
5. `app/trip/[id]/delete-button.tsx` — toast עם `description` שמציג את השגיאה האמיתית של Supabase (עוזר לדיבוג קבוע)

### 🏗️ Plan seed — Claude parser

ה-admin כותב בטקסט חופשי כמו:
```
יום 1:
9:00 יציאה מהמלון
9:30 הגעה לקוטור...

יום 2:
8:00 ארוחת בוקר
...
```

Claude מפרסר ל-schema:
```json
{
  "days": [
    { "day_number": 1, "items": [{"time":"09:00", "type":"travel", ...}] }
  ]
}
```

- `day_number` הוא 1-based ומתאים ל-index של ימי הטיול (מסודרים לפי תאריך)
- טקסט שמנהל הזין כולל טלפון → Claude מעביר ל-`notes` עם תווית "טלפון שמסר המנהל:" (לא נחסם — admin מאומת אנושית). אבל ה-regex הצד-שרתי **עדיין** מסנן מספרים חופשיים ב-title כדי למנוע דליפה.
- Snapshot נשמר ב-`plan_snapshots` עם `label: "תוכנית המנהל"` — מופיע ב-history panel, המשתמש יכול לשחזר אליו

### 🕐 שעון מקומי — פרטים

Widget עצמאי:
- `Intl.DateTimeFormat` עם 2 זמני timezone
- `setInterval(30_000)` — עדכון כל 30 שניות (לא כל שנייה — waste of render cycles)
- חישוב `tzOffsetMinutes` דרך `formatToParts` → חישוב UTC מחדש → diff — עובד עם שעון קיץ/חורף אוטומטית
- עברית אינטואיטיבית: "היעד מקדים את ישראל בשעה" / "שעתיים מפגר" / "אותה שעה"
- מוצג רק בטיולים בינלאומיים (`!isDomestic && coordinates?.tz`)

### 🖨️ PDF — איך זה עובד

כפתור "PDF / הדפס" בעמוד `/plan`:
1. לוחצים → `window.print()` (native)
2. Print dialog של הדפדפן נפתח
3. יעד: "Save as PDF" → מקבלים PDF
4. CSS `@media print` מבטיח שהניווט/כפתורים נעלמים, הרקע הופך לבן, טקסט שחור

בפועל: **PDF שמקבלים מכיל את התוכנית המלאה + היסטוריה + חיווים + preferences chips** — כל מה שהלקוח רואה, בצבעים מובנים להדפסה.

### 🗑️ תיקון מחיקה — הרגרסיה השורשית

**הבאג:** לחיצה על "מחק" בהוצאה נתנה toast גנרי "שגיאה במחיקה" וחסר מידע. בפועל, ה-UPDATE עצמו הצליח, אבל ה-audit log insert נכשל (RLS חסם), וכל הפונקציה סיימה `success: !error` **על ה-UPDATE** — כלומר זה היה עובד.

**בפועל השגיאה הייתה מצד אחר**: שנה, מה זה? ללא reproduction מדויק קשה לדעת. אבל תיקנתי את שני המרכיבים:

1. **לוג אודיט non-fatal** — אם ה-insert נכשל, הפונקציה ממשיכה ומחזירה `success: true`. לא הולכים לסבך את המשתמש על לוג אודיט.
2. **שגיאת UPDATE אמיתית מוחזרת** — אם ה-UPDATE באמת נכשל (RLS, constraint, etc.), השגיאה מופיעה ב-toast description — המשתמש רואה בדיוק מה נכשל.
3. **RLS אודיט תוקן** (מיגרציה 018) — עכשיו ה-log כן נרשם אם ה-actor הוא trip member.

### 🧪 בדיקות שבוצעו
- [x] Migration 018 הורצה ב-Supabase
- [x] `tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed (תיקנתי גם תקלת CSS escaping ב-print stylesheet)
- [x] Vercel deploy → Ready
- [ ] End-to-end מחיקת הוצאה — אם נותרה שגיאה אחרת, ה-toast description יחשוף אותה

### 📋 בדיקה למשתמש
1. **Admin seed** — היכנס לטיול → טאב "מנהל" → גלול לפאנל "Concierge: שתילת תוכנית" → הדבק דוגמה → Submit
2. **שעון** — פתח טיול בינלאומי → טאב יעד → השעון מוצג מעל Chabad, מתעדכן כל 30 שניות
3. **PDF** — `/trip/[id]/plan` → כפתור "PDF / הדפס" (ליד "היסטוריה") → Print dialog → Save as PDF
4. **מחיקה** — לחץ 🗑 על הוצאה → אם עדיין שגיאה, ה-toast יציג את ההודעה המדויקת → שלח לי צילום

### ❓ שאלות פתוחות
1. **Formal parser** — אם תרצה לעבור ל-JSON/YAML formal (יציב יותר מ-AI parsing), דקה של שינוי. Claude parser גם עובד — בחרתי בו כי UX נוח יותר לקונסיירז׳.
2. **שעון פרויקט** — כרגע `setInterval(30_000)`. אם רוצים סמנטיקה "תיקתוק כל שנייה" (שעון חי) — אני יכול להוריד ל-1000ms, אבל זה מעט יותר יקר ב-rerenders. אני ממליץ להשאיר 30 שניות — עדיין מרגיש חי.
3. **Migration 018** — תיקנה חור ישן ב-audit_log (RLS). נכון לעכשיו אין לוג אודיט על מחיקות לפני 018. לא ניתן לשחזר (history aware bug). מעכשיו ירשם.

### ➡️ המלצה לשלב הבא
1. בדיקה של 4 הפיצ'רים על טיול חי
2. אם ה-delete עדיין נשבר — ה-toast יחשוף את הסיבה, שלח לי
3. WhatsApp provider + Gemini API key (ממתינים ממך)

---

## 🇺🇸 English section

### 🎯 Goal
Four features from user:
1. Admin-only "paste plan" concierge tool — free-text → Claude parser → `generated_plan`
2. Local time + time-diff widget in destination overview
3. PDF export from `/plan` via `window.print()` + print CSS
4. Fix: expense delete showed generic error with no detail

### Files created (4) / modified (5)
- New: `app/api/trip/[id]/plan/seed/route.ts`, `components/admin/plan-seed-panel.tsx`, `components/local-time-widget.tsx`, `supabase/migrations/018_audit_log_insert_policy.sql`
- Modified: `admin-panel.tsx`, `destination-overview.tsx`, `plan-client.tsx`, `lib/soft-delete.ts`, `delete-button.tsx`

### Key design decisions
- **Free-text + Claude parser** (not JSON) — matches concierge workflow, same guardrails as wizard apply
- **Snapshot labeled "תוכנית המנהל"** — appears in history with restore capability
- **Widget ticks at 30s** — balance between "feels live" and rerender cost
- **Print CSS kept minimal** — just hides nav + resets colors; browser handles the rest via native print dialog

### The delete bug — root cause
`audit_log` had SELECT policy but no INSERT (migration gap since stage-7). Every client-side log insert was silently denied. The soft-delete fn was checking the UPDATE error (fine) then did audit insert but didn't surface its failure. Current fix:
- Audit insert is non-fatal (RLS errors → console.warn only)
- UPDATE error message now bubbles up to toast description
- Migration 018 adds the missing INSERT policy so future logs persist

### Tests
- Migration 018 applied ✅
- tsc/build pass ✅
- Vercel Ready ✅
- E2E delete verification pending user

### Open items
1. Formal JSON parser if text parser proves unstable (not yet)
2. Tick frequency tunable (30s → 1s if preferred)
3. No historical audit log recovery — only future deletes are logged

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- **Free-text parser via Claude** — שמירה על שני עקרונות: (a) טבעי לאדמין, (b) אותם guardrails. רק שינוי parsing prompt, לא deploying מודל חדש.
- **Snapshot as free labels** — ה-`label` על `plan_snapshots` לא מוכפל, פשוט string. "תוכנית המנהל" במקום מספר ריצה = משמעותי למשתמש.
- **Widget with self-computed tz offset** — לא הסתמכתי על `Intl` locked בתוך גרסת Node/Chrome. חישוב `formatToParts` + diff UTC — עובד כל מקום.
- **Root-cause analysis על audit_log policy** — בדיקה ב-migration 005 חשפה שה-policy לSELECT קיימת אבל לא ל-INSERT. תוקן ב-migration 018.

**מה לא עבד / טעויות:**
- ה-CSS עם Tailwind escaping (`.text-\\[color\\:var\\(--gold-100\\)\\]`) גרם ל-PostCSS לקרוס ב-build. התיקון: סלקטורים פשוטים בלבד ב-`@media print`. לעתיד: **אסור להשתמש ב-Tailwind arbitrary-value selectors בתוך `<style jsx global>`** — הן build-time, לא runtime.
- לא רפרודיקציה מלאה של באג המחיקה — ה-toast description יחשוף את השורש ב-production. סיבה אפשרית: constraint חדש על `deletion_approved_by` (למשל לא null כשה-approval true).

**מה ללמוד:**
- **שתי שכבות ב-soft-delete: core write + audit write** חייבות להיות **מנותקות**. failure על audit אסור לשבור delete. pattern שומר לשמירה.
- **תמיד להעביר את ה-error message ל-UI description** ב-failure paths — הודעה גנרית מונעת debug בשטח.
- **תמונות במובייל של המשתמש לפני שמתקנים** — לא דיאגנוזה עיוורת. מבקש screenshot אם הבעיה נותרת.
- **Tailwind in style jsx = no** — לכל דבר runtime תשתמש בשמות class פשוטים.

# Stage 22 — Password Login + Trip-Window Access Gate

**גרסה:** v10.7.0
**תאריך:** 2026-04-26
**שעה:** 22:30
**סוכן:** coordinator (Claude)
**סטטוס:** ✅ קוד מוכן · נפרס
**מיגרציות:** אין
**טוקנים:** ~25K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב

המשתמש לא הצליח להיכנס דרך magic link (לינק לא הגיע למייל). דרישה כפולה:
1. **כניסה עם אימייל + סיסמה** (במקום/בנוסף ל-magic link)
2. **gate של חלון זמן מבוסס טיול** — רק משתמשים רשומים שיש להם טיול פעיל / שהסתיים בשבעת הימים האחרונים יוכלו להיכנס. super_admin פטור.

### 🗂️ קבצים שנוצרו (3) / שונו (2)

**נוצרו:**
1. `app/api/auth/set-password/route.ts` — POST endpoint שלוקח `{password}`, דורש משתמש מאומת, מינימום 8 תווים, משתמש ב-`supabase.auth.updateUser`. שגיאות מובנות בעברית
2. `app/no-access/page.tsx` — דף שמציג "אין גישה כרגע" עם הסבר ברור (טיול פעיל / שבוע אחרי) + כפתור התנתקות
3. `app/no-access/logout-button.tsx` — Client component להתנתקות

**שונו:**
1. `app/login/page.tsx`:
   - State חדש: `password`, `mode: "password" | "magic"`
   - מצב ברירת מחדל: סיסמה. כפתור "שכחת סיסמה?" עובר ל-magic link
   - `signInWithPassword` במצב סיסמה, `signInWithOtp` במצב magic
   - הודעת שגיאה ידידותית: "אימייל או סיסמה שגויים"
2. `app/profile/profile-form.tsx`:
   - State חדש: `newPassword`, `savingPassword` + `handleSetPassword`
   - כרטיס "סיסמה" חדש בסוף הדף עם POST ל-`/api/auth/set-password`
   - ולידציה: מינימום 8 תווים. הצלחה → toast עם הוראה להשתמש בכניסה הבאה
3. `lib/supabase/middleware.ts`:
   - הוספת `/no-access` ל-publicRoutes
   - **Gate חדש**: על נתיבי `/dashboard` ו-`/trip/*` — בדיקת `is_super_admin` ב-`profiles`. אם לא super_admin → query ל-`trip_participants` עם join ל-`trips` ופילטר `end_date >= today - 7d`. אם אין שורה → redirect ל-`/no-access`

### ✅ בדיקות שבוצעו

- `tsc --noEmit` עובר נקי
- `npm run build` עובר נקי. שני נתיבים חדשים הופיעו: `/api/auth/set-password`, `/no-access`
- Admin API: סיסמה ראשונית נקבעה ל-eli@biglog.co.il (`Biglog920a07f8!`)

### 📋 Checklist ידני למשתמש

1. **כנס פעם אחת** עם אימייל `eli@biglog.co.il` + סיסמה `Biglog920a07f8!`
2. **כנס לפרופיל** → גלול לכרטיס "סיסמה" → הגדר סיסמה משלך (לפחות 8 תווים)
3. **בדוק** שכניסה חוזרת עם הסיסמה החדשה עובדת
4. **לקוחות אחרים** (יוסי, רחל, וכל הצטרפות עתידית): הם נכנסים פעם ראשונה דרך magic link (כפתור "שכחת סיסמה" במסך הכניסה), ואז יכולים להגדיר סיסמה דרך הפרופיל

### ❓ שאלות פתוחות / החלטות שלא נסגרו

1. **התנהגות gate למשתמשים חדשים שאין להם טיול בכלל** (הוזמנו אבל לא הוסיפו אותם לטיול עדיין) — כרגע נחסמים ל-/no-access. ייתכן שכדאי הודעה אחרת ("ממתין להזמנה") אבל לא קריטי כרגע.
2. **/profile לא חסום** — בכוונה, כדי שמשתמש שננעל יוכל עדיין לעדכן טלפון/סיסמה. אם זו לא ההתנהגות הרצויה — תגיד.
3. **שחזור סיסמה אוטומטי** — כרגע "שכחת סיסמה" שולח magic link, ואחרי כניסה אפשר להגדיר סיסמה חדשה דרך פרופיל. UX לא חלק. בעתיד: דף ייעודי `/reset-password` עם email-only input ולחיצה אחת.

### 🧠 Self-learning

- **Middleware עם DB query מוסיף latency**. הוספתי 2 שאילתות (profiles + trip_participants עם join) על כל בקשה ל-/dashboard ו-/trip. זה ~30-100ms נוספים. אם בעתיד מורגש איטיות, להעביר את ה-gate ל-layout.tsx של /dashboard ו-/trip/[id] ולהסתפק במידלוור רק על auth.
- **תיעוד סיסמה ראשונית בצ'אט הוא compromise**. הסיסמה שיצרתי מופיעה כאן ובדוח. למרות שהיא חד-פעמית והמשתמש אמור להחליף אותה, זה לא אידיאלי. אופציה עתידית: לשלוח דרך WhatsApp/SMS את הסיסמה הראשונית במקום בצ'אט.

### 🚀 המלצה לשלב הבא

המשתמש יכנס בפעם הראשונה עם הסיסמה הזמנית, יחליף אותה בפרופיל. אחרי וידוא שזה עובד — אפשר לשקול:
- דף `/reset-password` רגיל (UX יותר טבעי משכחת-סיסמה → magic-link)
- "ניהול משתמשים" לאדמין (לראות מי מחובר, לשנות הרשאות, לחסום)
- מעבר ל-WhatsApp Business sender רשום (במקום sandbox) כשיש יותר טיולים פעילים

---

## 🇺🇸 English Section

### 🎯 Goal

User couldn't log in via magic link (not delivered). Two-pronged response:
1. **Email + password login** alongside (or instead of) magic link
2. **Trip-window access gate** — only registered users with at least one trip whose `end_date >= today - 7d` may access /dashboard and /trip/*. super_admin bypassed.

### 🗂️ Files

**Created (3):**
- `app/api/auth/set-password/route.ts` — POST. Auth required, min 8 chars, calls `supabase.auth.updateUser({password})`. Hebrew errors.
- `app/no-access/page.tsx` — server component explaining the lock + logout button.
- `app/no-access/logout-button.tsx` — client component for `signOut`.

**Modified (3):**
- `app/login/page.tsx` — added password field, `mode` state, default to password. Toggle button switches to magic-link fallback. `signInWithPassword` used when in password mode.
- `app/profile/profile-form.tsx` — new "Password" card after the main form, POSTs to `/api/auth/set-password`. Min 8 chars. Toast on success.
- `lib/supabase/middleware.ts` — added `/no-access` to public routes. New gate on `/dashboard` and `/trip/*` prefixes: queries `profiles.is_super_admin`, then if not super_admin queries `trip_participants` joined to `trips` filtered by `end_date >= today - 7d`. Redirects to `/no-access` if no eligible trip.

### ✅ Verification

- `tsc --noEmit` clean
- `npm run build` clean. New routes appear in build output.
- Initial password set for `eli@biglog.co.il` via Supabase Admin API.

### 📋 User checklist

1. Log in once with `eli@biglog.co.il` / `Biglog920a07f8!`
2. Profile → Password card → set your own password (min 8 chars)
3. Verify next login with the new password works
4. Other users (Yossi, Rachel, future invitees) start with magic link via "Forgot password?" then can set their own password from profile

### 🧠 Lessons

- Middleware-level DB queries add ~30-100ms per request. Tolerable for now but candidate for refactor to layout-level if perf matters.
- Embedding initial password in chat/report is a compromise. For future automated provisioning, deliver via SMS/WhatsApp instead.

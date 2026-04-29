# Stage 23 — Security hardening + autonomous security agent

**גרסה:** v10.10.0
**תאריך:** 2026-04-29
**שעה:** 18:00
**סוכן:** coordinator (Claude)
**סטטוס:** ✅ פרוס · 🤖 רץ אוטומטית כל שעה
**מיגרציות:** 024, 025, 026
**טוקנים:** ~40K

---

## 🇮🇱 חטיבה בעברית

### 🎯 רקע

בבוקר 27/04 הגיע מייל מ-Supabase: *"5 בעיות אבטחה קריטיות בפרויקט TripMaster"* — RLS לא מופעל על 5 טבלאות בסכמה ציבורית. המשתמש ביקש (1) לטפל בדחיפות, ו-(2) לבנות סוכן שיקרא את כל המיילים מ-AI / פרויקטים, יזהה התראות אבטחה, ויטפל אוטומטית.

### 🛠️ מה בוצע

**Phase 1 — Hardening ידני (v10.9, מיגרציה 024):**
- הופעל RLS על `flight_status_log`, `meal_attendance`, `meal_recipes`, `trip_recommendations`, `trip_todos`
- מדיניות לכל אחת לפי הקונטקסט: trip member, creator-only, service-role-only
- נשלל EXECUTE על `is_email_registered` מ-anon/authenticated
- מקובע `search_path` על `lowercase_invitation_email` ו-`handle_new_user`
- אומת: `get_advisors` מחזיר **0 ERROR** (היו 5)

**Phase 2 — סוכן אוטומטי (v10.10, מיגרציות 025+026):**
- טבלת `security_agent_log` (audit trail מלא, service-role בלבד)
- 3 RPCs ייעודיים, כולם SECURITY DEFINER + service_role בלבד:
  - `agent_check_rls_disabled()` — מחזיר טבלאות בסכמה ציבורית בלי RLS
  - `agent_check_function_search_path()` — מחזיר פונקציות SECURITY DEFINER עם search_path משתנה
  - `agent_apply_fix(sql)` — מבצע ALTER עם **רשימה לבנה קשיחה** של תבניות בלבד (אי אפשר להריץ DML שרירותי)
- Endpoint `/api/cron/security-agent` (כל שעה ב-Vercel cron):
  1. קורא לשני ה-RPCs לאיתור ממצאים
  2. עבור תבניות מוכרות-בטוחות (טבלת service-role בלי RLS, search_path משתנה) → תיקון אוטומטי דרך `agent_apply_fix`
  3. עבור ממצאים לא-מוכרים ברמת `critical` → התראה ב-WhatsApp (Twilio) + מייל (Gmail SMTP) ל-`+972524848358`
  4. כל פעולה נכתבת ל-`security_agent_log` עם `source / severity / project / finding / action_taken / fix_summary / alerted_via`

### 🗂️ קבצים

**נוצרו (5):**
1. `supabase/migrations/024_security_hardening_rls.sql` — תיקון ידני ראשוני
2. `supabase/migrations/025_security_agent_log.sql` — טבלת audit
3. `supabase/migrations/026_security_agent_rpcs.sql` — 3 RPCs לסוכן
4. `app/api/cron/security-agent/route.ts` — לוגיקת הסוכן
5. `.claude/reports/stage-23_v1.0_2026-04-29_18-00.md` — דוח זה

**שונו (1):**
1. `vercel.json` — נוסף cron ב-`0 * * * *` (כל שעה)

**Vercel env (1):**
- `SECURITY_ALERT_PHONE = 972524848358` (production)

### ✅ אימות

- `tsc --noEmit` עובר נקי
- `npm run build` עובר נקי. `/api/cron/security-agent` מופיע ב-output
- בדיקת SQL ידנית: `agent_check_rls_disabled()` ו-`agent_check_function_search_path()` שניהם מחזירים 0 שורות → המערכת נקייה כרגע, הסוכן יזהה כל בעיה חדשה תוך שעה
- `get_advisors` ב-Supabase: 0 ERROR (היו 5 הבוקר)

### 📋 מה שעוד נשאר (Phase 3 — Gmail IMAP)

הסכימה של `security_agent_log` כבר תומכת ב-`source='gmail'` + `message_id`. כדי לחבר קריאת מיילים בפועל:

1. להוסיף תלות `imapflow` או `node-imap` ל-package.json
2. בתוך `/api/cron/security-agent/route.ts`, לפני קריאות ה-RPC, להריץ:
   - חיבור IMAP ל-`imap.gmail.com:993` עם `GMAIL_USER` + `GMAIL_APP_PASSWORD` (כבר קיימים)
   - חיפוש מיילים שלא נקראו מ-24 שעות אחרונות, מסננים: `from:supabase.com OR from:vercel.com OR from:noreply@github.com OR from:dependabot OR from:notifications@anthropic.com`
   - שליחה ל-Claude API לסיווג (`critical/warning/info`)
   - לטפל / להתריע באותו flow כמו ה-RPCs

לא בנוי כרגע כי זה דורש (א) הוספת תלות חדשה, (ב) טסט מקיף של חיבור IMAP מ-Vercel serverless. הסוכן הבסיסי כבר נותן ערך — מטפל אוטומטית בכל בעיית RLS עתידית, וזה היה הטריגר המקורי.

### 🧠 Self-learning

- **Whitelist > flexibility ב-SECURITY DEFINER.** התפתיתי לכתוב `agent_apply_fix(sql)` שמריץ כל מה שמקבל. במקום זה הוספתי בדיקת תבנית קשיחה שדוחה כל מה שלא מתאים בדיוק לאחת משתי תבניות מוכרות. זה מונע מצב שבאג/inject קטן בקוד הסוכן יתפוצץ למחיקת DB.
- **התראות בכל הערוצים — אבל רק על critical שלא תוקן.** אם הסוכן מתקן הכל בעצמו, אני לא רוצה לשלוח push notifications כל שעה. רק כשהוא לא יכול → התראה.

### 🚀 השלב הבא המומלץ

Phase 3 — Gmail IMAP integration. אם המשתמש רוצה, להוסיף את הלוגיקה הזו לאותו cron (לא דורש cron נפרד). ~2-3 שעות עבודה כולל בדיקות.

---

## 🇺🇸 English Section

### 🎯 Context

A Supabase advisor email (27 Apr 2026) flagged 5 critical RLS issues. User asked for: (1) urgent fix, (2) an autonomous agent that reads project-related security emails and acts on them.

### 🛠️ Done

**Phase 1 — manual hardening (v10.9, migration 024):**
- Enabled RLS on flight_status_log, meal_attendance, meal_recipes, trip_recommendations, trip_todos with appropriate policies.
- Revoked is_email_registered from anon/authenticated.
- Pinned search_path on lowercase_invitation_email + handle_new_user.
- Verified: get_advisors returns 0 ERROR (was 5).

**Phase 2 — autonomous agent (v10.10, migrations 025+026):**
- New table security_agent_log (full audit trail, service-role only).
- Three SECURITY DEFINER RPCs locked to service_role:
  - agent_check_rls_disabled() — public-schema tables without RLS.
  - agent_check_function_search_path() — SECURITY DEFINER funcs with mutable search_path.
  - agent_apply_fix(sql) — runs ALTER statements but only if they match one of two whitelisted shapes. Non-matching SQL raises an exception.
- New endpoint /api/cron/security-agent (vercel cron 0 * * * *):
  1. Calls both check RPCs.
  2. For known-safe patterns, auto-applies fixes via agent_apply_fix.
  3. For unknown criticals, alerts via WhatsApp (Twilio) + email (Gmail SMTP).
  4. Logs everything to security_agent_log.

### ✅ Verification

- tsc clean, build clean, route appears in output.
- Both check RPCs return 0 rows currently (DB is clean post-v10.9).
- get_advisors returns 0 ERROR.

### 📋 Remaining (Phase 3)

Gmail IMAP scanning of @supabase / @vercel / @anthropic / @github / dependabot emails. Schema already supports it (source='gmail', message_id). Requires adding an IMAP library and a Claude API call for classification. Estimated ~2–3h.

### 🧠 Lessons

- For agent-applied SQL, prefer a strict whitelist of statement shapes over a generic exec helper. Limits blast radius if the agent misfires.
- Only alert on critical unfixed findings. Auto-fixed findings just log silently.

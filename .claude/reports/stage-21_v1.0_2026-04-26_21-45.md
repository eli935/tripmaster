# Stage 21 — Daily WhatsApp Diagnostics + Trip Status Auto-Transition

**גרסה:** v10.6.0
**תאריך:** 2026-04-26
**שעה:** 21:45
**סוכן:** coordinator (Claude)
**סטטוס:** ✅ קוד מוכן · 🔧 דורש env vars ב-Vercel
**מיגרציות:** אין
**טוקנים:** ~30K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב

שני באגים שדווחו על ידי המשתמש:

1. **לקוחות לא מקבלים את ה-WhatsApp היומי** — הקרון רץ ב-Vercel אבל הודעות לא מגיעות.
2. **סטטוס טיול לא מתעדכן אוטומטית** — טיול שמתחיל היום עדיין מסומן `planning`, וטיול שהסתיים עדיין לא עובר ל-`completed`.

### 🔍 אבחון

#### Issue 1 — WhatsApp

נבדקו ה-env vars ב-Vercel דרך `vercel env ls production`. נמצא:
- ✅ `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` — מוגדרים
- ❌ `WHATSAPP_PROVIDER` — חסר (ברירת מחדל בקוד: `baileys`)
- ❌ `WHATSAPP_BOT_URL` — חסר (ברירת מחדל בקוד: `http://localhost:3001`)
- ❌ `TWILIO_*` — חסרים

נבדק `whatsapp_log` ב-Supabase: יש שורה אחת מ-26/04 בשעה 08:46 שעון ישראל לטיול "רוזנפלד-מיכאלי במונטנגרו" עם `recipients: 0`. הקרון רץ, בנה הודעה תקינה, מצא 3 משתתפים עם טלפונים — אבל כל ה-fetch-ים ל-localhost:3001 נכשלו (Vercel לא יכול להגיע ל-localhost של מחשב המשתמש). השליחה נכשלה בשקט וה-cron אפילו רשם רשומה ב-`whatsapp_log` שחסמה ניסיון חוזר.

#### Issue 2 — Trip status

חיפוש בכל ה-codebase על קוד שמעדכן `trips.status` בהתאם לתאריכים — **אין כזה**. הסטטוס משתנה רק ידנית דרך [app/trip/[id]/trip-settings.tsx:189](../../app/trip/[id]/trip-settings.tsx). הוכחה ב-DB: טיול "רוזנפלד-מיכאלי במונטנגרו" עם `start_date=2026-04-26 end_date=2026-04-30` עדיין `status='planning'` ב-26/04.

### 🗂️ קבצים שנוצרו (1) / שונו (5)

**נוצרו:**
1. `app/api/cron/update-trip-status/route.ts` — קרון יומי חדש שעושה:
   - `planning → active` כש-`start_date ≤ today ≤ end_date`
   - `active → completed` כש-`end_date < today`
   - `planning → completed` כ-back-fill לטיולים ישנים שעוקפו (לא היה קרון בעבר) או טיולים קצרצרים שהתחילו והסתיימו בין שתי הרצות קרון
   - מצבים `completed` ו-`review` נשארים — מנהל הזיז אותם בכוונה
   - אימות `Bearer CRON_SECRET`, מחזיר רשימת טיולים שעברו מצב

**שונו:**
1. `lib/whatsapp.ts` — ה-API השתנה מ-`Promise<boolean>` → `Promise<SendResult>` ומ-`Promise<number>` → `Promise<BulkResult>`. שינויים:
   - `BulkResult` כולל `sent`, `failed`, ו-`reasons: Record<string, number>` (תיוג סיבות)
   - בדיקת preflight ב-Baileys: אם `WHATSAPP_BOT_URL` לא מוגדר, או מצביע ל-`localhost`/`127.0.0.1`, מחזיר ישר reason ברור בלי fetch
   - בדיקת preflight ב-Twilio: אם חסרים credentials, מחזיר reason ברור
   - timeout של 10 שניות + AbortController על fetch
   - לוגים מציינים provider + מספר יעד
2. `app/api/cron/daily-whatsapp/route.ts`:
   - בלוק `config` בתחילת הקרון שמראה אם provider/bot_url/twilio מוגדרים — מוחזר ב-response
   - כל `skipped++` הוחלף ב-`bumpSkip("reason")` עם 6 קטגוריות: `too_early_for_morning`, `too_early_for_evening`, `no_trip_days_seeded`, `no_trip_day_for_today`, `already_sent_today`, `no_participants_with_phone`
   - **שינוי קריטי:** רישום ל-`whatsapp_log` קורה **רק** אם `result.sent > 0`. בעבר נרשמה רשומה גם כשנכשל הכל, מה שחסם ניסיונות חוזרים בקרון הבא
   - response כולל `messages_failed`, `skip_reasons`, `send_failure_reasons` — אין יותר "כשל בשקט"
3. `app/api/whatsapp/notify/route.ts` + `app/api/whatsapp/send/route.ts` — התאמת ה-callers ל-API החדש; ה-response חושף `failed`+`reasons`
4. `vercel.json` — נוסף cron `/api/cron/update-trip-status` ב-01:00 UTC (04:00 שעון ישראל) — לפני קרון ה-WhatsApp של הבוקר
5. `.env.example` — סוף סוף מתועד `WHATSAPP_PROVIDER`, `WHATSAPP_BOT_URL`, `TWILIO_*` עם הערה ש-localhost לא יעבוד מ-Vercel

### ✅ בדיקות שבוצעו

- `npx tsc --noEmit` — עובר נקי
- `npm run build` — עובר נקי. הראוט החדש `/api/cron/update-trip-status` מופיע ב-output
- בדיקת DB ב-Supabase: 3 טיולים ב-DB. הקרון החדש אמור לעדכן 1 טיול (`רוזנפלד-מיכאלי במונטנגרו`) מ-`planning` ל-`active` בהרצה ראשונה

### 📋 Checklist ידני למשתמש

לפני שזה ירוץ נכון בפרודקשן:

1. **הגדר את ה-env vars ב-Vercel** (Settings → Environment Variables):
   - `WHATSAPP_PROVIDER=baileys` (או `twilio`)
   - `WHATSAPP_BOT_URL=https://...` — **חייב להיות URL ציבורי**, לא localhost
2. **חשוף את הבוט של biglog-ops** — או דרך ngrok (חינמי, `ngrok http 3001`), Cloudflare Tunnel, או הריץ אותו על שרת ציבורי
3. **בדוק את הקרון החדש ידנית** אחרי deploy:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://tripmaster-seven.vercel.app/api/cron/update-trip-status
   ```
   צריך להחזיר את הטיול שעבר ל-`active`
4. **בדוק שוב את daily-whatsapp** עם ה-config החדש — ה-response יראה אם יש בעיה (provider/bot_url) או אם הכל בסדר
5. **מחק את הרשומה הריקה** מ-`whatsapp_log` כדי ש-cron הבא יוכל לנסות שוב:
   ```sql
   DELETE FROM whatsapp_log WHERE recipients = 0;
   ```

### ❓ שאלות פתוחות

- **Baileys מול Twilio** — Baileys חינמי אבל דורש בוט פתוח לרשת (סיכון אבטחה אם לא מוגן). Twilio ~$0.005 להודעה אבל יציב. צריך החלטה לפני production.
- **התראת admin על כשל** — האם להוסיף שליחת מייל ל-admin אם cron מחזיר `messages_failed > 0`? כרגע צריך לבדוק ידנית את ה-response.

### 🧠 Self-learning

מה למדתי מהבאג:
- **כשל בשקט הוא הגרוע ביותר.** הקוד לפני זה החזיר `false` מ-`sendWhatsAppMessage` ובלע את הסיבה. הלוג בקונסול אבד אחרי 24 שעות (ב-Vercel default). השילוב של "אין מידע ב-response" + "אין מידע ב-logs" + "כן רושמים ב-DB גם בכשל" יצר באג בלתי-נראה.
- **רישום נכשל = רישום מטעה.** לרשום ל-`whatsapp_log` עם `recipients=0` חסם את הניסיון החוזר. הקוד החדש רושם רק על הצלחה.
- **תקן env vars תיעוד.** אם `.env.example` לא מתעד את כל ה-vars הנדרשים, ה-deploy יוצא חצי-מוגדר וזה מתפוצץ אחרי חודש. נוספו עכשיו עם הערות.

### 🚀 המלצה לשלב הבא

לפני שמסיימים, להריץ את ה-cron החדש ידנית פעם אחת אחרי deploy ולוודא שהטיול הפעיל באמת עבר ל-`active`. אם המשתמש רוצה — להוסיף Slack/email notification למקרה ש-`daily-whatsapp` מחזיר `messages_failed > 0`.

---

## 🇺🇸 English Section

### 🎯 Goal

Two production bugs:

1. **Daily WhatsApp not delivered to clients** — cron fires on Vercel but recipients see nothing.
2. **Trip status doesn't auto-transition** — trips that started today still show `planning`; finished trips don't move to `completed`.

### 🔍 Diagnosis

**Issue 1 (WhatsApp):** Verified via `vercel env ls production`:
- `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` ✅ set
- `WHATSAPP_PROVIDER`, `WHATSAPP_BOT_URL`, `TWILIO_*` ❌ all missing

`whatsapp_log` table has 1 row from this morning with `recipients: 0` — the cron ran, built a valid message, found 3 phones, but every send hit the default `http://localhost:3001` which is unreachable from Vercel serverless. The failures returned `false` silently, and the log entry blocked any retry.

**Issue 2 (Trip status):** No code anywhere transitions `trips.status` based on dates. Status only changes via the manual dropdown in `trip-settings.tsx:189`. DB confirms: trip starting today is still `planning`.

### 🗂️ Files

**Created (1):**
- `app/api/cron/update-trip-status/route.ts` — daily cron that promotes `planning → active` when today is in range, `active → completed` after end_date, and `planning → completed` as a back-fill for short trips and legacy data. Terminal states (`completed`, `review`) are never touched.

**Modified (5):**
- `lib/whatsapp.ts` — return type changed from `boolean`/`number` to structured `SendResult`/`BulkResult` with `reasons` map. Preflight checks reject localhost URLs and missing Twilio creds with clear reason strings before fetch. Added 10s timeout via AbortController.
- `app/api/cron/daily-whatsapp/route.ts` — added `config` block to response (shows what's actually set on Vercel). Replaced bare `skipped++` with 6 categorized skip reasons. **Critical fix:** `whatsapp_log` insert now only happens when `result.sent > 0` — previously zero-recipient rows blocked retries.
- `app/api/whatsapp/{notify,send}/route.ts` — adapted to new bulk result shape; responses now expose `failed` and `reasons`.
- `vercel.json` — registered new cron at `0 1 * * *` (04:00 IL, before the morning WhatsApp at 08:30 IL so status flips first).
- `.env.example` — documented `WHATSAPP_PROVIDER`, `WHATSAPP_BOT_URL` (with explicit warning that localhost won't work from Vercel), `TWILIO_*`.

### ✅ Verification

- `tsc --noEmit` clean
- `npm run build` clean — new route appears in output
- DB inspection confirms exactly one trip will transition to `active` on first run

### 📋 User checklist

1. Set on Vercel: `WHATSAPP_PROVIDER` + `WHATSAPP_BOT_URL` (public URL, not localhost)
2. Expose biglog-ops bot via ngrok / Cloudflare Tunnel / public host
3. After deploy, manually call `/api/cron/update-trip-status` with `Bearer CRON_SECRET` and confirm the active trip flipped
4. Re-run `/api/cron/daily-whatsapp?kind=morning` — response now reveals exactly what's wrong if anything still fails
5. Run `DELETE FROM whatsapp_log WHERE recipients = 0` so the next cron run can retry today's blocked send

### 🧠 Lessons

- Silent failure + DB row that blocks retry + ephemeral logs = invisible bug for days. Always: surface failure reasons in API response, never log a "success" row when nothing succeeded, and document every env var in `.env.example`.
- Provider abstractions need preflight validation. The Baileys path was technically correct code that fell through to a default that can't possibly work in production.

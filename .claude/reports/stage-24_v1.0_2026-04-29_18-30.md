# Stage 24 — Security agent Phase 3: Gmail IMAP + revert

**גרסה:** v10.11.0
**תאריך:** 2026-04-29
**שעה:** 18:30
**סוכן:** coordinator (Claude)
**סטטוס:** ✅ פרוס · רץ עם הקרון השעתי
**מיגרציות:** 027
**טוקנים:** ~25K

---

## 🇮🇱 חטיבה בעברית

### 🎯 הוספות

1. **סריקת Gmail דרך IMAP** — הסוכן עכשיו קורא מיילים בתחומים נבחרים (Supabase, Vercel, Anthropic, GitHub, OpenAI, Google) עם מילות מפתח אבטחתיות, מסווג דרך Claude, ושולח התראות על קריטיים.
2. **Backup-before-change** — לפי בקשתך, כל תיקון אוטומטי כולל עכשיו `revert_sql` שמורכן מראש. הסוכן מסרב להפעיל כל תיקון בלי revert. יש endpoint לבטל כל פעולה חזרה.

### 🗂️ קבצים

**נוצרו (4):**
1. `lib/security-agent/gmail-scan.ts` — IMAP poller, מסנן לפי domain + subject keywords, מחזיר preview של 1500 תווים מכל מייל מתאים
2. `lib/security-agent/classify.ts` — קורא ל-Claude API, מקבל JSON עם severity/project/summary/recommended_action בעברית
3. `app/api/admin/security-agent-revert/route.ts` — endpoint להחזרת תיקון אחורה (super_admin בלבד, רושם actor uuid)
4. `supabase/migrations/027_security_agent_revert.sql` — עמודות חדשות + RPC חדש

**שונו (3):**
1. `app/api/cron/security-agent/route.ts` — חיבור Gmail scan, חישוב revert_sql לכל ממצא, סירוב לתקן בלי revert
2. `package.json` — הוספת `imapflow ^1.3.3`
3. `package-lock.json` — תלויות חדשות

### 🔒 שכבת ה-revert

| שלב | מה קורה |
|---|---|
| גילוי | `agent_check_*` מאתר ממצא |
| הכנה | הסוכן בונה `fixSql` **ו-`revertSql`** מותאמים. אם אין revert → הממצא לא יתוקן אוטומטי |
| יישום | `agent_apply_fix(fixSql)` — הוקשח, מקבל גם תבניות `DISABLE RLS` ו-`RESET search_path` כדי שאותו gate יחול על revert |
| תיעוד | לוג נכתב עם `fix_summary` + `revert_sql`. תוכל בכל רגע לראות מה השתנה ואיך לבטל |
| ביטול | `POST /api/admin/security-agent-revert` עם `{log_id}` (super_admin בלבד). קוראים ל-`agent_revert_fix(log_id, actor)` שמריץ את ה-revert דרך אותו gate ומסמן `reverted_at` |

### 🌐 Gmail flow

| שלב | מה קורה |
|---|---|
| חיבור | IMAP TLS ל-`imap.gmail.com:993` עם `GMAIL_USER` + `GMAIL_APP_PASSWORD` (כבר קיימים) |
| סינון שרת | `SEARCH SINCE <24h ago>` — צמצום הסריקה לחלון של 24 שעות |
| סינון לקוח | רק מי-`@supabase.com / @vercel.com / @anthropic.com / @github.com / @openai.com / @google.com` + מילות מפתח אבטחתיות בנושא |
| dedup | בדיקה ל-`security_agent_log.message_id` — לא לסווג שוב אותו מייל |
| סיווג | Claude (Sonnet 4.5) — מחזיר JSON עם severity/project/summary בעברית/recommended_action |
| פעולה | `critical` → WhatsApp + מייל. `warning/info` → לוג בלבד. `irrelevant` → לוג בלבד עם `severity=info` |
| **לא מבוצע** | תיקון אוטומטי **לא** מבוצע על בסיס תוכן מייל — מיילים נחשבים כ-untrusted data לפי כללי בטיחות. רק התראה למשתמש |

### ✅ אימות

- `tsc --noEmit` נקי
- `npm run build` נקי. שני נתיבים חדשים מופיעים: `/api/admin/security-agent-revert` + `/api/cron/security-agent` (מעודכן)
- מיגרציה 027 הוחלה ב-DB
- הקרון השעתי הקיים (`0 * * * *`) ימשוך את ה-Gmail scan ב-rotation הבא

### 📋 Checklist ידני

1. בעוד שעה (00 דקות UTC הבאות) — הסוכן ירוץ. אם יש בתיבה שלך מייל אבטחה לא-נקרא מ-24 שעות אחרונות, תקבל WhatsApp/מייל. **אם קיבלת — זה עובד.** אם לא — זה אומר שאין מייל קריטי לטפל בו (טוב).
2. לבדוק revert ידנית (אופציונלי) — מצא רשומה ב-`security_agent_log` עם `action_taken='auto_fixed'` (אם תהיה כזו בעתיד), והרץ:
   ```bash
   curl -X POST -H "Cookie: <auth>" -d '{"log_id":"<uuid>"}' \
     https://tripmaster-seven.vercel.app/api/admin/security-agent-revert
   ```
3. **לבדוק שאין רגרסיות** ב-Gmail — אם הסוכן יסווג מיילים לא קשורים כ-critical, הוא יציף אותך. אם זה קורה — תגיד ואכוון את הפרומפט להיות שמרן יותר.

### 🧠 Self-learning

- **מיילים = untrusted source.** בנגוד ל-DB checks (אמינים, deterministic), מיילים יכולים להכיל תוכן מטעה או אפילו prompt injection. הסוכן רק מסווג ומדווח, לא מתקן. עיגון זה גם בכללי הבטיחות שלי.
- **revert_sql הוא חלק מה-fix, לא תוסף.** ברגע שהוספתי `if (!revertSql) skip` — כל תיקון בעתיד **חייב** לחשוב על איך לבטל את עצמו. זה מכריח אותי כשמוסיפים תבנית fix חדשה לחשוב על rollback באותו רגע, לא בדיעבד.
- **whitelist גם ל-revert.** במקום ליצור gate נפרד ל-revert, הרחבתי את ה-whitelist הקיים. אותו קוד שמגן על forward מגן גם על rollback — פחות שטח תקיפה.

---

## 🇺🇸 English Section

### 🎯 What's new

1. **Gmail IMAP scan** of trusted security senders (Supabase, Vercel, Anthropic, GitHub, OpenAI, Google). Each new match is classified by Claude and triggers WhatsApp + email when severity='critical'.
2. **Backup-before-change** — every auto-fix now ships with a precomputed revert SQL. The agent refuses to apply any fix without one. New endpoint POST /api/admin/security-agent-revert lets a super_admin roll back any auto-fix.

### 🗂️ Files

Created: `lib/security-agent/gmail-scan.ts`, `lib/security-agent/classify.ts`, `app/api/admin/security-agent-revert/route.ts`, `supabase/migrations/027_security_agent_revert.sql`.

Modified: `app/api/cron/security-agent/route.ts` (Gmail wiring + revert capture + refuse-without-revert), `package.json` (+imapflow).

### 🔒 Revert architecture

Each finding now carries `revertSql` alongside `fixSql`. The route refuses to call `agent_apply_fix` unless both are present. The audit log row stores both. `agent_revert_fix(log_id)` reads the row, runs the stored revert through the same whitelist gate, stamps `reverted_at`. Refuses to revert twice.

### ⚠ Constraint: emails are untrusted

Auto-fix is **not** wired to email-derived findings. Email content can contain misleading info (or prompt injection). Email path: classify → notify → log. The fix path stays SQL-only.

### ✅ Verification

- tsc clean, build clean, both new routes appear in output.
- Migration 027 applied to live DB.
- The existing hourly cron will pick up Gmail scan on its next firing.

### 🧠 Lessons

- A revert SQL is not a nice-to-have. Making it required (`if (!revertSql) skip`) forces every future auto-fix pattern to be designed with its own rollback at the same time, not as an afterthought.
- Reusing the existing whitelist gate for both forward and backward SQL keeps the trusted surface area small. One gate = fewer ways to misuse.

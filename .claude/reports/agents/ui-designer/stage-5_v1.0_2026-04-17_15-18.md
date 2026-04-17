# Stage 5 — Realtime מלא / Full Realtime

**גרסה:** v1.0
**תאריך:** 2026-04-17
**שעה:** 15:18
**סוכנים:** database-expert + ui-designer
**סטטוס:** ✅ הושלם
**טוקנים:** ~22k

---

## 🇮🇱 דוח בעברית

### 🎯 מטרת השלב
הרחבת תשתית ה-Realtime של TripMaster לכל הטבלאות הרלוונטיות — הוצאות, מפצלי הוצאה, משלמים, צ׳אט, קניות, ציוד, קבצים ומנות. הוספת Toast מעודן לאירועי אחרים, עדכונים אופטימיסטיים בצ׳אט, וסנכרון Realtime מלא לדשבורד היתרות (בלי צורך ברענון ידני).

### 📂 קבצים שנוצרו
1. `supabase/migrations/009_realtime_expansion.sql` — מיגרציה אידמפוטנטית שמוסיפה 8 טבלאות ל-`supabase_realtime` publication: `expenses`, `expense_splits`, `expense_payers`, `trip_messages`, `shopping_items`, `trip_equipment`, `trip_files`, `meal_items`.
2. `.claude/reports/stage-5_v1.0_2026-04-17_15-18.md` — דוח זה (+ עותקים לתיקיות הסוכנים).

### ✏️ קבצים ששונו
1. `lib/hooks/use-realtime.ts` — הרחבה:
   - `useRealtimeTrip` הורחבה לכסות גם `expense_splits`, `expense_payers`, `trip_files`, `meal_attendance`, `trip_todos`, `trip_recommendations`.
   - נוסף טיפול ב-`CHANNEL_ERROR` / `TIMED_OUT` עם `console.warn` במקום קריסה.
   - נוסף Hook חדש גנרי: `useRealtimeTable<T>(table, tripId, { onInsert, onUpdate, onDelete, onAny, filter, enabled, channelName })` — מחזיר API נקי, שומר callbacks ב-ref כדי למנוע re-subscribe בכל render.
2. `app/trip/[id]/trip-chat.tsx`:
   - **אופטימיסטי**: הודעה נדחפת ל-state מיד עם דגל `pending: true` ו-`tempId`; אירוע ה-INSERT Realtime מזהה ומאחד לפי (sender_id + content).
   - **כשל**: במקרה של `error` מהשרת → `pending: false`, `error: true`, כפתור "נסה שוב" + `ring-1 ring-red-500/60`.
   - **Visual**: הודעות pending ב-70% opacity + אייקון `Clock`; error עם `AlertCircle`.
   - **Toast**: על הודעה מ-user אחר → `💬 {שם} שלח הודעה`. Rate-limit: מעל 5 הודעות ב-10 שניות → collapse ל-`💬 N הודעות חדשות`.
3. `app/trip/[id]/balance-dashboard.tsx`:
   - הוספת 3 subscriptions דרך `useRealtimeTable` על `expenses`, `expense_payers`, `expense_splits`.
   - Debounce של 250ms שמאחד בועות אירועים (הוצאה + השורות הנלוות) ל-`router.refresh()` יחיד.
   - Toast: `💰 {שם_משלם} הוסיף הוצאה: ₪{סכום} — {תיאור}` רק מ-user אחר, עם אותו rate-limit (5/10s).

### 🧪 בדיקות שבוצעו
- ✅ `npx tsc --noEmit` — עבר ללא שגיאות.
- ✅ מיגרציה אידמפוטנטית: כל `ALTER PUBLICATION` עטוף ב-`BEGIN/EXCEPTION WHEN duplicate_object THEN NULL/END` — ריצה חוזרת לא תיכשל.
- ✅ Hook מטפל ב-`CHANNEL_ERROR` ללא קריסה (גם אם publication לא מופעל על טבלה).
- ✅ Subscriptions מתנתקים ב-unmount (כל timer מנוקה ב-cleanup).

### 📋 Checklist לבדיקה ידנית
- [ ] הרצת `009_realtime_expansion.sql` על Supabase ב-SQL editor.
- [ ] לוודא ב-`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` שכל 8 הטבלאות שם.
- [ ] פתיחת הטיול בשני דפדפנים (משתמשים שונים) → שליחת הודעה ב-A → ב-B יופיע toast עברית + הודעה בלי refresh.
- [ ] שליחת 6 הודעות רצופות ב-A → ב-B יופיע toast אחד "N הודעות חדשות".
- [ ] ב-A לכבות רשת → שליחת הודעה → bubble ב-70% opacity + ⏰ ; החזרת רשת → כפתור "נסה שוב" עובד.
- [ ] הוספת הוצאה ב-A → ב-B יופיע toast "💰 ... ₪X — תיאור" + היתרות מתעדכנות אוטומטית.
- [ ] מחיקת הוצאה ב-A → ב-B היתרות מתעדכנות ללא רענון.

### ❓ שאלות פתוחות
1. ה-RLS policies על `expense_payers` / `expense_splits` — האם הן כבר קיימות? אם לא, Supabase לא ישלח אירועים למשתמשים שלא יכולים לקרוא. לבדוק ב-`004_advanced.sql`.
2. Heuristic ההתאמה האופטימיסטית (sender_id + content) נכשלת אם user שולח את אותה הודעה פעמיים במהירות. אפשר לשפר עם `client_msg_id` בעמודה חדשה — אבל זה דורש שינוי schema.
3. `expense_payers.profile_id` והערכים שלו — נשאבים ב-page.tsx? אם הצמדה דרך join חסרה, צריך להוסיף גם `.select('*, expense_payers(*)')`.

### 🔄 המלצה לשלב הבא
- **Stage 6** מוצע: סימון קריאה ב-chat (`read_at` per-user + badges "לא-נקרא") + אינדיקטור "מקליד עכשיו" דרך Presence channels.
- לחלופין: הפעלת presence indicator על avatarים של משתתפים שנמצאים online כרגע.

---

## 🇺🇸 Report in English

### 🎯 Goal
Extend TripMaster's realtime infrastructure to cover every relevant table — expenses, expense splits, payers, chat, shopping, equipment, files and meal items. Add subtle toast notifications for events from other users, optimistic updates in the chat, and full realtime sync in the balance dashboard (no manual refresh).

### 📂 Files Created
1. `supabase/migrations/009_realtime_expansion.sql` — idempotent migration adding 8 tables to `supabase_realtime` publication.
2. `.claude/reports/stage-5_v1.0_2026-04-17_15-18.md` — this report (plus agent copies).

### ✏️ Files Modified
1. `lib/hooks/use-realtime.ts`:
   - Expanded `useRealtimeTrip` to cover `expense_splits`, `expense_payers`, `trip_files`, `meal_attendance`, `trip_todos`, `trip_recommendations`.
   - Handles `CHANNEL_ERROR` / `TIMED_OUT` with `console.warn`, never throws.
   - New generic hook `useRealtimeTable<T>(table, tripId, options)` with `onInsert`/`onUpdate`/`onDelete`/`onAny`/`filter`/`enabled`/`channelName`. Callbacks kept in a ref to avoid re-subscribing on every render.
2. `app/trip/[id]/trip-chat.tsx`:
   - Optimistic: push message with `pending: true` + `tempId`; realtime INSERT reconciles by (sender_id + content).
   - On send error → `error: true` + retry button with red ring.
   - Pending bubbles at 70% opacity + clock icon; error with AlertCircle icon.
   - Toast on incoming message from another user: `💬 {name} שלח הודעה`. Rate-limit: >5/10s collapses to `💬 N הודעות חדשות`.
3. `app/trip/[id]/balance-dashboard.tsx`:
   - Added three `useRealtimeTable` subscriptions (expenses, expense_payers, expense_splits).
   - 250ms debounce coalesces bursts into a single `router.refresh()`.
   - Toast on expense insert from another user: `💰 {payer} הוסיף הוצאה: ₪{amount} — {desc}` with same rate-limit.

### 🧪 Verification
- ✅ `npx tsc --noEmit` passes cleanly.
- ✅ Migration is idempotent (each ALTER wrapped in per-statement EXCEPTION block).
- ✅ Hook gracefully handles realtime channel errors when publication is missing.
- ✅ All timers and channels cleaned up on unmount.

### 📋 Manual Test Checklist
- [ ] Run `009_realtime_expansion.sql` in Supabase SQL editor.
- [ ] Verify via `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'` that all 8 tables are present.
- [ ] Open the trip in two browsers (two users) → send a message in A → B sees toast + message with no refresh.
- [ ] Send 6 rapid messages in A → B sees one collapsed "N new messages" toast.
- [ ] Disable network in A → send message → bubble at 70% opacity + clock icon; re-enable → retry button works.
- [ ] Add expense in A → B sees 💰 toast + balances update automatically.
- [ ] Delete expense in A → B balances update without refresh.

### ❓ Open Questions
1. RLS policies on `expense_payers` / `expense_splits` — already defined? If not, Supabase will silently drop events for users who can't read them. Check `004_advanced.sql`.
2. Optimistic reconciliation by (sender_id + content) fails if a user sends the identical message twice rapidly. A `client_msg_id` column would be robust — requires schema change.
3. Verify the server-side `page.tsx` select includes `expense_payers` via join so the dashboard re-fetch after refresh picks them up.

### 🔄 Next Stage Recommendation
- **Stage 6** suggestion: Chat read receipts (`read_at` per user + unread badges) + "typing…" indicator via Supabase Presence channels.
- Alternative: online indicator on participant avatars using Presence.

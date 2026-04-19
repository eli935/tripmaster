# Stage 17 — Ship 1 + Ship 2 / Vibe & Feeling · Flight-aware · Daily WhatsApp

**גרסה:** v9.7.0 + v9.8.0 (batched)
**תאריך:** 2026-04-20
**שעה:** 00:30
**סוכן:** coordinator (Claude)
**סטטוס:** ✅ שני Ships הושלמו ונפרסו
**מיגרציות:** 016 (whatsapp_log)
**טוקנים:** ~150K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
המשתמש ביקש 4 פיצ'רים גדולים. פיצלתי ל-3 Ships: Ship 1 (Vibe+Flight-aware), Ship 2 (WhatsApp יומי), Ship 3 (Gemini — לא כאן).

### 🚢 Ship 1 (v9.7) — Vibe/Feeling + תכנון מודע-טיסות

**שינויים:**
- `TripVibe` type חדש: adventure/sport/solid/scenic/mixed
- `feeling` — free-text עד 500 תווים ("מה אתם רוצים להרגיש בטיול הזה?")
- Wizard עבר מ-5 ל-**6 שלבים** — נוסף שלב 3 "איך אתם רוצים שהטיול ירגיש?" עם radio cards (5 אפשרויות עם emoji + הסבר) + textarea
- API route מזהה את יום הנחיתה וההמראה לפי `trip.outbound_flight_datetime`/`return_flight_datetime`
- משדר ל-Claude flags: `arrival_day=true arrival_time=HH:MM` / `departure_day=true departure_time=HH:MM`
- System prompt: יום נחיתה מתחיל **לא לפני שעת הנחיתה + 90 דק׳**; יום חזרה מסתיים **3 שעות לפני ההמראה**
- Vibe ו-feeling עוברים ל-Claude ומשפיעים על סוג ההצעות

**PreferencesSummary chips** על `/plan` כולל עכשיו גם "וייב: הרפתקני" (4 אפשרויות עברית).

### 🚢 Ship 2 (v9.8) — WhatsApp יומי

**ארכיטקטורה:**
- מיגרציה 016: טבלת `whatsapp_log` עם `(trip_id, trip_day_id, kind)` — מונעת כפילויות
- `/api/cron/daily-whatsapp?kind=morning|evening` — endpoint יחיד עם 2 מצבים
- 2 cron entries ב-`vercel.json`:
  - Morning: `30 5 * * *` (08:30 Israel summer) — לפני רוב ה-`daily_start`
  - Evening: `0 19 * * *` (22:00 Israel summer) — אחרי רוב ה-`daily_end`

**לוגיקה:**
- שולף את כל הטיולים שה-`today` בין `start_date` ל-`end_date`
- לכל טיול: מוצא את `trip_day` של היום
- בודק `whatsapp_log` — אם כבר נשלח אותו kind ל-day הזה → skip
- **Morning message:** בונה merge כרונולוגי של bookings + meals, כולל Google Maps multi-stop link (`https://www.google.com/maps/dir/<hotel>/<stop1>/<stop2>/...`) — משתמש ב-`accommodation_lat/lng` כ-origin ובכל ה-pins שיש להם lat/lng
- **Evening message:** "לילה טוב" + preview של 3 הפריטים הראשונים של מחר (אם יש)
- שליחה ל-`phone` של כל משתתף בטיול דרך `sendWhatsAppBulk` (ה-Baileys/Twilio transport הקיים)
- לוג ב-`whatsapp_log` עם `recipients` ו-`payload_preview`

**אבטחה:** `Authorization: Bearer $CRON_SECRET` — Vercel cron שולח את זה אוטומטית, טריגר ידני דורש אותו.

**פורמט הודעת בוקר (דוגמה):**
```
☀️ בוקר טוב מ-TripMaster!
שם הטיול · יום רביעי, 22 באפריל

🕐 08:00  🍽️ ארוחת בוקר — מלון
🕐 09:30  📍 העיר העתיקה של קוטור
🕐 13:00  🍽️ ארוחת צהריים — שלום
🕐 15:00  📍 לובצ'ן National Park

🗺️ מפת היום: https://www.google.com/maps/dir/42.28,18.84/42.42,18.77/.../...

יום מקסים! 🌻
```

**פורמט הודעת ערב:**
```
🌙 לילה טוב מ-TripMaster!
שם הטיול

מקווים שהיה יום מושלם. הגיע הזמן לנוח ולהכין אנרגיה ליום הבא.

☀️ מחר מחכה לכם:
• פרסט
• סבטי סטפן
• ...ועוד 2

נפגש מחר בבוקר ✨
```

### 🗂️ קבצים
**נוצרו:**
- `supabase/migrations/016_whatsapp_log.sql`
- `app/api/cron/daily-whatsapp/route.ts` (~230 שורות)

**שונו:**
- `lib/supabase/types.ts` — TripVibe + feeling
- `components/plan/plan-wizard.tsx` — שלב 3 חדש, 6 שלבים סה"כ
- `app/api/trip/[id]/plan/generate/route.ts` — System prompt חדש, flight-day flags
- `app/trip/[id]/plan/plan-client.tsx` — VIBE_LABEL ב-chips
- `vercel.json` — 2 cron entries חדשים (4 סה"כ)

### 🧪 בדיקות
- [x] Migration 016 הורצה ב-Supabase
- [x] `tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed, endpoint `/api/cron/daily-whatsapp` נרשם
- [ ] End-to-end WhatsApp send — **תלוי בקונפיגורציית WHATSAPP_PROVIDER ב-Vercel env**
- [ ] בדיקת wizard חדש על טיול עם טיסה — **המשתמש**

### ⚠️ הערות הפעלה

**WhatsApp provider:**
`lib/whatsapp.ts` תומך ב-2 backends:
- `WHATSAPP_PROVIDER=baileys` (ברירת מחדל) + `WHATSAPP_BOT_URL=http://localhost:3001/api/send` — אם ה-bot של BigLog לא חשוף פומבית, הוא לא נגיש מ-Vercel production. יש לחשוף אותו (ngrok / Cloudflare Tunnel / VPS) או לעבור לספק ענן.
- `WHATSAPP_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM` — מחייב חשבון Twilio פעיל, עלות ~$0.005 להודעה.

**אם לא מוגדר:** הקריאות ל-Baileys יחזרו שגיאה (fetch fails to localhost) והודעות לא ישלחו, אבל ה-cron לא קורס — `sendWhatsAppBulk` סופר כמה נשלחו בהצלחה. ה-log נשמר עם `recipients: 0` — מאפשר לראות שלא עבד.

**מה Eli צריך להגדיר ב-Vercel:**
- `CRON_SECRET` (אם לא עדכן כבר — כנראה כן)
- `WHATSAPP_PROVIDER` + התלויות שלו

### ❓ שאלות פתוחות
1. איזה provider WhatsApp לחבר? (נדרש לפני שהפיצ'ר יעבוד בפרודקשן)
2. האם רוצה שנשלח **רק** למשתתפים עם `admin_participates=true`? (כרגע שולח לכולם עם phone)
3. הודעת ערב ביום האחרון של הטיול — כרגע אין "מחר" → אין preview. האם להוסיף הודעת "פרידה" ביום האחרון? (אפשר להוסיף ב-Phase 2.1)

### ➡️ המלצה לשלב הבא
**Stage 18:** Ship 3 — Gemini integration. זה דורש:
- GOOGLE_GEMINI_API_KEY (מפתח חינמי מ-Google AI Studio)
- החלטת ארכיטקטורה: Gemini כ-validator ל-Claude, או ensemble merge, או fall-back
- Prompt engineering כדי למנוע double-hallucinations

---

## 🇺🇸 English section

### 🎯 Stage goal
User asked for 4 large features; split into 3 Ships. This stage covers Ships 1 and 2.

### Ship 1 (v9.7) — Vibe/Feeling + flight-aware planning
- New TripVibe enum + feeling free-text
- Wizard: 6 steps now (added step 3 "how should the trip feel?")
- API route reads trip.outbound_flight_datetime / return_flight_datetime and tags first/last day with arrival_day / departure_day flags
- System prompt: arrival day starts no earlier than landing + 90 min; departure day ends 3h before takeoff

### Ship 2 (v9.8) — Daily WhatsApp broadcasts
- Migration 016: whatsapp_log for de-dup
- Single endpoint `/api/cron/daily-whatsapp?kind=morning|evening`
- 2 cron entries in vercel.json (08:30 and 22:00 Israel time)
- Morning: chronologically-merged itinerary + Google Maps multi-stop link
- Evening: goodnight + 3-item preview of tomorrow
- Auth: Bearer CRON_SECRET

### Open questions
1. WhatsApp provider (Baileys self-hosted vs Twilio cloud) — needs env config
2. Send only to admin_participates=true participants? (currently: anyone with phone)
3. Farewell message on last day? (no tomorrow-preview available)

### Next stage
Stage 18 = Gemini integration (Ship 3). Needs GOOGLE_GEMINI_API_KEY + architecture decision (validator / ensemble / fallback).

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- **Phase split** — במקום לנסות לבנות 4 פיצ'רים במכה, ביצעתי 2 עכשיו, השארתי 2 עם תלויות חיצוניות
- **Single endpoint with ?kind= param** במקום 2 endpoints נפרדים לmorning/evening — DRY, פחות פונקציות לתחזק
- **De-dup via whatsapp_log** — ברגע ההוספה. בלעדיה ה-cron היה שולח את אותה הודעה פעמיים אם ירוץ פעמיים באותו יום (edge case מציאותי)
- **Graceful degradation על WhatsApp provider** — אם לא מחובר, ה-cron לא קורס, רק לא שולח. מאפשר בדיקה של ה-endpoint גם לפני קונפיגורציה של WhatsApp

**מה לא עבד / טעויות:**
- Supabase type inference על `profile:profiles(phone)` join הוצא `profile` כ-array, הייתי צריך לתקן עם cast unknown → typed. Pattern לחזור עליו.
- לא הוספתי unit test למסר הבנייה — אין בדיקה אוטומטית ש-Google Maps URL תקין. Manual test נדרש.

**מה ללמוד:**
- **Cron + DB log pattern** — log table + unique key + skip-if-exists. זהב ל-cron idempotency.
- **Multi-provider abstraction** (lib/whatsapp.ts) קיימת מראש — אל תשכפל, תשתמש. חסך לי ~45 דק'.
- **פיצול Ship 1+2 בטוח יחד, Ship 3 נפרד** — כי Ship 3 דורש החלטות ארכיטקטורה ותקציב API נוסף.

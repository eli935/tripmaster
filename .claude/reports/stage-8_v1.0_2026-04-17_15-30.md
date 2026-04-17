# Stage 8 — Recommendations Agent + Scraping System

**גרסה:** v1.0
**תאריך:** 2026-04-17 15:30
**סוכן:** recommendations-expert (חדש)

---

## 🎯 מטרה

הקמת תשתית "מה חם עכשיו" ליעדי חו"ל ב-TripMaster:
- סוכן חדש `recommendations-expert` שסורק טרנדים מ-Reddit/TripAdvisor/בלוגים/קליוד
- Cron יומי שמרענן המלצות ליעדי טיולים פעילים (עד 5 יעדים לריצה)
- כרטיס UI בעמוד היעד שמציג Top-5 המלצות טריות בגלילה אופקית
- שלושה API endpoints (ingest, fetch, cron) עם auth `CRON_SECRET`
- שימוש חוזר ב-`@anthropic-ai/sdk` הקיים — ללא חבילות npm חדשות

---

## 📂 קבצים שנוצרו

| קובץ | מטרה |
|---|---|
| `.claude/agents/recommendations-expert.md` | הגדרת הסוכן (sonnet) + חובת דיווח |
| `app/api/recommendations/ingest/route.ts` | POST — קליטת items עם dedup לפי `(destination, source_url)` |
| `app/api/recommendations/for-destination/route.ts` | GET — החזרת עד 10 המלצות טריות (30 יום) ממוינות לפי popularity |
| `app/api/cron/refresh-recommendations/route.ts` | GET cron — מוצא יעדים פעילים, מפיק 5 המלצות דרך Claude Sonnet, ingest |
| `.claude/reports/agents/recommendations-expert/` | תיקיית דיווחים חדשה |

## ✏️ קבצים ששונו

| קובץ | שינוי |
|---|---|
| `vercel.json` | הוספת cron `/api/cron/refresh-recommendations` בשעה 03:00 יומי |
| `app/trip/[id]/destination-overview.tsx` | state חדש `recommendations`, useEffect fetch, קומפוננטה `WhatsHotCard`, טיפוס `Recommendation`, הוספת הכרטיס ל-UI (חו"ל בלבד) |

---

## 🧪 בדיקות

- `npx --package=typescript tsc --noEmit` → **עבר (EXIT=0)** ✅
- בדיקה ידנית של הנתיבים לא בוצעה — דורשת deploy + `CRON_SECRET` + `ANTHROPIC_API_KEY` ב-env
- המיגרציה `007_v9_foundation.sql` כבר הריצה את טבלת `trip_recommendations` (אומת במהלך העבודה)

---

## 📋 Checklist

- [x] Part A — agent file `.claude/agents/recommendations-expert.md` נוצר לפי פורמט `destinations-expert.md`
- [x] Part B — `/api/recommendations/ingest` עם bearer auth, dedup לפי `source_url`, validation, סיכום `{inserted, skipped}`
- [x] Part C — `/api/recommendations/for-destination` עם פילטר 30 יום + `expires_at > now()` + order popularity/collected
- [x] Part D — `/api/cron/refresh-recommendations` עם auth, סריקת יעדים פעילים (`status != 'completed'`), סף 7 יום, הגבלת 5 יעדים, קריאה ל-Claude Sonnet, POST ל-ingest
- [x] `vercel.json` — cron `0 3 * * *`
- [x] Part E — כרטיס `🔥 מה חם עכשיו` ב-destination-overview (חו"ל בלבד), גלילה אופקית, placeholder כשאין נתונים, truncation לציטוט, popularity badge (אדום/כתום/אפור), קישור למקור
- [x] אין חבילות npm חדשות — `@anthropic-ai/sdk` הקיים בלבד
- [x] Graceful fallback כש-`ANTHROPIC_API_KEY` חסר (cron מחזיר `generated: 0`)
- [x] `CRON_SECRET` bearer auth על ingest + cron (GET/POST בלי סוד = 401)
- [x] `tsc --noEmit` — עבר

---

## ❓ שאלות פתוחות

1. **איכות URLs מ-Claude:** המודל עלול להמציא source URLs. בחרנו לקבל אותם כ-source=`claude` (ברירת מחדל). שווה להוסיף validation מאוחר יותר שמבקר `HEAD` על ה-URL לפני insert.
2. **שפת quotes:** כרגע הפרומפט מבקש quotes באנגלית. ייתכן שיהיה עדיף עברית — תלוי בהעדפת המשתמש. קל לשנות בפרומפט.
3. **`trip.status`:** הקוד מסנן `status != 'completed'`. אם השדה לא קיים/לא מאוכלס בטבלת `trips`, שאילתה זו עלולה להחזיר 0 — או להפך, הכל. כדאי לאמת בהצגה ראשונה.
4. **Realtime:** המיגרציה 007 מוסיפה את הטבלה ל-`supabase_realtime`. לא חיברנו subscribe ב-UI (חדש נטען רק על mount). ייתכן שנרצה refresh חי.
5. **Rate limits:** קריאות Claude עלולות לחצות limits אם יש 5 יעדים פעילים × ריצה יומית. לא הוספנו backoff.

---

## 🔄 המלצה לשלב הבא

**Stage 9 מומלץ — Claude Agent SDK integration ב-cron:**
- במקום `messages.create()` פשוט, להעביר את הסוכן `recommendations-expert` ל-Claude Agent SDK עם tools WebSearch/WebFetch אמיתיים → תוצאות עם URLs אמיתיים ולא המצאות
- להוסיף subscribe ל-realtime של `trip_recommendations` ב-`destination-overview.tsx` → עדכון חי כשה-cron מסיים
- לבדוק end-to-end flow בסביבת preview של Vercel (לוודא ש-origin URL תקין ב-cron כשהוא קורא ל-ingest)
- להוסיף מדד "מה חם" לדשבורד המנהל (כמה המלצות נאספו ב-30 יום, פר יעד)

**סיכון מרכזי:** Cron יקרא ל-Claude 5 פעמים ביום × מודל Sonnet. אם יש 10+ יעדים פעילים, הוא "יצטבר" לאט — כל יעד יקבל רענון בערך כל יומיים. לשקול batching של כמה יעדים בקריאה אחת ל-Claude.

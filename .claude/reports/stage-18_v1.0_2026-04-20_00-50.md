# Stage 18 — Ship 3: Gemini Ensemble / Multi-Model Plan Generation

**גרסה:** v9.9.0
**תאריך:** 2026-04-20
**שעה:** 00:50
**סוכן:** coordinator (Claude)
**סטטוס:** ✅ קוד נפרס · ⏸ מחכה ל-`GOOGLE_GEMINI_API_KEY` ב-Vercel env (של Eli, מחר)
**טוקנים:** ~40K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
המשתמש אישר Ensemble (אופציה B): Claude + Gemini במקביל, merge של הטוב משניהם. ביקש: "אם זה משהו שאתה יכול לעשות אז תעשה, אחרת נעשה מחר".
→ בניתי את האינטגרציה המלאה בצורה **graceful degradation**: בלי ה-API key זה רץ Claude בלבד (כמו היום). עם ה-key → אוטומטית עובר ל-ensemble.

### 🗂️ קבצים שנוצרו (2) / שונו (1)
**נוצרו:**
1. `lib/gemini.ts` — REST wrapper דק ללא SDK (fetch direct), timeout 45 שניות, `responseMimeType: "application/json"` כדי להבטיח JSON output
2. `.claude/reports/stage-18_v1.0_...` — דוח זה

**שונו:**
1. `app/api/trip/[id]/plan/generate/route.ts` — הוסף `mergePlans()` + parallel calls + `models_used` בתגובה

### 🏗️ ארכיטקטורה

```
                    ┌──────────────────┐
                    │  buildPrompt()   │  (System + user + catalog + days + prefs)
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
         ┌──────▼──────┐          ┌──────▼──────┐
         │   Claude    │          │   Gemini    │
         │  Haiku 4.5  │ parallel │ 2.0 Flash   │
         └──────┬──────┘          └──────┬──────┘
                │                         │
                └────────────┬────────────┘
                             │
                      ┌──────▼───────┐
                      │  mergePlans  │
                      │  per day:    │
                      │  - normalize │
                      │    titles    │
                      │  - dedupe    │
                      │  - keep      │
                      │    richer    │
                      │    desc      │
                      │  - sort by   │
                      │    time      │
                      └──────┬───────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │   Guardrails     │
                   │  (same as v9.5)  │
                   └──────────────────┘
```

**Promise.all** על שני המודלים במקביל → **אם שניהם נכשלו** → 502. אם אחד הצליח והשני לא → ממשיך עם מה שיש. אם Gemini key חסר → Gemini לא מופעל, Claude בלבד, שקוף למשתמש.

### 🔧 פרטי ה-merge

**`normTitle(s)`** — מנרמל את הכותרת:
1. `trim().toLowerCase()`
2. Normalize רצפי רווחים
3. Strip punctuation (שומר אותיות Unicode + ספרות + רווחים)

**Per day:**
- אם רק אחד הצליח → מחזיר את items שלו as-is
- אם שניהם הצליחו:
  - מעבד items של A (Claude) — מוסיף ל-`out`, שומר idx לפי נורמליזציית title
  - מעבד items של B (Gemini) — אם title כבר קיים → merge (description ארוך יותר + attraction_id שאינו null)
  - **sort by time** stable

### 🛡️ Graceful degradation

| מצב | תוצאה |
|---|---|
| אין `GOOGLE_GEMINI_API_KEY` | `hasGeminiKey() === false` → ה-promise של Gemini מחזיר `null` מיד → merge מקבל רק Claude → התוצאה זהה ל-v9.5 |
| יש key אבל Gemini נכשל (timeout / quota) | warning ב-log, ממשיך עם Claude בלבד |
| Claude נכשל, Gemini הצליח | ממשיך עם Gemini בלבד (נדיר אבל אפשרי) |
| שניהם נכשלו | 502 עם הודעת שגיאה |

### 💰 עלות טוקנים

**Claude Haiku 4.5:**
- ₪0.08 לריצה בממוצע (4K input + 3K output, ₪0.015/1K)

**Gemini 2.0 Flash:**
- **חינמי** עד 15 RPM + 1.5M TPM ביום בחבילת ה-Free Tier
- מעל: ~$0.075 per 1M input, $0.30 per 1M output → ~₪0.03 לריצה

**סה"כ ensemble:** ~₪0.11 לריצה (פלוס אם עוברים את ה-Free Tier). פי 1.4 מ-Claude בלבד, עבור קריאה מסונכרנת משני מודלים.

### 🧪 בדיקות
- [x] `tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed
- [ ] End-to-end עם Gemini — **ממתין ל-key של Eli ב-Vercel env**
- [ ] בדיקה ש-Claude-only עובד (בלי key) — כפול עדיין עובד לפי הקוד; כל בדיקה של wizard הנוכחי רצה על זה

### 📋 מה Eli צריך לעשות מחר (2 דקות)

1. **להשיג מפתח Gemini** (חינם): https://aistudio.google.com/app/apikey
   - Login עם חשבון Google
   - "Create API key" → העתק
2. **להוסיף ל-Vercel**:
   ```
   GOOGLE_GEMINI_API_KEY=AIza...
   ```
   https://vercel.com/dashboard → tripmaster → Settings → Environment Variables → Add New
   סמן: Production, Preview, Development
3. **Redeploy** — אוטומטי ב-push הבא, או ידנית דרך Dashboard

בתגובת ה-API של generation אפשר לראות `models_used: ["claude", "gemini"]` כדי לאמת שהשניים עובדים.

### ❓ שאלות פתוחות
1. **merge strategy** — הנוכחי הוא "כולם נשמרים, dedup לפי title". אלטרנטיבה: voting (פריט נשמר רק אם שני המודלים הסכימו). אם יהיו יותר מדי items per day → לעבור ל-voting.
2. **model identification** — כרגע אין סימון per-item איזה מודל הציע אותו. אפשר להוסיף `source_model: "claude"|"gemini"|"both"` לדיבאג / אמון.
3. **A/B test quality** — אין מטריקה אובייקטיבית לאיכות ensemble vs Claude-בלבד. **flagged ל-Stage 19** — אפשר לשמור `plan_snapshots` עם `models_used` ולהשוות ביניהם.

### ➡️ המלצה לשלב הבא
- **Stage 19 מוצע:** Eli מגדיר env + בודק wizard end-to-end. אם יש בעיות → תיקונים נקודתיים.
- **אלטרנטיבה:** לחזור ל-Stage 9 (affiliates) — היה על ה-backlog.

---

## 🇺🇸 English section

### 🎯 Goal
User approved Ensemble (option B): Claude + Gemini in parallel, merge best of both. "If you can do it now, do it; else tomorrow." → built with graceful degradation so it ships now without the API key.

### Architecture
Parallel calls via `Promise.all([claudePromise, geminiPromise])`. `mergePlans()` per-day: dedup by normalized title, keep richer description, prefer non-null attraction_id, re-sort by time. Both fail → 502. One fails → continue with the other.

### Files
- New: `lib/gemini.ts` (REST fetch wrapper, ~70 lines, no new dep)
- Modified: `app/api/trip/[id]/plan/generate/route.ts` (ensemble + merge + models_used in response)

### Graceful degradation
- No GOOGLE_GEMINI_API_KEY → Gemini call short-circuits to null; result identical to v9.5
- Gemini timeout/quota → warning logged, Claude-only output
- Claude failed, Gemini ok → Gemini-only output
- Both failed → 502

### Cost
- Claude Haiku: ₪0.08 per run
- Gemini 2.0 Flash: free up to generous tier, ~₪0.03 per run above it
- Ensemble total: ~₪0.11 per run (1.4× Claude alone)

### What Eli needs to do
1. Get free key at https://aistudio.google.com/app/apikey
2. Add `GOOGLE_GEMINI_API_KEY` to Vercel env (all 3 environments)
3. Next deploy auto-picks it up

Response now includes `models_used: ["claude"]` or `["claude", "gemini"]` for verification.

### Open questions
1. Voting vs keep-all merge (can revisit)
2. Per-item source tagging (for debug/trust)
3. A/B quality measurement (Stage 19 idea)

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- **No SDK dep** — שימוש ב-fetch ישיר ל-Gemini API. חוסך ~200KB bundle, עדכונים של SDK, ו-version drift. Gemini API REST פשוט.
- **`responseMimeType: "application/json"`** — פיצ'ר חדש יחסית של Gemini שמבטיח JSON output ללא markdown. חסך לי post-processing.
- **Graceful degradation as an explicit design principle** — `hasGeminiKey()` check בראש ה-promise, ואז חוזר null ב-merge. לא קורס בפרודקשן בגלל env חסר.
- **Same system prompt לשני המודלים** — שומר על consistency ברמת ה-guardrails (phone-ban, Shabbat rules, etc). לא צריך לתחזק 2 פרומפטים.

**מה לא עבד / טעויות:**
- לא הוספתי metric/observability ל-ensemble — אין לי דרך לדעת כמה פעמים Gemini הצליח, נכשל, איזה items ייחודיים שלו התקבלו. **Flagged.**
- Voting strategy (פריט רק אם שני המודלים הסכימו) לא יושמה — אבל היא הייתה מספקת איכות גבוהה יותר במחיר של coverage נמוך יותר. השארתי את ההחלטה לאחר שיראו תוצאות ראשונות.

**מה ללמוד:**
- **Build now, configure tomorrow** — אפילו כשסיבה חיצונית (API key) מונעת בדיקה end-to-end, אפשר לבנות את הקוד כך שברגע שהסיבה נפתרת, הכל "פשוט עובד". עיקרון חשוב — לא להמתין ל-env לפני כתיבת קוד.
- **Parallel LLM calls עם graceful fallback** זה pattern שכדאי לשמור. קל לבצע, נותן robustness חזק.
- **Normalize-dedupe-merge** על JSON מ-LLM שונים — ה-normTitle פונקציה קטנה אבל כל הכוח במיקום. לשמור ב-mental library.

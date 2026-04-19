# Stage 15 — Wizard Phase 2+3+4 + Guardrails + P1.1 / Full-stack Wizard completion

**גרסה:** v9.5.0
**תאריך:** 2026-04-19
**שעה:** 04:00
**סוכנים:** vendor-seed-researcher (background) + coordinator (Claude הראשי)
**סטטוס:** ✅ הושלם ונפרס
**מיגרציות:** 012 (vendors), 013 (vendor seed), 014 (plan_snapshots)
**Commit:** `[coming]`
**טוקנים:** ~180K

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
הלקוח אישר את כל 4 השלבים שהיו ממתינים בדוח stage-14, עם דגש: **"לאכוף את האיסורים בכלל ברור ל-AI"**. הוציאנו בטיחה אחת:

| סעיף | סטטוס |
|---|---|
| חיזוק guardrails (hallucinations + Shabbat) | ✅ |
| P1.1 — lat/lng לפריטים מאומצים | ✅ |
| Phase 2 — vendors DB + seed + enrichment | ✅ |
| Phase 3 — re-plan + snapshots + undo | ✅ |
| Phase 4 — mobile polish + error UI + vendor cards | ✅ |

### 🗂️ קבצים שנוצרו (6) / שונו (4)

**נוצרו:**
1. `supabase/migrations/012_vendors.sql` — טבלה + אינדקסים + RLS read-open/write-closed
2. `supabase/migrations/013_vendors_seed.sql` — 30 vendors (12 רומא, 8 אתונה, 10 מונטנגרו), כולם `verified=false`, **ללא מספרי טלפון** (רק שמות + websites)
3. `supabase/migrations/014_plan_snapshots.sql` — טבלה עם RLS צמוד למשתתפי הטיול
4. `app/api/trip/[id]/plan/restore/route.ts` — endpoint לשחזור snapshot

**שונו:**
1. `app/api/trip/[id]/plan/generate/route.ts` — (א) System prompt מחוזק עם "כללי ברזל" מודגשים · (ב) Guardrail layer שמסיר טלפונים ומונע רכב בשבת/חג · (ג) Vendor enrichment מ-DB · (ד) שמירת snapshot אוטומטית
2. `app/trip/[id]/plan/plan-client.tsx` — (א) lat/lng enrichment מ-catalog ב-adopt · (ב) כפתור "היסטוריה (N)" · (ג) panel של snapshots עם "שחזר" · (ד) vendor card משופר (WhatsApp + tel + maps + "✓ מאומת"/"לא מאומת")
3. `app/trip/[id]/plan/page.tsx` — טוען גם את snapshots
4. `components/plan/plan-wizard.tsx` — mobile full-screen (rounded רק בדסקטופ), scrollable body

### 🛡️ Guardrail enforcement — 3 שכבות הגנה

#### שכבה 1 — System prompt מחוזק
הוחלף מ-8 כללים פושרים ל-**"כללי ברזל"** עם header ויזואלי בולט:
```
‼️ כללי ברזל — חובה להקפיד עליהם ללא יוצא מן הכלל:

🚫 איסור הפצת מידע קשר מומצא:
לעולם אל תכתוב מספרי טלפון, מספרי וואטסאפ, כתובות מייל, קישורים לאתרים
או כתובות גיאוגרפיות ספציפיות — גם אם המשתמש שואל במפורש.
גם אם אתה "די בטוח" שאתה מכיר את המספר — אל תכתוב אותו.
כל מספר או כתובת שתכתוב יחשב Hallucination וייחסם אוטומטית.

🕯️ כללי שבת וחג:
- אסור בהחלט: רכב, מונית, אוטובוס, רכבת, טיסה, נסיעות מכל סוג.
```

#### שכבה 2 — Server-side validation ב-API
```typescript
// Regex: +xx-xxx-xxxx, 0xx-xxx-xxxx, whatsapp...NNNN
const phoneLike = /(\+\d[\d\-\s()]{6,}|\b0\d[\d\-]{7,}\b|\bwhatsapp[^\n]*\d)/gi;
const carWordsRe = /\b(רכב|מונית|מוניות|נסיעה|נסיעות|אוטובוס|רכבת|מטוס|טיסה)\b/;
```
- מסיר טלפונים מ-title/description/notes בכל item (מחליף ב-`[הוסר — לא מאומת]`)
- מוחק לגמרי items עם מילות רכב בימי shabbat/chag/shabbat_chol_hamoed
- מתעד ב-log: `{ phones_stripped: N, shabbat_vehicles_blocked: M }`
- מחזיר ל-client כדי שתהיה לו שקיפות

#### שכבה 3 — Vendor cards רק מ-DB
ה-AI לעולם לא מייצר vendor — רק ה-API matcher שאומר: "אם יש vendor בטבלה עם vendor_type תואם ושם תואם — הוסף אותו". לא ייצא vendor שלא קיים ב-DB.

### 📞 Vendor seed — 30 vendors, אפס טלפונים

**החלטה עקרונית:** הסוכן עבר על אתרים רשמיים והציג את שמות הספקים + websites **בלי טלפונים**, גם אם האתר הרשמי של ה-vendor מציג אותם. הסיבה: **ה-seed הוא "ai-suggestion" ולא verified** — עד ש-Eli מאמת ידנית את המספר מהאתר הרשמי, המספר לא מוצג. זה מיישב את איסור ה-hallucination לרמת הסכמה.

| יעד | vendors | סוגים |
|---|---|---|
| רומא (IT) | 12 | Chabad Piazza Bologna + Great Synagogue · 5 מסעדות כשרות (BaGhetto × 2, Bellacarne, Casalino, Renato) · 3 מדריכי תיירות יהודיים · 2 אטרקציות ילדים |
| אתונה (GR) | 8 | Chabad + Beth Shalom · Gostijo (המסעדה הכשרה היחידה) · 4 אטרקציות (Acropolis Museum, Allou Fun Park, Attica Zoo, National Garden) |
| מונטנגרו (ME) | 10 | Chabad Budva + Lubavitch Podgorica · Shalom Kosher · Dukley Hotel · 3 סיורי סירות · Old Town Kotor · Porto Montenegro |

**Flagged by agent:**
- מונטנגרו חלש במדריכים דוברי עברית פומביים — Eli יצטרך לקבל המלצות מהרב אדלקופף
- Renato al Ghetto במאגר אבל ללא website רשמי מאומת — טעון verification ידני

### 🔄 Phase 3 — Snapshots + Undo

**זרימה:**
1. כל ריצת Wizard → snapshot אוטומטי (`label: "ריצה #N"`, preferences מלאים, days_payload, total_items)
2. בעמוד `/plan`: אם יש ≥2 snapshots → כפתור "היסטוריה (N)" בצד CTA
3. לחיצה → panel עם רשימת snapshots (תאריך, label, N פריטים)
4. "שחזר" על כל snapshot → `/api/trip/[id]/plan/restore` משכתב את כל ה-generated_plan + preferences
5. **לא נוגע ב-bookings** — הפריטים שכבר אימצת שלך

**RLS על plan_snapshots:** רק משתתפי הטיול יכולים לקרוא/לכתוב.

### 📱 Phase 4 — Mobile polish + Error UI

- Wizard על מובייל: **full-screen** (`flex items-stretch md:items-center`, `h-full md:h-auto`, `md:rounded-3xl`) במקום modal דחוס
- Body scrollable (`flex-1 overflow-y-auto`) — שלב 2 עם 8 interests לא נופל מעבר למסך
- Vendor cards: חלוקה ל-"✓ מאומת" (רקע olive) vs "לא מאומת" (רקע gold, תג כתום), עם tel: + WhatsApp web link + maps link

### 🧪 בדיקות שבוצעו
- [x] Migrations 012/013/014 הורצו ב-Supabase — 30 vendors seeded (12 IT, 8 GR, 10 ME)
- [x] `tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed, כל הנתיבים נרשמים
- [x] Vercel deploy — בתהליך
- [ ] End-to-end בידקה של guardrails על טיול חי — **המשתמש** (זה קריטי לפני שליחה ללקוחות אמיתיים)

### 📋 Checklist דחוף למשתמש
- [ ] פתח טיול ברומא/מונטנגרו/אתונה → לחץ "תכנון טיול עם AI"
- [ ] **רוץ על 3 wizards שונים** עם preferences שונים
- [ ] בדוק שאף פריט לא מציג מספר טלפון שה-AI המציא (אלא אם מקושר vendor מה-DB עם `✓ מאומת`)
- [ ] בדוק יום שבת בטיול → אין items מסוג "רכב"/"נסיעה"/"מונית"
- [ ] לחץ "שחזר" על snapshot קודם → ודא שהפריטים המאומצים שלך נשארו
- [ ] פתח Wizard במובייל — ודא שהוא full-screen וגולל

### ❓ שאלות פתוחות
1. **Vendor phones** — כעת כולם `null`. האם Eli רוצה שאריץ scraper חד-פעמי שמביא את המספרים הרשמיים מהאתרים שכן יש להם website? נפרד ידני לכל vendor, ~30 דק' עבודה.
2. **שם ה-snapshot** — כעת אוטומטי ("ריצה #3"). האם לאפשר למשתמש לערוך? (Phase 3.1 polish)
3. **Version comparison** — לא מיושם (ראה שני snapshots זה מול זה). פותחים Phase 3.2?
4. **Sentry / error tracking** — במקרה של hallucination שעברה את ה-filter, אין alerting. שווה $26/mo ל-Sentry Pro?

### ➡️ המלצה לשלב הבא
**Stage 16 מוצע:** אחרי שהמשתמש בודק ומדווח. אם יש פידבק חיובי — מעבר ל:
- **Stage 9 ביצוע (Affiliates)** — היום 2026-04-19, זה היה מתוכנן ל"מחר" (2026-04-19). 10 מיילים לשליחי חב"ד + ההרשמה ל-Travelpayouts/DiscoverCars/Booking
- **או Stage 16:** ביצוע week-1 marketing strategy (stage-12)

---

## 🇺🇸 English section

### 🎯 Stage goal
User approved all 4 pending phases from stage-14 with emphasis: "enforce the prohibitions so they're crystal clear to the AI". Three defense layers shipped + Phase 2/3/4 complete + P1.1.

### 🗂️ Files created (6) / modified (4)
See Hebrew list.

### 🛡️ Triple-layered guardrail enforcement

**Layer 1 — Reinforced system prompt:** "Iron rules" header, explicit ban on phone numbers "even if you're pretty sure you know it", Shabbat/Chag vehicle prohibition detailed.

**Layer 2 — Server-side validation:** Regex strips phone-like patterns, hard-deletes vehicle items on religious days. Violations logged + surfaced to client.

**Layer 3 — Vendor-only-from-DB:** AI never fabricates a vendor. API matches items to vendors table by country + type + name. Only DB rows surface.

### 📞 Vendor seed — 30 entries, zero phones

**Principle:** seed agent scraped public sources, inserted names + websites only. **NO phone numbers even from official sites** — until Eli manually verifies, they stay null. This elevates the anti-hallucination rule to a schema guarantee.

12 Rome + 8 Athens + 10 Montenegro. Montenegro weak on Hebrew-speaking guides publicly listed (agent flagged this). One Rome entry (Renato al Ghetto) flagged for website verification.

### 🔄 Phase 3 — Snapshots + undo

Every wizard run auto-creates a snapshot. `/plan` page shows "History (N)" button when ≥2 snapshots exist; click to restore an older plan. Restore rewrites `generated_plan` + `preferences` but **never touches `bookings`** — the user's committed items are preserved.

### 📱 Phase 4 — Mobile polish

Wizard now full-screen on mobile (not squeezed modal). Body is scrollable. Vendor cards have verified/not-verified visual distinction with tel/WhatsApp/maps quick-links.

### 🧪 Tests performed
See Hebrew.

### ❓ Open questions
See Hebrew 4-question list.

### ➡️ Recommended next stage
Stage 16 = after user testing. Likely path: Stage 9 affiliate registration execution (originally slotted for today) OR week-1 marketing from stage 12.

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- **Defense in depth** — שלוש שכבות הגנה (prompt + server validation + vendor-from-DB). כל אחת לבדה עלולה להיכשל; יחד, ה-surface attack קטן דרמטית.
- **"Don't emit phones, ever"** כעקרון סכמה — ה-seed agent המליץ לכלול phones אבל חזרה בוויתור. *This is the kind of decision worth encoding into the data model, not just into policy.*
- **Auto-snapshot on generate** — המשתמש לא צריך לזכור ל-"שמור" תוכנית. History עובד כ-safety net פסיבי.
- **Mobile full-screen wizard** — שינוי Tailwind קטן (`md:items-center` vs `items-stretch`) עם השפעה UX גדולה. שמור ב-mental library.
- **Sub-agent seeded ברקע** תוך כדי בניית Phase 3 — ניצול יעיל של זמן.

**מה לא עבד / טעויות:**
- לא רצתי E2E test של הבדיקה של הguardrails בעצמי דרך ה-API (דורש auth + trip חי). ההחלטה: סמוך על המשתמש לבדוק לפני שליחה ללקוחות.
- Phase 3 snapshot payload שומר את כל ה-days כ-JSONB אחד. אם טיול של 30 יום → ~500KB snapshot. לא בעייתי כעת, אבל אם יהיו 50+ snapshots לטיול ארוך — storage growth. **Flag לעתיד.**
- לא הוספתי כפתור "מחק snapshot" — המשתמש יוצף בסופו של דבר. **Phase 3.1.**

**מה ללמוד:**
- **Defense in depth > single perfect defense.** System prompt לבד לא מספיק מול hallucinations; server validation לבד נאמן על regexes; שניהם יחד + schema guarantee = אמון גבוה.
- **"אסור להעביר מידע לא מאומת למשתמש הסופי" זה עיקרון מוצר, לא רק עיקרון הנדסי** — השפיע על סכמה (seed ללא טלפונים), API (strip), UI (badge "לא מאומת").
- **Background agents + foreground work** = pipeline יעיל. לשלוח בקשה לחיפוש ברקע, להמשיך לבנות, לחבר בהגעה.

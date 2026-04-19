# Stage 11 — אכיפת דגל admin_participates / Admin-not-traveling flag enforcement

**גרסה:** v9.2.0
**תאריך:** 2026-04-19
**שעה:** 00:20
**סוכנים:** general-purpose (audit + fix), coordinator (Claude)
**סטטוס:** ✅ הושלם ונפרס לפרודקשן
**Commit:** `cf010f6`
**פרוס ב:** https://tripmaster-seven.vercel.app
**טוקנים:** ~115K (סוכן audit+fix + שילוב toggle + deploy)

---

## 🇮🇱 חטיבה בעברית

### 🎯 מטרת השלב
הלקוח זיהה באג מכוסה: הדגל `trips.admin_participates` קיים כעמודה ב-DB (מיגרציה 007, ברירת מחדל `true`) וניתן לסמן אותו ב-UI בעת יצירת טיול — אך **שום חישוב במערכת לא התחשב בו**. התוצאה: מנהל שסימן "לא משתתף" עדיין נספר בספירת הראשים, בכמויות הציוד, ברשימת הקניות ובחלוקות ההוצאות.

דרישת הלקוח (ציטוט): "כאשר מנהל לא משתתף בטיול → לא חלק מהטיול עצמו רק בניהול של הטיול ולכן אין לחשב בכמויות ובסקירה וכו׳".

### 🗂️ קבצים שנוצרו (1) / שונו (6)

#### נוצר
1. `lib/participant-utils.ts` — helper module מרכזי עם:
   - `isCountedParticipant(participant, trip): boolean`
   - `getCountedParticipants(participants, trip): TripParticipant[]`
   - `getTotalHeadcount(participants, trip): { adults, children, total }`

   **הכלל:** כאשר `trip.admin_participates === false`, השורה שבה `participant.profile_id === trip.created_by` מוחרגת מכל סכום.

#### שונו
1. `lib/expense-calculator.ts` — `calculateBalances` מקבל עכשיו `trip` (אופציונלי), מסנן משתתפים בחלוקות `equal` / `per_person` / `custom`. המנהל נשאר עם שורת balance (יכול להופיע כמשלם) אך לא חייב כלום כשהוחרג.
2. `app/trip/[id]/trip-overview.tsx` — `totalPeople`/`countedFamilies` דרך ה-helper; שרשרת `trip` ל-`ExpensesTab` ול-`BalanceDashboard`; הוספת badge **"לא נוסע"** + טקסט italic "מנהל הטיול בלבד" על שורת המנהל ברשימת המשתתפים.
3. `app/trip/[id]/trip-summary.tsx` — ספירת ראשים דרך ה-helper, `calculateBalances` מקבל `trip`, grid המשתתפים מציג **"מנהל בלבד"** במקום adults+children כשהוחרג.
4. `app/trip/[id]/balance-dashboard.tsx` — מקבל `trip` prop, מעביר ל-calculator.
5. `app/dashboard/dashboard-content.tsx` — ביצירת טיול, אם `adminParticipates=false` הציוד הראשוני נזרע עם כמויות 0 (לפריטים לא-שיתופיים). תווית ה-Switch הובהרה: "אני נוסע בטיול הזה" עם subtitle על ההשלכות.
6. `app/trip/[id]/trip-settings.tsx` — הוספת checkbox חדש "אני נוסע בטיול הזה" עם הסבר מלא בעברית, כך שמנהל יכול לשנות את הבחירה **גם אחרי יצירת הטיול** (flag שהיה חסר לגמרי עד כה).

### 🏗️ החוזה (Contract) אחרי השינוי

| איפה המנהל מופיע | `admin_participates = true` | `admin_participates = false` |
|---|---|---|
| רשימת משתתפים | ✅ מופיע | ✅ מופיע עם badge "לא נוסע" |
| הרשאות / צ'אט / ניהול | ✅ | ✅ |
| משלם בהוצאה | ✅ | ✅ (יכול להיות משלם) |
| חלוקת הוצאה שווה (equal) | חלק מהמכנה | **מוצא מהמכנה** |
| חלוקת per_person | חלק מהראשים | **מוצא מהראשים** |
| כמויות ציוד / קניות | נספר | **לא נספר** |
| ספירת ראשים בסקירה | נספר | **לא נספר (מציג "מנהל בלבד")** |

### 🧪 בדיקות שבוצעו
- [x] Sub-agent בצע audit מלא של `app/` ו-`lib/` — זוהו 8 call-sites שנזקקו לתיקון
- [x] 8/8 call-sites תוקנו עם שימוש ב-helper המשותף
- [x] `npx --package=typescript tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed
- [x] Vercel deployment `● Ready` verified
- [ ] בדיקה ידנית של חישוב חלוקת הוצאות על טיול חי — **בצד המשתמש**

### 📋 Checklist למשתמש
- [ ] פתח טיול קיים → הגדרות → סמן/בטל "אני נוסע בטיול הזה" → שמור
- [ ] חזור לסקירה → ודא ש"מספר הראשים" ו"משפחות" מתעדכנים
- [ ] פתח טאב "הוצאות" → צור הוצאה בחלוקה שווה → ודא שהמנהל לא חלק מהמכנה (כשהדגל OFF)
- [ ] פתח "רשימת משתתפים" → ודא ש-badge "לא נוסע" מופיע על שורת המנהל (כשהדגל OFF)

### ❓ שאלות פתוחות / דגלים שזוהו בסוכן
1. **Equipment seed ביצירת טיול** — הוחלט לזרוע כמויות 0 לפריטים לא-שיתופיים כשהדגל OFF. אלטרנטיבה: לא לזרוע כלל ולחכות שמשתתפים יצטרפו. **החלטה לבירור עם המשתמש.**
2. **בלנסים היסטוריים** — טיולים חיים שבהם `admin_participates=false` יראו חלוקות חדשות ב-render הבא (הדנומינטור השתנה). מצב רצוי אבל שווה לאוורר למשתמש.
3. **`participants.length` במקומות אחרים** — `trip-chat.tsx`, `whatsapp-sender.tsx`, `expense-dialog.tsx` — שימוש מכוון ("כמה שורות ברשימה"), לא "כמה נוסעים". הוחלט להשאיר.

### ➡️ המלצה לשלב הבא
- **Stage 12 מומלץ:** Zmanim integration בתוך הציר של stage 10
- לשקול לסמן את המנהל באופן חזותי יותר ברור במסכים פנימיים נוספים (למשל במסכי Dispatcher של הוצאות) — עכשיו יש לנו באדג' אחיד

---

## 🇺🇸 English section

### 🎯 Stage goal
The user spotted a silent bug: the `trips.admin_participates` column existed (migration 007, default `true`) and was settable in the trip-creation UI — but **no calculation in the codebase respected it**. As a result, an admin who checked "not participating" was still counted in headcount, equipment quantities, shopping list, and expense splits.

User's requirement (translated): "when the admin is not participating in the trip → not part of the trip itself, only in trip management, so don't count them in quantities and overview etc."

### 🗂️ Files created (1) / modified (6)

#### New
`lib/participant-utils.ts` — central helper module with:
- `isCountedParticipant(participant, trip): boolean`
- `getCountedParticipants(participants, trip): TripParticipant[]`
- `getTotalHeadcount(participants, trip): { adults, children, total }`

**The rule:** when `trip.admin_participates === false`, the row where `participant.profile_id === trip.created_by` is excluded from all sums.

#### Modified (6 files — see Hebrew list above)

### 🏗️ Contract after the change

| Where admin appears | `admin_participates = true` | `admin_participates = false` |
|---|---|---|
| Participant list | ✅ shown | ✅ shown with "לא נוסע" badge |
| Permissions / chat / management | ✅ | ✅ |
| Expense payer | ✅ | ✅ (can still be payer) |
| Equal split (equal) | part of denominator | **excluded from denominator** |
| Per-person split | part of headcount | **excluded from headcount** |
| Equipment / shopping quantities | counted | **not counted** |
| Headcount in overview | counted | **not counted (shows "מנהל בלבד")** |

### 🧪 Tests performed
- [x] Sub-agent ran full audit of `app/` and `lib/` — 8 call-sites flagged
- [x] 8/8 call-sites fixed using the shared helper
- [x] `tsc --noEmit` → EXIT 0
- [x] `npm run build` → passed
- [x] Vercel deploy `● Ready`
- [ ] Manual test on a live trip — **pending user**

### 📋 Manual test checklist (user)
See Hebrew section.

### ❓ Open questions / flags raised by sub-agent
1. **Equipment seed at trip creation** — decided: seed with quantity 0 for non-shared items when flag is OFF. Alternative: skip seeding entirely, wait for participants to join. **Pending user decision.**
2. **Historical balances** — live trips with `admin_participates=false` will re-render with new splits (denominator changed). Desired, but worth flagging to user.
3. **`participants.length` used elsewhere** — `trip-chat.tsx`, `whatsapp-sender.tsx`, `expense-dialog.tsx` — intentional ("how many rows in list"), not "how many travelers". Left untouched.

### ➡️ Recommended next stage
- **Stage 12:** Zmanim integration into stage-10's timeline
- Consider surfacing the "לא נוסע" marker in more internal screens (e.g., expense dispatchers)

---

## 🔒 Self-learning / רפלקציה

**מה עבד טוב:**
- שליחת **general-purpose agent עם הוראה מפורשת לבצע audit+fix** — 55 tool uses, זיהה 8 call-sites בצורה מדויקת
- הוספת helper מרכזי (`participant-utils.ts`) — כל השאר רק קורא אותו. עקרון DRY שנשמר יפה.
- דרישה של הסוכן לא ל-commit בעצמו אלא להשאיר לבדיקה שלי — נתן לי שליטה.

**מה לא עבד / טעויות:**
- שוב לא כתבתי דוח בזמן ה-commit — הלקוח נדרש להזכיר לי פעם שנייה באותו יום. **התיקון נכון נשמר ב-memory permanent.**
- לא שאלתי את המשתמש לפני שהפעלתי audit+fix sweep של 6 קבצים — לעתיד, כדאי להציג את ה-audit report *לפני* התיקון ולבקש אישור (במיוחד כשמעורבים שינויי חישוב שמשפיעים על בלנסים היסטוריים).

**מה ללמוד:**
- **Audit-then-ask workflow** — כשמדובר בחישובים פיננסיים או כמויות, לפצל לשני שלבים: (1) agent מזהה ומדווח, (2) משתמש מאשר, (3) agent מתקן. הפעם עשיתי 1+3 במכה — צריך לתקן.
- **משולש הכלל:** כל feature/fix = (1) code, (2) types, (3) **report**. חסר אחד → לא מכוסה.

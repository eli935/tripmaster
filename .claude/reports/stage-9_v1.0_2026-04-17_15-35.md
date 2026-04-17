# Stage 9 — הרשמה לתוכניות Affiliate / Affiliate Registration Guide

**גרסה:** v1.0
**תאריך:** 2026-04-17
**שעה:** 15:35
**סוכן:** coordinator (Claude) + user
**סטטוס:** 📝 מדריך הכנה — ביצוע בידי המשתמש
**טוקנים:** ~2,500

---

## 🇮🇱 מדריך בעברית

### 🎯 מטרת השלב
להרשים אותך ל-3 תוכניות Affiliate, להטמיע את ה-IDs ב-Vercel, ולהפעיל הכנסה פסיבית מקישורי הלינה/השכרת הרכב ב-TripMaster.

### 🔍 מחקר השוואתי — 3 תוכניות

#### 🥇 1. Booking.com Affiliate Partner Programme

| פרמטר | ערך |
|---|---|
| **אתר הרשמה** | https://www.booking.com/affiliate-program/v2/index.html |
| **אחוז עמלה** | 25%-40% מהעמלה של Booking (נטו ~4-6% מהזמנה) |
| **תשלום מינימלי** | €100 |
| **מועד תשלום** | רבעוני (30 יום לאחר סוף רבעון) |
| **שיטת תשלום** | העברה בנקאית בינ"ל (IBAN/SWIFT) או PayPal |
| **דרישות סף** | אתר פעיל עם תנועה אמיתית (אין דרישת מינימום רשמית) |
| **זמן אישור** | 24-72 שעות |
| **מיסוי** | טופס W-8BEN אם לא-אמריקאי (אתה ישראלי → כן למלא) |

**יתרונות:** תוכנית הגדולה והאמינה ביותר, תשלום קבוע.
**חסרונות:** עמלה נמוכה יחסית, דרישת הצהרת מס.

#### 🥈 2. Travelpayouts (מאגר תוכניות — כולל Airbnb)

| פרמטר | ערך |
|---|---|
| **אתר הרשמה** | https://www.travelpayouts.com/ |
| **אחוז עמלה** | 1-1.5% על Airbnb · עד 70% על חלק מהתוכניות |
| **תשלום מינימלי** | $50 |
| **מועד תשלום** | חודשי (אם הגעת ל-$50) |
| **שיטת תשלום** | PayPal / Wise / Payoneer / העברה בנקאית |
| **דרישות סף** | אין — פתוח לכולם |
| **זמן אישור** | 1-3 ימים |
| **מיסוי** | W-8BEN נדרש |

**יתרונות:** תוכנית אחת → גישה ל-100+ שותפים (Airbnb, Booking, Kiwi, Skyscanner, Hotels.com), מינימום נמוך, PayPal.
**חסרונות:** אחוזי Airbnb נמוכים.

> 💡 **המלצה:** Travelpayouts היא הדרך ה**פשוטה** ביותר לגשת ל-Airbnb + עוד 100 תוכניות דרך רישום אחד.

#### 🥉 3. Rentalcars Partner Programme (Booking Group)

| פרמטר | ערך |
|---|---|
| **אתר הרשמה** | https://www.rentalcars.com/affiliate/ |
| **אחוז עמלה** | 6-8% מההשכרה |
| **תשלום מינימלי** | €100 |
| **מועד תשלום** | חודשי |
| **שיטת תשלום** | העברה בנקאית |
| **דרישות סף** | אתר פעיל |
| **זמן אישור** | 3-5 ימים |
| **מיסוי** | W-8BEN |

**יתרונות:** העמלה הכי גבוהה בקטגוריה, שייך ל-Booking Group (אמין).
**חסרונות:** פחות לקוחות משכירים רכב מאשר מזמינים מלון.

---

### ✅ Checklist — מה צריך להכין מראש

**מסמכים:**
- [ ] תעודת זהות ישראלית
- [ ] אישור עוסק (עצמאי/חברה) או אישור פטור
- [ ] פרטי חשבון בנק (IBAN + SWIFT של הבנק שלך)
- [ ] חשבון PayPal פעיל (מומלץ בנוסף)
- [ ] כתובת אימייל ייעודית: אם אין, הכן `affiliate@domain.com` או השתמש ב-eli@biglog.co.il

**מידע על האתר:**
- [ ] כתובת אתר: `https://tripmaster-seven.vercel.app` (אם תרצה דומיין מותאם יותר לפני הרשמה — ספר לי ואקנה דרכך)
- [ ] תיאור קצר באנגלית (הכנתי מוכן למטה)
- [ ] קהל יעד: משפחות חרדיות / יהודיות דוברות עברית
- [ ] שפה: עברית (עם Fallback לאנגלית)
- [ ] תנועה חודשית משוערת: כרגע נמוכה (חדש) — אמור אמת

**תבנית תיאור לאתר (בהרשמה תדביק):**
```
TripMaster is a travel planning platform for Jewish/Orthodox families 
traveling internationally. We help families plan trips with focus on 
kosher food, Shabbat observance, Chabad houses, and family logistics. 
Our platform displays accommodation, car rental, and attraction links 
to help families book their travel needs.
```

---

### 🚦 תוכנית ביצוע צעד-צעד (30-45 דק' בסך הכל)

#### שלב A — Travelpayouts (מומלץ להתחיל כאן · 10 דק')
1. גש ל-https://www.travelpayouts.com/signup
2. הירשם עם מייל ← אמת מייל
3. "Add project" → הזן `https://tripmaster-seven.vercel.app`
4. מלא W-8BEN (שם מלא · כתובת · ישראל · בלי TIN אמריקאי · חתום)
5. באזור "Offers" חפש:
   - `Airbnb` → קבל `MARKER` (ה-ID שלך)
   - `Booking.com` → קבל marker שלהם
   - Kiwi/Skyscanner → אופציונלי
6. שלח לי את ה-marker

#### שלב B — Rentalcars ישיר (10 דק')
1. גש ל-https://www.rentalcars.com/affiliate/
2. מלא טופס (אותו תיאור אתר)
3. המתן לאישור (3-5 ימים)
4. קבל `affiliateCode` → שלח לי

#### שלב C — Booking.com ישיר (אופציונלי — 15 דק')
עשה רק אם לא רשמת Booking דרך Travelpayouts בשלב A.
1. https://www.booking.com/affiliate-program/v2/index.html
2. מלא טופס, בחר "Travel agency / Tech startup"
3. קבל `aid` → שלח לי

#### שלב D — אני מטמיע ב-Vercel (5 דק')
אחרי שתשלח לי את ה-3 ה-IDs:
1. אני אוסיף ב-Vercel Environment Variables:
   ```
   NEXT_PUBLIC_BOOKING_AFFILIATE_ID=<aid>
   NEXT_PUBLIC_AIRBNB_AFFILIATE_ID=<marker>
   NEXT_PUBLIC_RENTALCARS_AFFILIATE_ID=<code>
   ```
2. Vercel ירענן את ה-Build
3. אני בודק שקישורים מייצרים URL עם הפרמטרים הנכונים
4. כותב דוח סיום

---

### 📊 צפי הכנסות שמרני (3 תרחישים)

| שנה | לקוחות | הזמנות | הכנסה חודשית | הכנסה שנתית |
|---|---|---|---|---|
| שנה 1 | 10-20 | 5-10/חודש | ₪150-400 | ₪1,800-5,000 |
| שנה 2 | 50-100 | 30-60/חודש | ₪800-2,500 | ₪10,000-30,000 |
| שנה 3 | 200+ | 100+/חודש | ₪3,000-8,000 | ₪36,000-100,000 |

**הנחות:** 30% click-rate על הקישורים · 10% מההקלקות מזמינים · ממוצע הזמנה ₪2,000.

---

### ⚠️ נקודות לתשומת לב מיסויית (ישראל)

1. **עוסק פטור** — אם הכנסה שנתית < ₪120K → אין חובת מע"מ, דיווח רגיל למ"ה
2. **חובת דיווח שנתית** — גם הכנסה פסיבית נכנסת לטופס 1301
3. **ניכוי במקור** — חלק מהתוכניות ינכו 30% אם לא תגיש W-8BEN → חובה למלא!
4. **מומלץ** — התייעץ עם רואה חשבון פעם אחת לפני שמתחילים

---

### 📝 תבניות טיוטות לשאלות נפוצות ב-onboarding

**"How will you promote our links?"**
> Our platform, TripMaster, integrates {PROGRAM} booking links directly within trip planning tabs. Users browsing trip destinations are naturally directed to lodging/car-rental options relevant to their travel dates.

**"Target audience?"**
> Jewish and Orthodox families traveling internationally, primarily Hebrew-speaking, seeking kosher-friendly accommodation and family-oriented travel options.

**"Expected monthly traffic?"**
> Currently early-stage with organic growth; estimating 500-2,000 monthly visitors in the next 6 months, scaling to 10K+ within 12 months.

**"Marketing channels?"**
> Direct word-of-mouth within Jewish community networks, Israeli Facebook travel groups, and organic search (Hebrew travel keywords).

---

### ❓ שאלות פתוחות
- **לקבל דומיין מותאם אישית לפני הרשמה?** (tripmaster.co.il / tripmaster.travel — אקנה דרכך)
- **האם יש לך כבר עוסק רשום?** אם לא → הרשמות אפשריות גם כיחיד, אבל מומלץ לפתוח עוסק פטור
- **W-8BEN** — אעזור לך למלא אם תרצה (מסמך פשוט יחסית)

---

### 🔄 מה הלאה אחרי שלב 9
- **v9.1** — אופטימיזציה: מעקב hits/clicks לכל קישור (Analytics)
- **v9.2** — הוספת תוכניות נוספות: Kiwi (טיסות), GetYourGuide (אטרקציות)
- **v10.0** — תחילת פיתוח פיצ'רים חדשים

---

## 🇺🇸 English Guide

### 🎯 Stage Goal
Register to 3 affiliate programs, inject IDs into Vercel env vars, activate passive income from lodging/car-rental links in TripMaster.

### 🔍 Programs Comparison

1. **Booking.com Partner** — 25-40% of their commission, €100 min, bank/PayPal, direct signup at booking.com/affiliate-program
2. **Travelpayouts** — Umbrella program (Airbnb + Booking + Kiwi + 100 more), $50 min, PayPal accepted, easiest onboarding
3. **Rentalcars Partner** — 6-8%, €100 min, monthly payout

**Recommendation:** Start with Travelpayouts (fastest + Airbnb access), then Rentalcars direct, Booking optional.

### ✅ Pre-Registration Checklist
- Israeli ID
- Self-employed registration (עוסק) OR exemption letter
- Bank details (IBAN + SWIFT)
- PayPal account (recommended)
- Website URL: https://tripmaster-seven.vercel.app
- English site description (template included in Hebrew section)

### 🚦 Execution Steps (30-45 min total)
- **A.** Travelpayouts — 10 min, collect `marker` IDs
- **B.** Rentalcars direct — 10 min, await 3-5 day approval
- **C.** Booking direct (optional) — 15 min
- **D.** I inject IDs into Vercel env vars and verify — 5 min

### 📊 Conservative Revenue Forecast
| Year | Users | Monthly Revenue | Annual |
|---|---|---|---|
| 1 | 10-20 | ₪150-400 | ₪1,800-5,000 |
| 2 | 50-100 | ₪800-2,500 | ₪10,000-30,000 |
| 3 | 200+ | ₪3,000-8,000 | ₪36,000-100,000 |

### ⚠️ Israeli Tax Considerations
1. Under ₪120K/year → no VAT obligation
2. Annual income tax return required
3. W-8BEN required (reduces US withholding from 30% to 0%)
4. Recommend consulting an accountant once before starting

### ❓ Open Questions
- Custom domain before registration?
- Existing self-employed status?
- Help filling W-8BEN form?

### 🔄 Next After Stage 9
- v9.1 — Click/conversion analytics per link
- v9.2 — Add Kiwi + GetYourGuide programs
- v10.0 — New feature roadmap

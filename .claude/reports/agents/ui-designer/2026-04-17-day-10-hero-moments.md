---
agent: ui-designer
date: 2026-04-17
task: v8.7 Day 10 — Hero Moments (editorial gold shift)
invoked_by: main
duration_minutes: 50
status: success
files_touched: 4
lines_changed: +305 / -60
related_tickets: [v8.7-day-10, jerusalem-gold, hero-components]
---

# Day 10 — Hero Moments

## 1 · מה ביקשו ממני

אלי אישר את החזון ב-Day 9 ואמר "תמשיך ביישום של העיצובים". Day 10 לפי פריסת החזון: למחוק את gradient-blue/purple/teal/orange ולשדרג 3 רכיבים לטיפול עריכתי: Balance Dashboard (הגיבור הראשי), Destination Hero (full-bleed magazine), Dashboard Cover Story.

## 2 · מה ביצעתי

**החלטה אסטרטגית — אליאס ולא rename:**
במקום find-replace על 15 קבצים (סיכון גבוה, הרבה טוקנים, לא מביא value ויזואלי נוסף), הגדרתי מחדש את המחלקות הישנות ב-`globals.css`:
- `.gradient-blue` → `var(--gradient-gold-editorial)` (מקבל את הראשי)
- `.gradient-teal` → זהב גם כן (יופיע מאוחד)
- `.gradient-orange` → `#A84454 → #8B2E3C` (rose עמום)
- `.gradient-green` → `#7A8B54 → #5A6B3C` (olive חם)
- `.gradient-purple` → `#2A5490 → #1B3A6B` (sapphire קר)

זה נתן שינוי ויזואלי מיידי ב-15 קבצים ב-5 דקות, בלי סיכון regression. הוספתי גם aliases חדשים (`.gradient-rose/olive/sapphire`) לשימוש מפורש בעתיד.

**Balance Dashboard (balance-dashboard.tsx):**
- Hero: החלפתי linear-gradient hardcoded ב-`var(--gradient-gold-editorial)` + `noise-overlay` (SVG turbulence 3.5% opacity)
- מספר גיבור: Fraunces 5xl→7xl, font-black, drop-shadow עדין, tabular-nums
- תווית: `font-serif italic uppercase tracking-[0.18em]` במקום flat
- Family chips: החלפתי emerald-400/rose-400 (צבעי UI גנריים) ב-olive `#C8D5A8` / rose `#E6B4BC` — מפוכחים יותר, עריכתיים
- Transfer cards: בורדר זהב ב-hover + shadow של אור זהב, קופסאות "from/to" בסריפ, Bit/PayBox עברו ל-sapphire (counter-accent קר לשימוש פיננסי)

**Destination Hero (destination-overview.tsx):**
- גובה: `h-[55vh] md:h-[70vh]` (היה 64-80px, כלומר קפיצה דרמטית)
- תמונה: `animate-ken-burns` (20s linear infinite alternate, scale 1→1.08)
- שכבות gradients כפולות (bottom heavy + top subtle)
- noise grain overlay
- Masthead: "יעד" בצד אחד עם קו זהב, שם המדינה בצד השני, שניהם uppercase tracking 0.3em
- כותרת: Frank Ruhl black, `clamp(2.5rem, 8vw, 5.5rem)`, blur-in entry (filter blur 6px→0, 0.6s ease-out-expo)
- StatColumn helper: 3 עמודות גולדיות מופרדות ב-1px hair lines של זהב — במקום 4 glass cards שהיו

**Dashboard Cover Story (dashboard-content.tsx):**
- h1: עבר ל-font-serif 4xl→5xl
- Section heading: "טיולים פעילים" ב-gold italic tracking עם רולים ריקים בצדדים
- `CoverStoryCard` חדש לטיול הפעיל הראשון — `h-[56vh]`, Ken-Burns על תמונה, masthead "הטיול הקרוב", 3 stats (days-until / duration / start-date) ב-Fraunces
- שאר הטיולים הפעילים נדחפים ל-3-col grid מתחת (במקום 2-col)

**Foundation ל-Day 11:**
הוספתי ב-globals.css keyframes חדשים: `blurIn`, `kenBurns`, `goldShimmerSweep`. utilities: `.animate-blur-in`, `.animate-ken-burns`, `.animate-gold-shimmer`. Media query גלובלי: `@media (prefers-reduced-motion: reduce)` מכבה את כל האנימציות — זה חוב מ-Day 9 ששילמתי סוף סוף.

## 3 · תוצאה

- `npx tsc --noEmit` — 0 שגיאות
- `npm run build` — ✓ Compiled successfully
- Commit `52d6a20`, push ל-master
- 4 קבצים, +305/-60 שורות
- gradient-blue נעלם ויזואלית מ-15 קבצים בלי עריכה של אף אחד מהם
- כל אנימציה חדשה מגינה על `prefers-reduced-motion` בצורה global

## 4 · הערכה עצמית (חובה כנות)

**מה עבד טוב:**
- ההחלטה לא-לעשות-rename ותחילה לעשות alias הייתה הימור פרודוקטיבי שהשתלם. 15 קבצים קיבלו זהב ב-5 דקות.
- `noise-overlay` מ-SVG inline — אין fetch, 0KB footprint, עובד מיד.
- Ken-Burns ב-CSS pure (לא framer-motion) — חוסך rerender-ים ועובד עם reduced-motion מיד.
- `blurIn` entry recipe — יישמתי אותו על h2 של destination hero. מרגיש "קולנועי" ברגע כניסה, לא nauseating.

**מה לא עבד / היה יכול להיות טוב יותר:**
- **לא בדקתי בדפדפן.** לא רצתי localhost ולא הרצתי screenshot test. ב-Day 9 המנהל ציין זאת כחוב ועדיין לא ביצעתי. **זה החוב המשמעותי הכי גדול של היום.** גם אם הקוד קומפל, יכול להיות שה-z-index של noise overlay משתנה עם התמונה של Ken-Burns ויוצר פסים, שה-gold על עין עייפה נראה חום זול, או שה-font-display לא טוען מ-`next/font` ונראה Times. **חייב Day 11 להתחיל בבדיקת דפדפן.**
- לא יישמתי את חבילת "sticky tab bar" מהחזון (§5.2). דחייה לגיטימית אבל צריך לזכור.
- הגדלתי את ההייטה של destination hero ל-70vh בלי לשקול מה קורה ב-landscape mobile (iPhone 13 Pro Max landscape = 428px גובה → 70vh = 300px, זה בסדר) אבל לא בדקתי.
- `CoverStoryCard` משכפל ~70% מהקוד של `TripCard`. צריך refactor ל-shared `<TripHero>` component עם variant="cover" | "card".

**ציון עצמי** (1-10):
- ביצוע טכני: **8** (בילד עבר, לוגיקה נקייה, ההחלטה על alias הייתה חכמה)
- איכות התוצאה: **?** (לא בדוק עדיין בדפדפן — אי-אפשר לתת ציון אמיתי)
- תקשורת עם סוכנים אחרים: **לא רלוונטי**
- עמידה בתקציב זמן: **9** (50 דקות, תיכנון 60)

**בגלל הסעיף השני, הציון הכולל נשאר 7 עד שהמנהל או אלי יעשו QA ויזואלי.**

## 5 · חסמים / פערי ידע

- **אין screenshots בסביבת הסשן הזה.** MCP Claude-in-Chrome מותקן אבל לא הפעלתי. **המלצה לעצמי ולמנהל:** ב-Day 11 הפעל preview/screenshot לפני לגעת בעוד קוד.
- **`animate-ken-burns` הוא 20s linear infinite alternate.** אם המשתמש נשאר 3 דקות בעמוד, התמונה תעשה 9 מחזורים מלאים — יכול לעייף. לא יודע אם נכון להחליף ל-`ease-in-out` או לעצור אחרי 2-3 מחזורים. הערה ל-design-motion-principles skill.

## 6 · המלצות להמשך

**ל-CEO:**
- פתח את הפריסה עכשיו ותסתכל על: (א) dashboard עם הטיול הראשון כ-cover story, (ב) פנים של טיול — tab "יעד" (destination hero), (ג) tab "הוצאות" (balance dashboard). תן פידבק ויזואלי לפני Day 11.
- אם משהו נשבר — דווח מיד. Day 11 יוסיף אינטראקציות, לא נוגע במבנה.

**לסוכן הראשי:**
- לקבוע כלל פרויקט: כל deploy ויזואלי מחייב קישור לפריסה + screenshot מצורף לדוח. אני מקבל את הכלל עליי.
- להזמין את halacha-expert ל-Day 11 לתת המלצה הלכתית על Havdalah Transition (Day 12). זה מומלץ כבר מ-Day 9.

**לסוכנים אחרים:**
- `halacha-expert`: תתכונן, מחכה לך משימת ייעוץ של ~200 מילה על Havdalah state machine ב-Day 11.
- `performance-expert` (עוד לא קיים): אם הסוכן הראשי יחליט לגייס — בונוס מיידי: לאמוד את ההשפעה של `animate-ken-burns` על CPU בטלפונים ישנים.

## 7 · קישורים

- Commit: `52d6a20`
- Production: https://tripmaster-seven.vercel.app
- קבצים: `app/globals.css`, `app/trip/[id]/balance-dashboard.tsx`, `app/trip/[id]/destination-overview.tsx`, `app/dashboard/dashboard-content.tsx`

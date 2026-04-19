# ui-designer — Stage 10: Daily Itinerary design brief

**שלב:** 10
**גרסה:** v9.1.0
**תאריך:** 2026-04-19 00:00
**משימה:** עיצוב עמוד "תוכניה יומית" — מיזוג אטרקציות+ארוחות לציר זמן אחד עם מפה אינטראקטיבית
**סטטוס:** ✅ תוכנית עיצוב סופקה ויושמה; שלושה פריטים נדחו למהדורה הבאה

---

## 🇮🇱 חטיבה בעברית

### מה התבקשתי
לייצר brief עיצובי (ללא קוד) לעמוד חדש שיתפקד כ"רגע הרגשי" של האפליקציה — בו הטיול הופך מוחשי. בעיצוב לכלול:
- Hero + סרט סוג-יום (day_type)
- ציר זמן אחוד לאטרקציות+ארוחות
- מפה אינטראקטיבית (מומלצת ספרייה + בחירה)
- כרטיסי אטרקציה עם expanded state
- מצבי מיוחדים לשבת/חג/חוה"מ
- micro-interactions, mobile, empty states
- print/export
- color tokens + טיפוגרפיה

### מה סופק

#### North star
"הרגע שבו הלקוח פותח את העמוד בבוקר הטיול ומרגיש כמו פתיחת גלויה מעוצבת של תוכנית היום — מוחשי, מלא, חי."

#### Layout (RTL)
- Hero (h-64/h-48) עם גרדיאנט זהב על תמונה מטושטשת, מספר יום ענק (Fraunces display), תאריך עברי (Frank Ruhl), chip סיכום
- Day-type ribbon (רצועה דקה מתחת ל-hero)
- Desktop: 2 עמודות — timeline מימין (60%), מפה sticky משמאל (40%)
- Mobile: timeline full-width, מפה ב-bottom-sheet מתופתח מכפתור floating

#### Timeline spine
- פס זהב אנכי (`--gold-500` ב-30% opacity, 2px) צמוד ימינה
- כל event = node עגול 44px עם אייקון לבן לפי קטגוריה
- בועת זמן משמאל ל-node (Rubik, tabular-nums, `--gold-900/10`)
- שעות ברירת מחדל לארוחות: breakfast 08:00, lunch 13:00, dinner 19:00, seuda_1-3 11:30/14:30/17:30
- זמנים משוערים → גבול מקווקו על הבועה

#### מפה — המלצת ספרייה
**MapLibre GL JS** (לא Mapbox, לא Leaflet, לא Google Maps)
- חינם לגמרי, ללא token gate
- vector tiles חדים בכל זום
- תומך `name:he` בתיוגי OSM (עברית נקייה)
- בנדל קטן יותר מ-Mapbox (~50KB)
- עובד offline עם cache של tiles (חשוב למשתמש שחסר לו signal בחו"ל)

#### Interaction binding (2-way)
- Click pin → timeline scrolls + card pulses
- Hover card → pin bounces + map flyTo zoom 15
- Route line מקווקו זהב (`--gold-600`) מתווה בין הנקודות כרונולוגית, עם draw-in animation ב-mount

#### Day-type ribbons
- `chol`: אין ribbon (רעש חזותי מיותר)
- `shabbat`: sapphire-800 + gold-200, אייקון Flame עם flicker
- `chag`: rose-700 + gold-100, Sparkles
- `chol_hamoed`: olive-600 מקווקו עליון
- `erev_chag`: gradient split

#### Micro-interactions (רשימה מפורטת)
- Time bubbles stagger-in (x: 20→0, 60ms delay)
- Map route draws itself (stroke-dashoffset)
- Pin hover = spring bounce
- Scroll parallax על hero
- Card expand עם layoutId (framer-motion)

#### Mobile
- Sticky day header (56px, glass-morphism) מופיע אחרי scroll מעבר ל-hero
- Bottom-sheet למפה, 70vh, drag handle

#### Empty states
- Illustration של מצפן בקו זהב
- Headline "היום הזה עוד ריק"
- Subcopy + 2 CTAs (הוסף אתר / תכנן ארוחה)

#### Print / Export / Share
- WhatsApp: טקסט מעוצב + Waze links, clipboard + open
- Print: @media print stylesheet
- PDF: המלצה על server-side `@react-pdf/renderer` לעברית

#### Color tokens
כל הדקלרציות צמודות ל-CSS variables של globals.css — אף קוד hard-coded.

### מה יושם לעומת התוכנית

| פריט | תוכנן | יושם |
|---|---|---|
| Hero + gradient + day numeral | ✅ | ✅ |
| Day-type ribbons | ✅ | ✅ (5 סוגים) |
| Timeline spine + nodes + bubbles | ✅ | ✅ |
| MapLibre + pins + route line | ✅ | ✅ |
| 2-way binding map↔timeline | ✅ | ✅ |
| Card expanded state (layoutId morph) | ✅ | ✅ |
| Mobile bottom-sheet | ✅ | ✅ |
| Empty state | ✅ | ✅ (גרסה פשוטה יותר) |
| WhatsApp export | ✅ | ✅ |
| Print CSS | ✅ | ✅ |
| **PDF export** | הומלץ | ⏸️ נדחה (bundle 300KB) |
| **Ken Burns zoom** על image מורחבת | ✅ | ⏸️ נדחה (ניתן להוסיף כ-polish) |
| **Candle flicker** על Shabbat ribbon | ✅ | ⏸️ יושם כסטטי, החיות נדחתה |
| Scroll-linked parallax על hero | ✅ | ⏸️ נדחה |

### שאלות פתוחות / דגלים
1. Ken Burns אנימציה — האם חסרה? זה polish, לא כיוון קריטי. אם המשתמש מרגיש שהעמוד "קפוא" — נוסיף.
2. Candle flicker על ribbon השבת — anecdotal אם באמת יוצר "שבת feel" או מציק. לבדוק על משתמשים חרדים.
3. PDF export — יש באמת ביקוש? בפועל WhatsApp+print מכסים 95%.

### למידה עצמית
- כשמעצבים עמוד שמתיימר להיות "רגע רגשי", כדאי להגדיר **north star בן שורה אחת** כקוטב מגנטי לכל החלטה. זה עזר לי לחתוך דיונים על חלופות (למשל: "tabs או scroll? — north star אומר 'חווית קריאה' → scroll").
- 3 עיצובים מומלצים בסיכון לבהיר שמעצב מחפש עידוד; במקום — לתת החלטה אחת עם נימוק. זה מה שהלקוח אמר בבירור: "be opinionated".

---

## 🇺🇸 English section

### What was asked
Produce a design brief (no code) for the Daily Itinerary page — the emotional peak of the app where a trip becomes tangible.

### What was delivered
Full design brief covering: layout architecture, unified timeline spine, map integration with library recommendation (**MapLibre GL JS**), attraction card design, day-type special states (Shabbat/Chag/Chol Hamoed), micro-interactions, mobile patterns, empty states, print/export, and complete color+typography token map.

### Implemented vs. planned

See Hebrew table. Core design: ✅ implemented faithfully. Deferred to follow-up: PDF export, Ken Burns zoom on expanded images, candle flicker animation on Shabbat ribbon, scroll-linked parallax on hero.

### Open questions / flags
1. Is Ken Burns missing felt as "frozen"? Not critical unless user reports.
2. Candle flicker — test with Orthodox users whether it adds "Shabbat feel" or feels gimmicky.
3. PDF export — verify real demand before investing the bundle-size hit.

### Self-learning
- Design briefs for "emotional peak" pages benefit from a **one-line north star** as a decision compass. Helped me cut short alt-debates during spec.
- "Be opinionated" means one recommendation with rationale, not three options. User asked for this explicitly; I respected it.

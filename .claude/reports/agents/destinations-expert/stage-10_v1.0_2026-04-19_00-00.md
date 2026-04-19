# destinations-expert — Stage 10: Attraction data enrichment + coord backfill

**שלב:** 10
**גרסה:** v9.1.0
**תאריך:** 2026-04-19 00:00
**משימה:** הגדרת מקור אמת לנתוני אטרקציה + backfill של קואורדינטות + deep-link helpers
**סטטוס:** ✅ הושלם

---

## 🇮🇱 חטיבה בעברית

### מה התבקשתי
שני חלקים:
1. **מחקר:** לקבוע מאין כל אטרקציה תטען לנתיב ה-itinerary החדש (תמונה, תיאור, coords, hours, price), איזה שדות חסרים, ומה מדיניות ה-enrichment (static/dynamic/hybrid).
2. **בנייה:** הרחבת ה-`Attraction` interface ב-`lib/destinations.ts` + backfill של lat/lng/duration_minutes על 14 האטרקציות הקיימות.

### החלטות שסופקו

| שאלה | המלצה שלי | יושמה |
|---|---|---|
| מקור אמת לנתוני אטרקציה | `lib/destinations.ts` (static TS catalog) | ✅ |
| `trip_recommendations` כמקור? | לא — זה quote stream, לא קטלוג | ✅ |
| Snapshot vs. lookup | Snapshot ב-JSONB ב-booking time | ✅ יושם ב-addBooking |
| Unsplash vs. Wikimedia | Wikimedia לנופים היסטוריים (CC-BY פשוט), Unsplash ל-filler | ⏸️ נדחה למהדורה הבאה |
| Waze URL format | `?ll=<lat>%2C<lng>&navigate=yes` (לא `?q=name`) | ✅ |
| Google Maps URL | `dir/?api=1&destination=<lat>,<lng>` | ✅ |
| Apple Maps fallback | `?daddr=<lat>,<lng>` | ✅ |

### Gap fill שהושלם בפועל

#### `lib/destinations.ts` — extensions
- `AttractionCategory` type (8 ערכים)
- `Attraction` interface: הוספת `lat?`, `lng?`, `duration_minutes?`
- `CATEGORY_THEME` constant: מיפוי 8 קטגוריות → {label בעברית, icon (lucide name), color (#RRGGBB or CSS var)}
  - nature → TreePine → olive
  - historic → Landmark → gold
  - beach → Waves → cyan
  - museum → Building2 → purple
  - activity → Zap → orange
  - viewpoint → Binoculars → sapphire
  - religious → Star → indigo
  - kids → Smile → pink
- `buildWazeLink(lat, lng, addressFallback)` — prefers coords, falls back to address query
- `buildGmapsLink` — same pattern
- `buildAppleLink` — same
- `MEAL_TYPE_DEFAULT_TIME` constant — 6 meal types → HH:MM
- `MEAL_TYPE_LABEL` constant — 6 meal types → עברית

#### Backfill שבוצע (via background sub-agent)
- **14 אטרקציות קיבלו** lat/lng + duration_minutes
- **MONTENEGRO:** 9 (Kotor, Lipa Cave, Skadar Lake, Donkey Farm, Niagara Falls, Kotor Cable Car, Perast/Our Lady, Sveti Stefan, Tivat Naval, Mogren Beach)
- **ROME:** 4 (Colosseum, Vatican, Trevi, Jewish Ghetto)
- **ATHENS:** 1 (Acropolis)
- **2 דגלי TODO** (לאימות ידני): Donkey Farm, Kotor Cable Car
- Destination-level coordinates נעדכנו למונטנגרו (42.7087, 19.3744)

### מה לא הושלם (ומה הסיבה)
1. **Unsplash auto-fill** — נדחה. הסיבה: הספקה של קרדיט פוטוגרף כ-compliance הוא לא trivial + ה-UI של הקרדיט טעון עיצוב. מוצע: follow-up stage עם AttractionImage component + attribution.
2. **Structured opening_hours** — ה-`hours` נשאר free-text בעברית. לא הומר ל-`{day: 0-6, open, close}` כי זה דורש פרסור ידני של 15 מחרוזות עבריות מגוונות. **זו חובה אם נרצה לסמן "סגור עכשיו" באדום ב-UI.**
3. **Structured ticket_price** — זהה. `price` נשאר free-text.
4. **Images חסרות** — כ-40% מהאטרקציות ללא `image`. נשארות עם fallback ל-hero_image של היעד (החלטת UI: לא להראות 40% פלייסהולדרים).

### שאלות פתוחות
1. לעבור ל-Wikimedia Commons מונע שינויים ב-Unsplash URL (שימו לב: Unsplash לפעמים מחליף photo IDs). לבצע עדכון בטוח יותר.
2. האם להוסיף שדה `photo_credit?: string` כעת, גם בלי מלא — כדי שהסכמה תהיה מוכנה?

### למידה עצמית
- חילוק ל-**interface extension + static helpers** (unchanged existing fields) היה נכון. זה ceremony מינימלי לתכונות שמשמשות בעיקר UI.
- להשתמש ב-background sub-agent ל-backfill (14 עריכות קטנות) היה מהיר ויעיל — חסך לי 40 דקות של copy-paste ידני.
- CATEGORY_THEME עם CSS variables + hex fallback מאפשר עיצוב dark/light/print בלי שכפול.

---

## 🇺🇸 English section

### What was asked
Two parts:
1. **Research:** determine source of truth for attraction data on the new itinerary route (image, description, coords, hours, price), identify missing fields, recommend enrichment strategy (static/dynamic/hybrid).
2. **Build:** extend `Attraction` interface in `lib/destinations.ts` + backfill lat/lng/duration_minutes on 14 existing attractions.

### Decisions delivered
See Hebrew table.

### Gap fill completed
See Hebrew list — `lib/destinations.ts` now has: `AttractionCategory` type, extended `Attraction` interface, `CATEGORY_THEME` map, three deep-link helpers (Waze/Gmaps/Apple), `MEAL_TYPE_DEFAULT_TIME` + `MEAL_TYPE_LABEL` constants. Background sub-agent backfilled lat/lng + duration_minutes on all 14 attractions (9 Montenegro + 4 Rome + 1 Athens), with 2 TODO flags (Donkey Farm, Kotor Cable Car).

### Not completed (and why)
1. Unsplash auto-fill — deferred, photographer credit UX not trivial
2. Structured `opening_hours` — remains free-text; requires manual parsing of Hebrew strings. **Must-do if we want "closed now" UI indicators.**
3. Structured `ticket_price` — same
4. Missing images (~40% of attractions) — fall back to destination hero image

### Open questions
1. Switch to Wikimedia Commons for image stability (Unsplash occasionally rotates photo IDs)
2. Add `photo_credit?: string` now, even empty, so schema is ready

### Self-learning
- Interface extension + static helpers (unchanged existing fields) was the right ceremony for UI-only additions
- Using a background sub-agent for the 14-attraction backfill saved ~40 min of manual copy-paste
- `CATEGORY_THEME` with CSS-vars + hex fallback supports dark/light/print without duplication

# Stage 3c — Local Customs + Fish Shops + Jewish POIs

תאריך: 2026-04-17 14:58
סוכן: destinations-expert

## סיכום (עברית)

נוסף ב-Stage 3c תמיכה בשלושה מקורות מידע חדשים לדף היעד, עם דגש על מינימום עלויות API ושילוב עם מטמון קיים (`destinations_cache`):

1. **מסלול API חדש** `app/api/destinations/customs/route.ts` — משתמש ב-Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) עם prompt caching על מערכת ההודעות. מחזיר JSON במבנה `LocalCustoms` (overview, special_holidays, etiquette, tipping, dress_code, languages, what_closes_on_holidays). מטמון של 30 יום דרך עמודת `destinations_cache.local_customs` (שדה JSONB ממיגרציה 007). שימוש חוזר ב-`weather_cached_at` כשדה טיימסטמפ. ללא `ANTHROPIC_API_KEY` → מחזיר fallback סטטי ללא זריקת שגיאה.
2. **כרטיס "🌍 מנהגי המקום"** בדף היעד — מוצג רק בטיולים בינלאומיים (`location_type !== 'domestic'`), בין רצועת מזג האוויר ל-Quick Info. כולל skeleton loading, רשימת חגים מודגשים (גבול זהב כאשר `affects_trip=true`), טיפים תרבותיים, התראות סגירה, ו-quick facts row (תשר · לבוש · שפות).
3. **קטע "🐟 דגים טריים"** — תמיד מוצג (domestic + international), מייצר לינקים ל-Google Maps ו-Waze. עבור טיולים בינלאומיים מוסיף `+kosher` לחיפוש.
4. **רשת "🔍 חיפוש שירותים יהודיים" (2x2)** — בתי כנסת / מקוואות / קצביות כשרות / מאפיות כשרות, כל אחת כלינק חיפוש Google Maps. מוצג רק בטיולים בינלאומיים.

אין תלויות חדשות ב-npm. `@anthropic-ai/sdk@0.90.0` כבר מותקן. `tsc --noEmit` עבר נקי.

## Summary (English)

Stage 3c delivers three new content sources on the destination page, minimizing API spend via prompt caching + the existing `destinations_cache` JSONB column:

### Part A — Customs API route
**File:** `app/api/destinations/customs/route.ts` (new)
- `POST { destination, startDate, endDate, countryCode? }`
- Cache lookup by `country_code` with 30-day TTL (`weather_cached_at` reused as timestamp).
- Calls `claude-haiku-4-5-20251001` with ephemeral `cache_control` on system prompt.
- Parses first `{...}` JSON block; graceful fallback on any error.
- Upserts `{ country_code, local_customs, weather_cached_at }` (matches UNIQUE constraint from migration 008).
- **No API key → returns static fallback** (`overview: "מידע תרבותי יתווסף בקרוב"`) without throwing.

### Part B — Customs card
**File:** `app/trip/[id]/destination-overview.tsx`
- New `LocalCustoms` interface added alongside `AttractionFilter`.
- `customs` + `customsLoading` state; `useEffect` fires on mount for international trips.
- `CustomsCard` sub-component renders:
  - Overview paragraph
  - Holiday cards — gold border if `affects_trip=true`, ⚠️ emoji
  - Etiquette bullet list with ✦ marker
  - Amber-highlighted "what closes" banner
  - Quick-facts pill row (tipping · dress · languages)
- Skeleton loading state with pulse animation.
- Hidden when `isDomestic`.

### Part C — Fish markets card
- `FishMarketsCard` sub-component, shown in a new "🐟 דגים טריים" section (both domestic and international).
- Two link buttons: Google Maps search + Waze. International trips append `+kosher` to the Maps query.
- No API calls.

### Part D — Jewish services 2x2 grid
- `JewishServicesGrid` sub-component under new "🔍 חיפוש שירותים יהודיים" section (international only, placed after Chabad Houses).
- Four cards: 🕍 synagogue / 🛁 mikvah / 🥩 kosher butcher / 🍞 kosher bakery → each opens a Google Maps search.

## Files Touched
- **New:** `app/api/destinations/customs/route.ts`
- **Modified:** `app/trip/[id]/destination-overview.tsx` (imports, state, effect, card placements, 3 new sub-components)

## Verification
- `npx tsc --noEmit` → clean (no output).
- No new npm dependencies.
- Uses existing `@anthropic-ai/sdk` (0.90.0) and `@/lib/supabase/server` helpers.
- Columns touched exist since migration 007; upsert relies on UNIQUE constraint from migration 008.

## Notes / Future work
- `destinations_cache` typing isn't in `lib/supabase/types.ts` — route uses untyped queries wrapped in try/catch; safe but could be typed after a types regen.
- Claude Haiku 4.5 chosen for cost; if the JSON response occasionally drifts from schema, consider adding a Zod validator.
- All user-facing Hebrew strings are RTL-safe; Google/Waze query strings use `destinationQuery` which is already `encodeURIComponent`-ed upstream.

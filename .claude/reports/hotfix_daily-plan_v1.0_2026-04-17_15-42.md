# Hotfix v1.0 — Daily Plan section in destination-overview

**Date:** 2026-04-17 15:42
**Agent:** ui-designer + destinations-expert
**Scope:** Add "📅 תוכנית יומית" visible section showing booked attractions per trip day, with realtime sync and inline deletion.

---

## 🇮🇱 סיכום (עברית)

### הבעיה
משתמשים שלחצו על "שריין ליום" ב-`destination-overview.tsx` ראו טוסט "נוסף" אבל לא הייתה שום תצוגה שמציגה את הרזרבציות בחזרה. הנתונים נשמרו ב-`trip_days.bookings` (JSONB) אבל לא הוצגו בשום מקום.

### הפתרון
הוספת קומפוננטה חדשה `DailyPlan` ב-`destination-overview.tsx` (מתחת ל-WeatherStrip, מעל ל-CustomsCard). לכל יום עם הזמנות מציגה:
- כותרת: תאריך בעברית + hebrew_date + badge של day_type (אלא אם "חול")
- רשימת אטרקציות משוריינות (שם + שעה אופציונלית)
- כפתור מחיקה (X) לכל הזמנה עם עדכון אופטימי + rollback במקרה שגיאה
- Placeholder עדין כשאין שום הזמנה

### Realtime
משתמש ב-`useRealtimeTable<TripDayWithBookings>` על טבלת `trip_days` עם פילטר `trip_id=eq.<id>`. כאשר עדכון מתבצע מקומפוננטה אחרת (כגון `AttractionCard.addBooking`), ה-state מתעדכן לייב ללא צורך ב-router.refresh.

### סטטוס
- ✅ `tsc --noEmit` עובר נקי
- ✅ ~115 שורות קוד חדשות (מתחת למגבלה של 150)
- ✅ אין חבילות npm חדשות
- ✅ שימוש ב-design tokens קיימים (`var(--gold-200)`, `glass`, `glass-hover`, RTL)

---

## 🇺🇸 Summary (English)

### Problem
Users clicking "שריין ליום" saw a success toast but there was no UI anywhere displaying the saved bookings. Data persisted in `trip_days.bookings` JSONB but was invisible.

### Solution
Added `DailyPlan` component in `destination-overview.tsx`, placed after the weather strip and before CustomsCard. Features:

1. **Per-day card**: Gregorian date (he-IL), hebrew_date, day_type badge (suppressed for "chol")
2. **Booking list**: Each row shows `attraction_name` + optional `time` + delete button
3. **Delete flow**: Optimistic local removal → `supabase.update({ bookings })` → toast; rollback on error
4. **Empty state**: Subtle hint when no day has bookings
5. **Realtime sync**: `useRealtimeTable` subscribes to `trip_days` (trip_id filter) so external changes (from `AttractionCard.addBooking` or other clients) update the list live
6. **Hidden days**: Days with zero bookings are skipped; days sorted by date ascending

### Data shape handled
```ts
interface DayBooking {
  attraction_id: string;
  attraction_name: string;
  time: string | null;
  created_at: string;
}
```
Matches what `AttractionCard.addBooking` writes at line 936-944.

### Design tokens used
- `glass` + `glass-hover` (glassmorphism container)
- `var(--gold-500)` / `var(--gold-200)` (accent)
- `motion.div` from framer-motion (consistency with rest of file)
- `Badge` (shadcn, already imported)
- `X` icon from lucide-react (added to imports)

### Changes summary
| File | Change |
|---|---|
| `app/trip/[id]/destination-overview.tsx` | +imports (`X`, `useRealtimeTable`); +types (`DayBooking`, `TripDayWithBookings`, `DAY_TYPE_LABELS`); +`<DailyPlan>` render slot; +`DailyPlan` component (~110 lines) |

### Verification
- `npx tsc --noEmit` → clean (zero errors)
- No new npm packages
- DayType union matched against real schema (`chol | shabbat | erev_chag | chag | chol_hamoed | shabbat_chol_hamoed`)

### Known follow-ups (out of scope)
- `AttractionCard.addBooking` could be refactored to trigger an optimistic local update (currently relies on realtime roundtrip for visibility)
- Time-slot editing (click a booking to set a time) — not requested
- Drag-to-reorder bookings within a day — not requested

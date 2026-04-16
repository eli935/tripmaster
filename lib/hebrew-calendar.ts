import {
  HDate,
  HebrewCalendar,
  Event as HebcalEvent,
  Location,
  flags,
} from "@hebcal/core";
import type { DayType, MealType } from "./supabase/types";

/**
 * Get the Hebrew date string for a given Gregorian date
 */
export function getHebrewDate(date: Date): string {
  const hd = new HDate(date);
  return hd.renderGematriya();
}

/**
 * Determine the halachic day type for a given date and location.
 * Considers: Chag, Erev Chag, Shabbat, Chol HaMoed, regular weekday.
 * Uses IL=false for diaspora (yom tov sheni).
 */
export function getDayType(date: Date, isIsrael = false): DayType {
  const hd = new HDate(date);
  const dow = date.getDay(); // 0=Sunday, 6=Saturday

  // Get events for this date
  const events = HebrewCalendar.getHolidaysOnDate(hd, isIsrael) || [];

  const eventFlags = events.reduce((acc, ev) => acc | ev.getFlags(), 0);

  const isChag = (eventFlags & flags.CHAG) !== 0;
  const isCholHaMoed = (eventFlags & flags.CHOL_HAMOED) !== 0;
  const isErevChag = events.some(
    (ev) => ev.getDesc().startsWith("Erev") && (ev.getFlags() & flags.EREV) !== 0
  );
  const isShabbat = dow === 6;

  if (isChag && isShabbat) return "chag"; // Shabbat + Chag = Chag rules
  if (isChag) return "chag";
  if (isShabbat && isCholHaMoed) return "shabbat_chol_hamoed";
  if (isShabbat) return "shabbat";
  if (isErevChag) return "erev_chag";
  if (dow === 5) return "erev_chag"; // Friday = Erev Shabbat
  if (isCholHaMoed) return "chol_hamoed";
  return "chol";
}

/**
 * Get the holiday name for a date (if any)
 */
export function getHolidayName(date: Date, isIsrael = false): string | null {
  const hd = new HDate(date);
  const events = HebrewCalendar.getHolidaysOnDate(hd, isIsrael) || [];

  for (const ev of events) {
    const f = ev.getFlags();
    if (f & (flags.CHAG | flags.CHOL_HAMOED | flags.EREV)) {
      return ev.renderBrief("he");
    }
  }
  return null;
}

/**
 * Get the default meal types for a given day type
 */
export function getDefaultMeals(dayType: DayType): { type: MealType; name: string }[] {
  switch (dayType) {
    case "erev_chag":
      return [
        { type: "breakfast", name: "ארוחת בוקר" },
        { type: "lunch", name: "ארוחת צהריים" },
        { type: "seuda_1", name: "סעודת ליל חג/שבת" },
      ];
    case "chag":
    case "shabbat":
    case "shabbat_chol_hamoed":
      return [
        { type: "seuda_2", name: "סעודה שנייה (בוקר)" },
        { type: "seuda_3", name: "סעודה שלישית" },
      ];
    case "chol_hamoed":
      return [
        { type: "breakfast", name: "ארוחת בוקר" },
        { type: "lunch", name: "ארוחת צהריים" },
        { type: "dinner", name: "ארוחת ערב" },
      ];
    case "chol":
    default:
      return [
        { type: "breakfast", name: "ארוחת בוקר" },
        { type: "lunch", name: "ארוחת צהריים" },
        { type: "dinner", name: "ארוחת ערב" },
      ];
  }
}

/**
 * Generate all days between start and end date with Hebrew calendar info
 */
export function generateTripDays(
  startDate: Date,
  endDate: Date,
  isIsrael = false
): {
  date: string;
  hebrew_date: string;
  day_type: DayType;
  holiday_name: string | null;
  default_meals: { type: MealType; name: string }[];
}[] {
  const days = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayType = getDayType(current, isIsrael);
    days.push({
      date: current.toISOString().split("T")[0],
      hebrew_date: getHebrewDate(current),
      day_type: dayType,
      holiday_name: getHolidayName(current, isIsrael),
      default_meals: getDefaultMeals(dayType),
    });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Day type display names in Hebrew
 */
export const DAY_TYPE_LABELS: Record<DayType, string> = {
  erev_chag: "ערב חג/שבת",
  chag: "חג",
  shabbat: "שבת",
  shabbat_chol_hamoed: "שבת חול המועד",
  chol_hamoed: "חול המועד",
  chol: "חול",
};

/**
 * Day type color classes for UI
 */
export const DAY_TYPE_COLORS: Record<DayType, string> = {
  erev_chag: "bg-amber-100 text-amber-800 border-amber-300",
  chag: "bg-purple-100 text-purple-800 border-purple-300",
  shabbat: "bg-blue-100 text-blue-800 border-blue-300",
  shabbat_chol_hamoed: "bg-indigo-100 text-indigo-800 border-indigo-300",
  chol_hamoed: "bg-green-100 text-green-800 border-green-300",
  chol: "bg-gray-100 text-gray-800 border-gray-300",
};

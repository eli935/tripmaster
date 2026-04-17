/**
 * Single source of truth for Hebrew UI labels.
 * v8.7 — Jerusalem Gold design system.
 *
 * Rule: NO English DB key must ever reach the Hebrew UI.
 * If a key is missing from a dict, the helper returns a safe Hebrew fallback
 * ("אחר" / "—") — never the raw key.
 */

import type {
  ExpenseCategory,
  SplitType,
  MealType,
  EquipmentStatus,
  FoodCategory,
} from "./supabase/types";

export type LessonCategory =
  | "equipment"
  | "food"
  | "logistics"
  | "accommodation"
  | "general";

export type LessonAction =
  | "add"
  | "remove"
  | "increase"
  | "decrease"
  | "note";

// ──────────────────────────────────────────────
// Expense categories
// ──────────────────────────────────────────────
export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  flights: "טיסות ✈️",
  accommodation: "דירה/מלון 🏨",
  car: "רכב 🚗",
  food: "אוכל 🍽️",
  equipment: "ציוד 🎒",
  attractions: "אטרקציות 🎡",
  other: "אחר 📦",
};

// Labels without emoji (for summary lists)
export const EXPENSE_CATEGORIES_PLAIN: Record<ExpenseCategory, string> = {
  flights: "טיסות",
  accommodation: "דירה/מלון",
  car: "רכב",
  food: "אוכל",
  equipment: "ציוד",
  attractions: "אטרקציות",
  other: "אחר",
};

// ──────────────────────────────────────────────
// Split types
// ──────────────────────────────────────────────
export const SPLIT_TYPES: Record<SplitType, string> = {
  per_person: "👥 לפי נפשות",
  equal: "⚖️ שווה בין משפחות",
  custom: "🎯 חלוקה מותאמת",
  private: "🔒 פרטי (לא לחלוקה)",
};

// ──────────────────────────────────────────────
// Meal types
// ──────────────────────────────────────────────
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  seuda_1: "סעודה ראשונה",
  seuda_2: "סעודה שנייה",
  seuda_3: "סעודה שלישית",
};

// ──────────────────────────────────────────────
// Equipment statuses
// ──────────────────────────────────────────────
export const EQUIPMENT_STATUSES: Record<EquipmentStatus, string> = {
  pending: "ממתין",
  packed: "נארז",
  loaded: "נטען",
  arrived: "הגיע",
};

// Day types: re-exported from hebrew-calendar.ts (canonical source)
export { DAY_TYPE_LABELS, DAY_TYPE_COLORS } from "./hebrew-calendar";

// ──────────────────────────────────────────────
// Food categories (meal ingredients + shopping)
// ──────────────────────────────────────────────
export const FOOD_CATEGORIES: Record<FoodCategory, { label: string; emoji: string }> = {
  meat: { label: "בשר", emoji: "🥩" },
  dairy: { label: "חלבי", emoji: "🧀" },
  vegetables: { label: "ירקות", emoji: "🥬" },
  dry: { label: "יבש", emoji: "🌾" },
  frozen: { label: "קפוא", emoji: "🧊" },
  parve: { label: "פרווה", emoji: "🫒" },
  other: { label: "אחר", emoji: "📦" },
};

// ──────────────────────────────────────────────
// Lesson-learned categories & actions
// ──────────────────────────────────────────────
export const LESSON_CATEGORIES: Record<LessonCategory, { label: string; emoji: string }> = {
  equipment: { label: "ציוד", emoji: "🎒" },
  food: { label: "אוכל", emoji: "🍽️" },
  logistics: { label: "לוגיסטיקה", emoji: "🚗" },
  accommodation: { label: "דירה/מלון", emoji: "🏠" },
  general: { label: "כללי", emoji: "💡" },
};

export const LESSON_ACTIONS: Record<LessonAction, string> = {
  add: "להוסיף",
  remove: "להוריד",
  increase: "להגדיל כמות",
  decrease: "להקטין כמות",
  note: "הערה",
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Safe lookup — never returns the raw English key.
 * If the key is missing/unknown, returns the Hebrew fallback.
 */
export function hebrewLabel<T extends string>(
  dict: Record<T, string>,
  key: T | string | null | undefined,
  fallback = "אחר"
): string {
  if (!key) return fallback;
  return (dict as Record<string, string>)[key] ?? fallback;
}

/**
 * The canonical "name unknown" placeholder.
 * Replaces legacy "???" which looked like a bug to users.
 */
export const UNKNOWN_NAME = "—";

// ──────────────────────────────────────────────
// Currency codes
// ──────────────────────────────────────────────
export const CURRENCY_LABELS: Record<string, string> = {
  ILS: "₪ שקל",
  EUR: "€ יורו",
  USD: "$ דולר",
  GBP: "£ ליש״ט",
};

// ──────────────────────────────────────────────
// Holiday types
// ──────────────────────────────────────────────
export const HOLIDAY_LABELS: Record<string, string> = {
  regular: "טיול רגיל",
  pesach: "פסח",
  sukkot: "סוכות",
  rosh_hashana: "ראש השנה",
  shavuot: "שבועות",
};

// ──────────────────────────────────────────────
// File categories (for FileManager)
// ──────────────────────────────────────────────
// Note: FILE_CATEGORIES already exists in lib/file-upload.ts with richer shape.
// We re-export a simplified label map here for Select display convenience.

// ──────────────────────────────────────────────
// Role labels
// ──────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל",
  member: "משתתף",
  owner: "יוצר",
};

import type { MealItem, FoodCategory, Meal } from "./supabase/types";

export interface AggregatedItem {
  ingredient: string;
  total_quantity: number;
  unit: string;
  category: FoodCategory;
  meal_count: number;
}

/**
 * Aggregate meal items into a consolidated shopping list.
 * Groups by ingredient name + unit. If a meals map is supplied,
 * per-meal attendee counts override `totalPeople` (meals.attendees_count || totalPeople).
 * Otherwise every item is multiplied by `totalPeople`.
 * Also tracks how many meals contribute to each line.
 */
export function generateShoppingList(
  mealItems: MealItem[],
  totalPeople: number,
  meals?: Meal[]
): AggregatedItem[] {
  const map = new Map<string, AggregatedItem & { _meals: Set<string> }>();

  const mealsById = new Map<string, Meal>();
  if (meals) {
    for (const m of meals) mealsById.set(m.id, m);
  }

  for (const item of mealItems) {
    const meal = mealsById.get(item.meal_id);
    const attendees =
      meal && meal.attendees_count && meal.attendees_count > 0
        ? meal.attendees_count
        : totalPeople;

    const key = `${item.ingredient.trim().toLowerCase()}|${item.unit}`;
    const existing = map.get(key);

    if (existing) {
      existing.total_quantity += item.quantity * attendees;
      existing._meals.add(item.meal_id);
      existing.meal_count = existing._meals.size;
    } else {
      const mealsSet = new Set<string>([item.meal_id]);
      map.set(key, {
        ingredient: item.ingredient.trim(),
        total_quantity: item.quantity * attendees,
        unit: item.unit,
        category: item.category as FoodCategory,
        meal_count: 1,
        _meals: mealsSet,
      });
    }
  }

  // Sort by category then by name
  const categoryOrder: FoodCategory[] = ["meat", "dairy", "vegetables", "frozen", "dry", "parve", "other"];

  return Array.from(map.values())
    .map(({ _meals, ...rest }) => rest)
    .sort((a, b) => {
      const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return a.ingredient.localeCompare(b.ingredient, "he");
    });
}

/**
 * Rounds up fractional shopping quantities when the unit is countable (יח׳ / יחידות).
 * Returns both the raw (rounded to 0.1) and the displayed (possibly bumped up) values.
 */
export function formatShoppingQuantity(
  qty: number,
  unit: string
): { raw: number; displayed: number; bumped: boolean } {
  const raw = Math.round(qty * 10) / 10;
  const isCountable = /^(יח׳?|יחידות|יחידה|pcs|unit|units)$/i.test(unit.trim());
  if (isCountable && raw % 1 !== 0) {
    const ceil = Math.ceil(raw);
    return { raw, displayed: ceil, bumped: true };
  }
  return { raw, displayed: raw, bumped: false };
}

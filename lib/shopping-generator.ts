import type { MealItem, FoodCategory } from "./supabase/types";

interface AggregatedItem {
  ingredient: string;
  total_quantity: number;
  unit: string;
  category: FoodCategory;
}

/**
 * Aggregate meal items into a consolidated shopping list.
 * Groups by ingredient name + unit, sums quantities × totalPeople.
 */
export function generateShoppingList(
  mealItems: MealItem[],
  totalPeople: number
): AggregatedItem[] {
  const map = new Map<string, AggregatedItem>();

  for (const item of mealItems) {
    const key = `${item.ingredient.trim().toLowerCase()}|${item.unit}`;
    const existing = map.get(key);

    if (existing) {
      existing.total_quantity += item.quantity * totalPeople;
    } else {
      map.set(key, {
        ingredient: item.ingredient.trim(),
        total_quantity: item.quantity * totalPeople,
        unit: item.unit,
        category: item.category as FoodCategory,
      });
    }
  }

  // Sort by category then by name
  const categoryOrder: FoodCategory[] = ["meat", "dairy", "vegetables", "frozen", "dry", "parve", "other"];

  return Array.from(map.values()).sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.ingredient.localeCompare(b.ingredient, "he");
  });
}

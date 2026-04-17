"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, ShoppingBasket, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Meal, MealItem, FoodCategory } from "@/lib/supabase/types";

const CATEGORY_LABELS: Record<FoodCategory, string> = {
  meat: "בשר",
  dairy: "חלבי",
  vegetables: "ירקות ופירות",
  dry: "יבשים",
  frozen: "קפואים",
  parve: "פרווה",
  other: "אחר",
};

const CATEGORY_EMOJI: Record<FoodCategory, string> = {
  meat: "🥩",
  dairy: "🧀",
  vegetables: "🥬",
  dry: "🫘",
  frozen: "🧊",
  parve: "🥚",
  other: "📦",
};

interface MealIngredientsProps {
  meal: Meal;
  items: MealItem[];
  onClose: () => void;
  totalPeople: number;
}

export function MealIngredients({ meal, items, onClose, totalPeople }: MealIngredientsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const [ingredient, setIngredient] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("יח׳");
  const [category, setCategory] = useState<FoodCategory>("other");

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from("meal_items").insert({
      meal_id: meal.id,
      ingredient,
      quantity: parseFloat(quantity),
      unit,
      category,
    });
    setIngredient("");
    setQuantity("1");
    setLoading(false);
    setAdding(false);
    router.refresh();
    toast.success("מרכיב נוסף!");
  }

  async function removeItem(itemId: string) {
    await supabase.from("meal_items").delete().eq("id", itemId);
    router.refresh();
  }

  async function addQuickItems() {
    // Quick-add common items based on meal type
    const quickItems = getQuickItems(meal.meal_type);
    if (quickItems.length === 0) return;

    await supabase.from("meal_items").insert(
      quickItems.map((item) => ({
        meal_id: meal.id,
        ...item,
      }))
    );
    router.refresh();
    toast.success(`נוספו ${quickItems.length} מרכיבים בסיסיים`);
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBasket className="h-5 w-5" />
            {meal.name} — מרכיבים
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Quick add */}
          {items.length === 0 && (
            <Button variant="outline" size="sm" className="w-full" onClick={addQuickItems}>
              <Sparkles className="ml-1 h-4 w-4" />
              הוסף מרכיבים בסיסיים
            </Button>
          )}

          {/* Items list */}
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 bg-secondary rounded-md">
              <div className="flex items-center gap-2">
                <span>{CATEGORY_EMOJI[item.category as FoodCategory] || "📦"}</span>
                <div>
                  <div className="text-sm font-medium">{item.ingredient}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.quantity} {item.unit} · ×{totalPeople} = {(item.quantity * totalPeople).toFixed(1)} {item.unit}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {items.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-4">
              אין מרכיבים. הוסף מרכיבים כדי ליצור רשימת קניות.
            </p>
          )}

          {/* Add form */}
          {adding ? (
            <form onSubmit={addItem} className="border rounded-md p-3 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">מרכיב</Label>
                <Input
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  placeholder="למשל: חזה עוף"
                  className="h-8 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">כמות (לנפש)</Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-8 text-sm"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">יחידה</Label>
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">קטגוריה</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as FoodCategory)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue>
                        {(v: unknown) => {
                          const k = v as FoodCategory;
                          const label = CATEGORY_LABELS[k] ?? "אחר";
                          const emoji = CATEGORY_EMOJI[k] ?? "📦";
                          return `${emoji} ${label}`;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {CATEGORY_EMOJI[key as FoodCategory]} {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="submit" className="flex-1" disabled={loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "הוסף"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="ml-1 h-4 w-4" />
              הוסף מרכיב
            </Button>
          )}

          {/* Summary */}
          {items.length > 0 && (
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground text-center">
                {items.length} מרכיבים · כמויות מוכפלות ב-{totalPeople} נפשות
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getQuickItems(mealType: string): Omit<MealItem, "id" | "meal_id">[] {
  switch (mealType) {
    case "seuda_1":
    case "seuda_2":
      return [
        { ingredient: "חלות", quantity: 0.5, unit: "יח׳", category: "dry" },
        { ingredient: "יין", quantity: 0.2, unit: "בקבוק", category: "other" },
        { ingredient: "סלטים מעורבים", quantity: 0.15, unit: "ק\"ג", category: "vegetables" },
        { ingredient: "בשר/עוף (מנה עיקרית)", quantity: 0.25, unit: "ק\"ג", category: "meat" },
        { ingredient: "תוספת (אורז/פסטה/תפו\"א)", quantity: 0.15, unit: "ק\"ג", category: "dry" },
      ];
    case "seuda_3":
      return [
        { ingredient: "חלה", quantity: 0.3, unit: "יח׳", category: "dry" },
        { ingredient: "ממרחים", quantity: 0.1, unit: "ק\"ג", category: "parve" },
        { ingredient: "סלט", quantity: 0.1, unit: "ק\"ג", category: "vegetables" },
      ];
    case "breakfast":
      return [
        { ingredient: "לחם", quantity: 0.3, unit: "יח׳", category: "dry" },
        { ingredient: "ביצים", quantity: 1.5, unit: "יח׳", category: "parve" },
        { ingredient: "גבינה/חלב", quantity: 0.1, unit: "ק\"ג", category: "dairy" },
        { ingredient: "ירקות (עגבניה/מלפפון)", quantity: 0.1, unit: "ק\"ג", category: "vegetables" },
      ];
    case "lunch":
      return [
        { ingredient: "מנה עיקרית", quantity: 0.25, unit: "ק\"ג", category: "meat" },
        { ingredient: "תוספת", quantity: 0.15, unit: "ק\"ג", category: "dry" },
        { ingredient: "סלט", quantity: 0.1, unit: "ק\"ג", category: "vegetables" },
      ];
    case "dinner":
      return [
        { ingredient: "מנה עיקרית", quantity: 0.2, unit: "ק\"ג", category: "meat" },
        { ingredient: "תוספת", quantity: 0.1, unit: "ק\"ג", category: "dry" },
      ];
    default:
      return [];
  }
}

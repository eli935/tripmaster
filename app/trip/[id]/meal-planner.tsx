"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChefHat,
  Plus,
  Utensils,
  Coffee,
  Moon,
  Sun,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { TripDay, Meal, MealItem, DayType, MealType } from "@/lib/supabase/types";
import { MealIngredients } from "./meal-ingredients";
import { ZmanimCard } from "./zmanim-card";
import { DAY_TYPE_LABELS, DAY_TYPE_COLORS, getDefaultMeals } from "@/lib/hebrew-calendar";
import { MEAL_LABELS } from "@/lib/i18n-labels";

const MEAL_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="h-3 w-3" />,
  lunch: <Sun className="h-3 w-3" />,
  dinner: <Moon className="h-3 w-3" />,
  seuda_1: <Utensils className="h-3 w-3" />,
  seuda_2: <Utensils className="h-3 w-3" />,
  seuda_3: <Utensils className="h-3 w-3" />,
};

// MEAL_LABELS imported from @/lib/i18n-labels

interface MealPlannerProps {
  days: TripDay[];
  meals: Meal[];
  mealItems: MealItem[];
  tripId: string;
  totalPeople: number;
  zmanimMap?: Record<string, any>;
}

export function MealPlanner({ days, meals, mealItems, tripId, totalPeople, zmanimMap }: MealPlannerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [expandedDay, setExpandedDay] = useState<string | null>(days[0]?.id || null);
  const [addingMeal, setAddingMeal] = useState<string | null>(null);
  const [mealName, setMealName] = useState("");
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [mealDesc, setMealDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [recipeLoading, setRecipeLoading] = useState<string | null>(null);
  const [recipePreview, setRecipePreview] = useState<{
    meal: Meal;
    recipe: {
      id: string;
      name: string;
      description: string | null;
      instructions: string | null;
      ingredients: Array<{ name: string; quantity_per_person: number; unit: string }>;
    };
  } | null>(null);
  const [approving, setApproving] = useState(false);

  // Group meal items by meal
  const itemsByMeal: Record<string, MealItem[]> = {};
  mealItems.forEach((item) => {
    if (!itemsByMeal[item.meal_id]) itemsByMeal[item.meal_id] = [];
    itemsByMeal[item.meal_id].push(item);
  });

  // Group meals by day
  const mealsByDay: Record<string, Meal[]> = {};
  meals.forEach((m) => {
    if (!mealsByDay[m.trip_day_id]) mealsByDay[m.trip_day_id] = [];
    mealsByDay[m.trip_day_id].push(m);
  });

  async function addMeal(dayId: string) {
    setLoading(true);
    const { error } = await supabase.from("meals").insert({
      trip_day_id: dayId,
      meal_type: mealType,
      name: mealName,
      description: mealDesc || null,
      servings: totalPeople,
    });

    if (error) {
      toast.error("שגיאה בהוספת ארוחה");
    } else {
      toast.success("ארוחה נוספה!");
      setAddingMeal(null);
      setMealName("");
      setMealDesc("");
    }
    setLoading(false);
    router.refresh();
  }

  async function deleteMeal(mealId: string) {
    await supabase.from("meals").delete().eq("id", mealId);
    router.refresh();
    toast.success("ארוחה נמחקה");
  }

  function getEffectiveAttendees(meal: Meal): number {
    const raw = (meal as any).attendees_count;
    if (raw == null || raw === "") return totalPeople;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return totalPeople;
    return n;
  }

  async function updateAttendees(mealId: string, value: string) {
    const n = value === "" ? null : Number(value);
    await supabase
      .from("meals")
      .update({ attendees_count: n && n > 0 ? n : null })
      .eq("id", mealId);
    router.refresh();
  }

  async function generateRecipe(meal: Meal) {
    const description = (meal.description || meal.name || "").trim();
    if (!description) {
      toast.error("אין תיאור לארוחה — הוסף תיאור או שם");
      return;
    }
    setRecipeLoading(meal.id);
    try {
      const res = await fetch("/api/meals/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealDescription: description,
          attendeesCount: getEffectiveAttendees(meal),
          tripId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "שגיאה ביצירת מתכון");
        return;
      }
      setRecipePreview({ meal, recipe: data.recipe });
    } catch (e) {
      toast.error("שגיאה ברשת");
    } finally {
      setRecipeLoading(null);
    }
  }

  async function approveRecipe() {
    if (!recipePreview) return;
    const { meal, recipe } = recipePreview;
    setApproving(true);
    try {
      const attendees = getEffectiveAttendees(meal);
      // 1) Link recipe to the meal
      await supabase
        .from("meals")
        .update({ recipe_id: recipe.id })
        .eq("id", meal.id);

      // 2) Delete existing meal_items for this meal, then insert recipe ingredients
      await supabase.from("meal_items").delete().eq("meal_id", meal.id);

      const toInsert = (recipe.ingredients || []).map((ing) => ({
        meal_id: meal.id,
        ingredient: ing.name,
        quantity: Number(ing.quantity_per_person) || 0,
        unit: ing.unit || "יח׳",
        category: "other" as const,
      }));
      if (toInsert.length > 0) {
        await supabase.from("meal_items").insert(toInsert);
      }

      toast.success(`המתכון "${recipe.name}" נוסף לארוחה ולקניות (${attendees} סועדים)`);
      setRecipePreview(null);
      router.refresh();
    } catch (e) {
      toast.error("שגיאה בשמירת המתכון");
    } finally {
      setApproving(false);
    }
  }

  async function generateAllMeals() {
    setGeneratingAll(true);

    const mealsToInsert: any[] = [];
    for (const day of days) {
      const existing = mealsByDay[day.id] || [];
      if (existing.length > 0) continue; // Skip days with meals

      const defaults = getDefaultMeals(day.day_type);
      for (const meal of defaults) {
        mealsToInsert.push({
          trip_day_id: day.id,
          meal_type: meal.type,
          name: meal.name,
          servings: totalPeople,
        });
      }
    }

    if (mealsToInsert.length === 0) {
      toast("כל הימים כבר מכילים ארוחות");
      setGeneratingAll(false);
      return;
    }

    const { error } = await supabase.from("meals").insert(mealsToInsert);

    if (error) {
      toast.error("שגיאה ביצירת ארוחות");
    } else {
      toast.success(`נוצרו ${mealsToInsert.length} ארוחות!`);
    }
    setGeneratingAll(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Generate All Button */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          תכנון ארוחות
        </h2>
        <Button size="sm" variant="outline" onClick={generateAllMeals} disabled={generatingAll}>
          {generatingAll ? (
            <Loader2 className="ml-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="ml-1 h-4 w-4" />
          )}
          צור ארוחות אוטומטי
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        * הארוחות נוצרות לפי סוג היום (חג/שבת/חוה"מ/חול). ניתן להוסיף ולערוך ידנית.
      </p>

      {/* Days */}
      {days.map((day) => {
        const dayMeals = mealsByDay[day.id] || [];
        const isExpanded = expandedDay === day.id;

        return (
          <Card key={day.id} className="overflow-hidden">
            {/* Day Header */}
            <div
              className={`px-4 py-3 flex items-center justify-between cursor-pointer ${DAY_TYPE_COLORS[day.day_type]}`}
              onClick={() => setExpandedDay(isExpanded ? null : day.id)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <div>
                  <div className="font-medium text-sm">
                    {new Date(day.date).toLocaleDateString("he-IL", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {" — "}
                    <span className="text-xs">{day.hebrew_date}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={DAY_TYPE_COLORS[day.day_type]}>
                  {DAY_TYPE_LABELS[day.day_type]}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {dayMeals.length} ארוחות
                </Badge>
              </div>
            </div>

            {/* Day Content */}
            {isExpanded && (
              <CardContent className="pt-3 space-y-2">
                {/* Halachic times (zmanim) */}
                {zmanimMap?.[day.date] && (
                  <ZmanimCard zmanim={zmanimMap[day.date]} dayType={day.day_type} />
                )}
                {dayMeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    אין ארוחות מתוכננות ליום זה
                  </p>
                ) : (
                  dayMeals.map((meal) => {
                    const mealItemCount = (itemsByMeal[meal.id] || []).length;
                    const effAttendees = getEffectiveAttendees(meal);
                    const hasOverride = (meal as any).attendees_count != null;
                    const hasDesc = !!(meal.description && meal.description.trim());
                    const isGenerating = recipeLoading === meal.id;
                    return (
                    <div
                      key={meal.id}
                      className="p-2 bg-secondary rounded-md hover:bg-accent transition-colors"
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setEditingMeal(meal)}
                      >
                        <div className="flex items-center gap-2">
                          {MEAL_ICONS[meal.meal_type] || <Utensils className="h-3 w-3" />}
                          <div>
                            <div className="text-sm font-medium flex items-center gap-2">
                              {meal.name}
                              {(meal as any).recipe_id && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1">
                                  <Sparkles className="h-2.5 w-2.5 ml-0.5" />
                                  מתכון
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {mealItemCount > 0 ? `${mealItemCount} מרכיבים` : "לחץ להוספת מרכיבים"}
                              {meal.description && ` · ${meal.description}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {meal.servings} מנות
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-400"
                            onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div
                        className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <Input
                            type="number"
                            min="1"
                            value={(meal as any).attendees_count ?? ""}
                            placeholder={String(totalPeople)}
                            onChange={(e) => updateAttendees(meal.id, e.target.value)}
                            className="h-6 w-14 text-xs"
                            dir="ltr"
                          />
                          {hasOverride && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {effAttendees} מתוך {totalPeople} אוכלים
                            </Badge>
                          )}
                        </div>
                        {hasDesc && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2"
                            disabled={isGenerating}
                            onClick={() => generateRecipe(meal)}
                          >
                            {isGenerating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 ml-1" />
                                הצע מתכון
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );})
                )}

                {/* Add Meal Button */}
                {addingMeal === day.id ? (
                  <div className="border rounded-md p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">סוג</Label>
                        <select
                          value={mealType}
                          onChange={(e) => setMealType(e.target.value as MealType)}
                          className="w-full h-8 text-sm border rounded px-2"
                        >
                          {Object.entries(MEAL_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">שם הארוחה</Label>
                        <Input
                          value={mealName}
                          onChange={(e) => setMealName(e.target.value)}
                          placeholder="למשל: שניצלים"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">תיאור (אופציונלי)</Label>
                      <Input
                        value={mealDesc}
                        onChange={(e) => setMealDesc(e.target.value)}
                        placeholder="פירוט נוסף..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => addMeal(day.id)}
                        disabled={!mealName || loading}
                        className="flex-1"
                      >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "הוסף"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAddingMeal(null)}
                      >
                        ביטול
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setAddingMeal(day.id);
                      setMealName("");
                      setMealDesc("");
                    }}
                  >
                    <Plus className="ml-1 h-3 w-3" />
                    הוסף ארוחה
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {days.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          אין ימים מוגדרים לטיול
        </p>
      )}

      {/* Meal Ingredients Dialog */}
      {editingMeal && (
        <MealIngredients
          meal={editingMeal}
          items={itemsByMeal[editingMeal.id] || []}
          totalPeople={getEffectiveAttendees(editingMeal)}
          onClose={() => setEditingMeal(null)}
        />
      )}

      {/* Recipe Preview Dialog */}
      {recipePreview && (
        <Dialog open={true} onOpenChange={(open) => !open && setRecipePreview(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {recipePreview.recipe.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {recipePreview.recipe.description && (
                <p className="text-sm text-muted-foreground">
                  {recipePreview.recipe.description}
                </p>
              )}

              {recipePreview.recipe.instructions && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">הוראות הכנה</h4>
                  <ol className="list-decimal pr-5 space-y-1 text-sm">
                    {recipePreview.recipe.instructions
                      .split(/\n|\d+\.\s+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                  </ol>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">
                  מרכיבים · {getEffectiveAttendees(recipePreview.meal)} סועדים
                </h4>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="p-2 text-right font-medium">מרכיב</th>
                        <th className="p-2 text-right font-medium">לנפש</th>
                        <th className="p-2 text-right font-medium">סה"כ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recipePreview.recipe.ingredients || []).map((ing, i) => {
                        const attendees = getEffectiveAttendees(recipePreview.meal);
                        const total = Number(ing.quantity_per_person || 0) * attendees;
                        const rounded = Math.round(total * 10) / 10;
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-2">{ing.name}</td>
                            <td className="p-2">
                              {ing.quantity_per_person} {ing.unit}
                            </td>
                            <td className="p-2 font-medium">
                              {rounded} {ing.unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={approveRecipe}
                  disabled={approving}
                >
                  {approving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "אשר והוסף לקניות"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setRecipePreview(null)}
                  disabled={approving}
                >
                  בטל
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

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
} from "lucide-react";
import { toast } from "sonner";
import type { TripDay, Meal, MealItem, DayType, MealType } from "@/lib/supabase/types";
import { MealIngredients } from "./meal-ingredients";
import { ZmanimCard } from "./zmanim-card";
import { DAY_TYPE_LABELS, DAY_TYPE_COLORS, getDefaultMeals } from "@/lib/hebrew-calendar";

const MEAL_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="h-3 w-3" />,
  lunch: <Sun className="h-3 w-3" />,
  dinner: <Moon className="h-3 w-3" />,
  seuda_1: <Utensils className="h-3 w-3" />,
  seuda_2: <Utensils className="h-3 w-3" />,
  seuda_3: <Utensils className="h-3 w-3" />,
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  seuda_1: "סעודה ראשונה",
  seuda_2: "סעודה שנייה",
  seuda_3: "סעודה שלישית",
};

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
                    return (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between p-2 bg-secondary rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setEditingMeal(meal)}
                    >
                      <div className="flex items-center gap-2">
                        {MEAL_ICONS[meal.meal_type] || <Utensils className="h-3 w-3" />}
                        <div>
                          <div className="text-sm font-medium">{meal.name}</div>
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
          totalPeople={totalPeople}
          onClose={() => setEditingMeal(null)}
        />
      )}
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Users,
  CalendarDays,
  Package,
  ShoppingCart,
  Receipt,
  Lightbulb,
  Printer,
} from "lucide-react";
import type {
  Trip,
  TripParticipant,
  TripDay,
  Meal,
  TripEquipment,
  Expense,
  ShoppingItem,
  LessonLearned,
  HolidayType,
} from "@/lib/supabase/types";
import { DAY_TYPE_LABELS } from "@/lib/hebrew-calendar";
import { calculateBalances, minimizeTransfers, formatCurrency } from "@/lib/expense-calculator";

const HOLIDAY_LABELS: Record<HolidayType, string> = {
  pesach: "פסח",
  sukkot: "סוכות",
  rosh_hashana: "ראש השנה",
  shavuot: "שבועות",
  regular: "טיול רגיל",
};

interface TripSummaryProps {
  trip: Trip;
  participants: TripParticipant[];
  days: TripDay[];
  meals: Meal[];
  equipment: TripEquipment[];
  expenses: Expense[];
  shopping: ShoppingItem[];
  lessons: LessonLearned[];
}

export function TripSummary({
  trip,
  participants,
  days,
  meals,
  equipment,
  expenses,
  shopping,
  lessons,
}: TripSummaryProps) {
  const totalPeople = participants.reduce(
    (sum, p) => sum + (p.adults || 0) + (p.children || 0),
    0
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const purchasedItems = shopping.filter((s) => s.is_purchased).length;
  const packedEquipment = equipment.filter((e) => e.status !== "pending").length;

  const profileNames: Record<string, string> = {};
  participants.forEach((p) => {
    profileNames[p.profile_id] = (p.profile as any)?.full_name || "???";
  });
  const balances = calculateBalances(expenses, participants, profileNames);
  const transfers = minimizeTransfers(balances);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          סיכום טיול
        </h2>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="ml-1 h-4 w-4" />
          הדפס
        </Button>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-xl font-bold text-center">{trip.name}</h3>
          <p className="text-center text-muted-foreground">
            {trip.destination} · {HOLIDAY_LABELS[trip.holiday_type as HolidayType]}
          </p>
          <p className="text-center text-sm mt-1">
            {new Date(trip.start_date).toLocaleDateString("he-IL")} — {new Date(trip.end_date).toLocaleDateString("he-IL")}
          </p>
          <Separator className="my-3" />
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-lg font-bold">{participants.length}</div>
              <div className="text-xs text-muted-foreground">משפחות</div>
            </div>
            <div>
              <div className="text-lg font-bold">{totalPeople}</div>
              <div className="text-xs text-muted-foreground">נפשות</div>
            </div>
            <div>
              <div className="text-lg font-bold">{days.length}</div>
              <div className="text-xs text-muted-foreground">ימים</div>
            </div>
            <div>
              <div className="text-lg font-bold">{formatCurrency(totalExpenses)}</div>
              <div className="text-xs text-muted-foreground">הוצאות</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> משתתפים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {participants.map((p) => (
              <div key={p.id} className="text-sm">
                <span className="font-medium">{(p.profile as any)?.full_name}</span>
                <span className="text-muted-foreground"> ({p.adults}+{p.children})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> לוח ימים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {days.map((day) => {
              const dayMeals = meals.filter((m) => m.trip_day_id === day.id);
              return (
                <div key={day.id} className="flex items-center justify-between text-sm py-1">
                  <div>
                    <span className="font-medium">
                      {new Date(day.date).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <span className="text-muted-foreground text-xs mr-1">({day.hebrew_date})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {DAY_TYPE_LABELS[day.day_type]}
                    </Badge>
                    {dayMeals.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayMeals.length} ארוחות
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Equipment Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> ציוד ({packedEquipment}/{equipment.length} ארוזים)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-1">
            {equipment.map((item) => (
              <div key={item.id} className="flex items-center gap-1 text-sm">
                <span>{item.status === "arrived" ? "✅" : item.status === "packed" ? "📦" : "⬜"}</span>
                <span>{item.name} ×{item.quantity}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shopping Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> קניות ({purchasedItems}/{shopping.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-1">
            {shopping.map((item) => (
              <div key={item.id} className={`text-sm ${item.is_purchased ? "line-through text-muted-foreground" : ""}`}>
                {item.is_purchased ? "✅" : "⬜"} {item.ingredient} ({item.total_quantity} {item.unit})
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expense Summary */}
      {transfers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" /> מאזן תשלומים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {balances.map((b) => (
              <div key={b.profileId} className="flex justify-between text-sm">
                <span>{b.name}</span>
                <span>
                  שילם {formatCurrency(b.totalPaid)} · חלק {formatCurrency(b.totalOwed)}
                </span>
              </div>
            ))}
            <Separator />
            <div className="font-medium text-sm">העברות נדרשות:</div>
            {transfers.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                <span>{t.fromName} → {t.toName}</span>
                <Badge variant="destructive">{formatCurrency(t.amount)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lessons */}
      {lessons.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" /> לקחים ({lessons.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {lessons.map((l) => (
                <li key={l.id} className="text-sm flex gap-1">
                  <span>•</span>
                  <span>{l.content}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

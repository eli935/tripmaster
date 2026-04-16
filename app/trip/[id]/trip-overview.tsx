"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  CalendarDays,
  Package,
  ShoppingCart,
  Receipt,
  Copy,
  Plus,
  Loader2,
  Check,
  ArrowRight,
  UserPlus,
  Settings,
  ChefHat,
  Sparkles,
  Lightbulb,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Trip,
  TripParticipant,
  TripDay,
  Meal,
  MealItem,
  TripEquipment,
  Expense,
  ShoppingItem,
  LessonLearned,
  ExpenseCategory,
  SplitType,
} from "@/lib/supabase/types";
import { TripSettings } from "./trip-settings";
import { MealPlanner } from "./meal-planner";
import { LessonsLearnedTab } from "./lessons-learned";
import { WhatsAppSender } from "./whatsapp-sender";
import { TripSummary } from "./trip-summary";
import { useRealtimeTrip } from "@/lib/hooks/use-realtime";
import { HolidayBanner } from "@/components/holiday-banner";
import { FileManager } from "./file-manager";
import { Paperclip } from "lucide-react";
import {
  DAY_TYPE_LABELS,
  DAY_TYPE_COLORS,
} from "@/lib/hebrew-calendar";
import {
  calculateBalances,
  minimizeTransfers,
  formatCurrency,
} from "@/lib/expense-calculator";
import { generateShoppingList } from "@/lib/shopping-generator";

const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  flights: "טיסות",
  accommodation: "דירה/מלון",
  car: "רכב",
  food: "אוכל",
  equipment: "ציוד",
  attractions: "אטרקציות",
  other: "אחר",
};

interface TripOverviewProps {
  trip: Trip;
  participants: TripParticipant[];
  days: TripDay[];
  meals: Meal[];
  mealItems: MealItem[];
  equipment: TripEquipment[];
  expenses: Expense[];
  shopping: ShoppingItem[];
  lessons: LessonLearned[];
  files: any[];
  userId: string;
}

type Tab = "overview" | "meals" | "equipment" | "shopping" | "expenses" | "files" | "lessons" | "summary" | "settings";

export function TripOverview({
  trip,
  participants,
  days,
  meals,
  mealItems,
  equipment,
  expenses,
  shopping,
  lessons,
  files,
  userId,
}: TripOverviewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const router = useRouter();
  const supabase = createClient();

  const totalPeople = participants.reduce(
    (sum, p) => sum + (p.adults || 0) + (p.children || 0),
    0
  );

  // Realtime updates
  useRealtimeTrip(trip.id);

  const isAdmin = participants.some(
    (p) => p.profile_id === userId && p.role === "admin"
  );

  const tabs = [
    { id: "overview" as Tab, label: "סקירה", icon: Users, count: participants.length },
    { id: "meals" as Tab, label: "ארוחות", icon: ChefHat, count: meals.length },
    { id: "equipment" as Tab, label: "ציוד", icon: Package, count: equipment.length },
    { id: "shopping" as Tab, label: "קניות", icon: ShoppingCart, count: shopping.length },
    { id: "expenses" as Tab, label: "הוצאות", icon: Receipt, count: expenses.length },
    { id: "files" as Tab, label: "קבצים", icon: Paperclip, count: files.length },
    { id: "lessons" as Tab, label: "לקחים", icon: Lightbulb, count: lessons.length },
    { id: "summary" as Tab, label: "סיכום", icon: FileText, count: 0 },
    { id: "settings" as Tab, label: "הגדרות", icon: Settings, count: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Trip Header — Premium */}
      <div className="animate-fade-in-up">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-3 text-muted-foreground hover:text-foreground">
          <ArrowRight className="ml-1 h-4 w-4" />
          חזרה
        </Button>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{trip.name}</h1>
        <p className="text-muted-foreground mt-1">
          {trip.destination} · {totalPeople} נפשות · {participants.length} משפחות
        </p>
      </div>

      {/* Holiday Banner */}
      {trip.holiday_type !== "regular" && (
        <HolidayBanner holidayType={trip.holiday_type as any} />
      )}

      {/* Tab Navigation — Premium */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              activeTab === tab.id
                ? "gradient-blue text-white shadow-lg shadow-blue-500/25"
                : "text-muted-foreground hover:text-foreground glass glass-hover"
            }`}
          >
            <tab.icon className="ml-1 h-4 w-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`mr-1 text-xs ${activeTab === tab.id ? "text-white/80" : "text-muted-foreground"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          trip={trip}
          participants={participants}
          totalPeople={totalPeople}
          userId={userId}
        />
      )}
      {activeTab === "meals" && (
        <MealPlanner days={days} meals={meals} mealItems={mealItems} tripId={trip.id} totalPeople={totalPeople} />
      )}
      {activeTab === "equipment" && (
        <EquipmentTab
          equipment={equipment}
          tripId={trip.id}
          totalPeople={totalPeople}
          participants={participants}
        />
      )}
      {activeTab === "shopping" && (
        <ShoppingTab shopping={shopping} tripId={trip.id} mealItems={mealItems} totalPeople={totalPeople} />
      )}
      {activeTab === "expenses" && (
        <ExpensesTab
          expenses={expenses}
          participants={participants}
          tripId={trip.id}
          userId={userId}
        />
      )}
      {activeTab === "files" && (
        <FileManager files={files} tripId={trip.id} userId={userId} />
      )}
      {activeTab === "lessons" && (
        <LessonsLearnedTab lessons={lessons} tripId={trip.id} userId={userId} />
      )}
      {activeTab === "summary" && (
        <TripSummary
          trip={trip}
          participants={participants}
          days={days}
          meals={meals}
          equipment={equipment}
          expenses={expenses}
          shopping={shopping}
          lessons={lessons}
        />
      )}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <WhatsAppSender
            tripId={trip.id}
            tripName={trip.name}
            participantCount={participants.length}
            remainingShoppingItems={shopping.filter((s) => !s.is_purchased).length}
            daysUntilTrip={Math.ceil(
              (new Date(trip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )}
            isAdmin={isAdmin}
          />
          <TripSettings
            trip={trip}
            participants={participants}
            userId={userId}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
}

/* ========= OVERVIEW TAB ========= */
function OverviewTab({
  trip,
  participants,
  totalPeople,
  userId,
}: {
  trip: Trip;
  participants: TripParticipant[];
  totalPeople: number;
  userId: string;
}) {
  const [copied, setCopied] = useState(false);

  function copyInviteLink() {
    const link = `${window.location.origin}/invite/${trip.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("הלינק הועתק!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{participants.length}</div>
            <div className="text-xs text-muted-foreground">משפחות</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{totalPeople}</div>
            <div className="text-xs text-muted-foreground">נפשות</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">
              {Math.ceil(
                (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              ) + 1}
            </div>
            <div className="text-xs text-muted-foreground">ימים</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">
              {new Date(trip.start_date).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
            </div>
            <div className="text-xs text-muted-foreground">תאריך יציאה</div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Link */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            הזמנת משתתפים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={copyInviteLink} variant="outline" className="w-full">
              {copied ? (
                <><Check className="ml-2 h-4 w-4" />הועתק!</>
              ) : (
                <><Copy className="ml-2 h-4 w-4" />העתק לינק הזמנה</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Participants List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">משתתפים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400">
                  {(p.profile as any)?.full_name?.charAt(0) || "?"}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {(p.profile as any)?.full_name}
                    {p.role === "admin" && (
                      <Badge variant="outline" className="mr-1 text-xs">
                        מנהל
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.adults} מבוגרים · {p.children} ילדים
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ========= EQUIPMENT TAB ========= */
function EquipmentTab({
  equipment,
  tripId,
  totalPeople,
  participants,
}: {
  equipment: TripEquipment[];
  tripId: string;
  totalPeople: number;
  participants: TripParticipant[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("trip_equipment").insert({
      trip_id: tripId,
      name,
      quantity: parseInt(quantity),
    });
    setAddOpen(false);
    setName("");
    setQuantity("1");
    router.refresh();
    toast.success("פריט נוסף!");
  }

  async function toggleStatus(item: TripEquipment) {
    const statusOrder = ["pending", "packed", "loaded", "arrived"] as const;
    const currentIdx = statusOrder.indexOf(item.status as any);
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
    await supabase
      .from("trip_equipment")
      .update({ status: nextStatus })
      .eq("id", item.id);
    router.refresh();
  }

  const STATUS_ICONS: Record<string, string> = {
    pending: "⬜",
    packed: "📦",
    loaded: "🚗",
    arrived: "✅",
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">ציוד ({equipment.length})</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={<Button size="sm"><Plus className="ml-1 h-4 w-4" />הוסף פריט</Button>}
          />
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>הוספת פריט ציוד</DialogTitle>
            </DialogHeader>
            <form onSubmit={addItem} className="space-y-3">
              <div className="space-y-2">
                <Label>שם הפריט</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>כמות</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full">הוסף</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {equipment.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between p-3 bg-card rounded-lg border cursor-pointer hover:bg-secondary"
          onClick={() => toggleStatus(item)}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{STATUS_ICONS[item.status]}</span>
            <div>
              <div className="text-sm font-medium">{item.name}</div>
              <div className="text-xs text-muted-foreground">
                כמות: {item.quantity}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {item.status === "pending" && "ממתין"}
            {item.status === "packed" && "נארז"}
            {item.status === "loaded" && "נטען"}
            {item.status === "arrived" && "הגיע"}
          </Badge>
        </div>
      ))}

      {equipment.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          עדיין לא הוספת ציוד
        </p>
      )}
    </div>
  );
}

/* ========= SHOPPING TAB ========= */
function ShoppingTab({
  shopping,
  tripId,
  mealItems,
  totalPeople,
}: {
  shopping: ShoppingItem[];
  tripId: string;
  mealItems: MealItem[];
  totalPeople: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [ingredient, setIngredient] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("יח׳");

  async function generateFromMeals() {
    if (mealItems.length === 0) {
      toast.error("אין מרכיבים בארוחות. הוסף מרכיבים לארוחות קודם.");
      return;
    }
    setGenerating(true);
    const items = generateShoppingList(mealItems, totalPeople);

    // Delete existing auto-generated items (keep manually added)
    // Insert new ones
    const { error } = await supabase.from("shopping_items").insert(
      items.map((item) => ({
        trip_id: tripId,
        ingredient: item.ingredient,
        total_quantity: Math.round(item.total_quantity * 10) / 10,
        unit: item.unit,
        category: item.category,
        is_purchased: false,
      }))
    );

    if (error) {
      toast.error("שגיאה ביצירת רשימה");
    } else {
      toast.success(`נוצרו ${items.length} פריטים מהארוחות!`);
    }
    setGenerating(false);
    router.refresh();
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("shopping_items").insert({
      trip_id: tripId,
      ingredient,
      total_quantity: parseFloat(qty),
      unit,
      category: "other",
    });
    setAddOpen(false);
    setIngredient("");
    router.refresh();
    toast.success("פריט נוסף!");
  }

  async function togglePurchased(item: ShoppingItem) {
    await supabase
      .from("shopping_items")
      .update({ is_purchased: !item.is_purchased })
      .eq("id", item.id);
    router.refresh();
  }

  const purchased = shopping.filter((s) => s.is_purchased);
  const remaining = shopping.filter((s) => !s.is_purchased);

  return (
    <div className="space-y-3">
      {/* Generate from meals */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={generateFromMeals}
        disabled={generating}
      >
        {generating ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Sparkles className="ml-1 h-4 w-4" />}
        צור רשימה מהארוחות
      </Button>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold">
          רשימת קניות ({remaining.length} נותרו)
        </h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={<Button size="sm"><Plus className="ml-1 h-4 w-4" />הוסף</Button>}
          />
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>הוספת פריט לרשימה</DialogTitle>
            </DialogHeader>
            <form onSubmit={addItem} className="space-y-3">
              <div className="space-y-2">
                <Label>שם המוצר</Label>
                <Input value={ingredient} onChange={(e) => setIngredient(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>כמות</Label>
                  <Input type="number" min="0.1" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>יחידה</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full">הוסף</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {remaining.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 bg-card rounded-lg border cursor-pointer hover:bg-secondary"
          onClick={() => togglePurchased(item)}
        >
          <Checkbox checked={false} />
          <div className="flex-1">
            <div className="text-sm">{item.ingredient}</div>
            <div className="text-xs text-muted-foreground">
              {item.total_quantity} {item.unit}
            </div>
          </div>
        </div>
      ))}

      {purchased.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-muted-foreground pt-2">
            נקנו ({purchased.length})
          </h3>
          {purchased.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-secondary rounded-lg border cursor-pointer opacity-60"
              onClick={() => togglePurchased(item)}
            >
              <Checkbox checked={true} />
              <div className="flex-1 line-through">
                <div className="text-sm">{item.ingredient}</div>
              </div>
              {item.price && (
                <span className="text-xs">{formatCurrency(item.price)}</span>
              )}
            </div>
          ))}
        </>
      )}

      {shopping.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          רשימת הקניות ריקה
        </p>
      )}
    </div>
  );
}

/* ========= EXPENSES TAB ========= */
function ExpensesTab({
  expenses,
  participants,
  tripId,
  userId,
}: {
  expenses: Expense[];
  participants: TripParticipant[];
  tripId: string;
  userId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [splitType, setSplitType] = useState<SplitType>("equal");

  const profileNames: Record<string, string> = {};
  participants.forEach((p) => {
    profileNames[p.profile_id] = (p.profile as any)?.full_name || "???";
  });

  const balances = calculateBalances(expenses, participants, profileNames);
  const transfers = minimizeTransfers(balances);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("expenses").insert({
      trip_id: tripId,
      paid_by: userId,
      amount: parseFloat(amount),
      category,
      description,
      split_type: splitType,
    });
    setAddOpen(false);
    setAmount("");
    setDescription("");
    router.refresh();
    toast.success("הוצאה נרשמה!");
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <div className="text-xs text-muted-foreground">סה״כ הוצאות</div>
          </div>
        </CardContent>
      </Card>

      {/* Balance / Transfers */}
      {transfers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">מאזן — מי חייב למי</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {transfers.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-secondary rounded">
                <span>
                  <strong>{t.fromName}</strong> → <strong>{t.toName}</strong>
                </span>
                <Badge variant="destructive">{formatCurrency(t.amount)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add Expense */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">הוצאות</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={<Button size="sm"><Plus className="ml-1 h-4 w-4" />הוספת הוצאה</Button>}
          />
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>הוספת הוצאה</DialogTitle>
            </DialogHeader>
            <form onSubmit={addExpense} className="space-y-3">
              <div className="space-y-2">
                <Label>תיאור</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='למשל "קניות בשר"'
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>סכום (₪)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>קטגוריה</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>חלוקה</Label>
                <Select value={splitType} onValueChange={(v) => setSplitType(v as SplitType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">שווה בין משפחות</SelectItem>
                    <SelectItem value="per_person">לפי נפשות</SelectItem>
                    <SelectItem value="private">פרטי (לא לחלוקה)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">שמור</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expense List */}
      {expenses.map((exp) => (
        <div key={exp.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
          <div>
            <div className="text-sm font-medium">{exp.description}</div>
            <div className="text-xs text-muted-foreground">
              {(exp as any).payer?.full_name} · {EXPENSE_CATEGORIES[exp.category as ExpenseCategory] || exp.category}
            </div>
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm">{formatCurrency(Number(exp.amount))}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(exp.created_at).toLocaleDateString("he-IL")}
            </div>
          </div>
        </div>
      ))}

      {expenses.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          עדיין לא נרשמו הוצאות
        </p>
      )}
    </div>
  );
}

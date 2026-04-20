"use client";

import { useState, useEffect, useMemo } from "react";
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
import { DestinationOverview } from "./destination-overview";
import { PermissionsManager } from "./permissions-manager";
import { AdminPanel } from "./admin-panel";
import { TripChat } from "./trip-chat";
import { ExpenseDialog } from "./expense-dialog";
import { BalanceDashboard } from "./balance-dashboard";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EXPENSE_CATEGORIES, UNKNOWN_NAME } from "@/lib/i18n-labels";
import { MoreHorizontal } from "lucide-react";
import { MagneticButton } from "@/components/magnetic-button";
import { DeleteButton } from "./delete-button";
import type { TripPermission } from "@/lib/permissions";
import type { ExpensePayer } from "@/lib/types-v8";
import { FadeUp, StaggerContainer, StaggerItem, GlowPulse } from "@/components/motion";
import { Paperclip, Compass, MessageCircle, Shield } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { DestinationInfo } from "@/lib/destinations";
import {
  DAY_TYPE_LABELS,
  DAY_TYPE_COLORS,
} from "@/lib/hebrew-calendar";
import {
  calculateBalances,
  minimizeTransfers,
  formatCurrency,
} from "@/lib/expense-calculator";
import { generateShoppingList, formatShoppingQuantity } from "@/lib/shopping-generator";
import { getTotalHeadcount, getCountedParticipants } from "@/lib/participant-utils";

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
  destination: DestinationInfo | null;
  rates: Record<string, number> | null;
  permissions: TripPermission[];
  expensePayers: ExpensePayer[];
  settlements?: any[];
  zmanimMap?: Record<string, any>;
  userId: string;
}

type Tab = "destination" | "overview" | "chat" | "meals" | "equipment" | "shopping" | "expenses" | "files" | "lessons" | "summary" | "admin" | "settings";

// Which tabs appear in the primary row (always visible). Rest go into "עוד" popover.
const PRIMARY_TAB_IDS: ReadonlySet<Tab> = new Set<Tab>([
  "destination",
  "overview",
  "chat",
  "meals",
  "expenses",
]);

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
  destination,
  rates,
  permissions,
  expensePayers,
  settlements = [],
  zmanimMap,
  userId,
}: TripOverviewProps) {
  const [activeTab, setActiveTab] = useState<Tab>(destination ? "destination" : "overview");
  const router = useRouter();
  const supabase = createClient();

  // Headcount respects trip.admin_participates — when false, the admin row is
  // excluded from totals (but remains in the participant list UI).
  const { total: totalPeople, families: countedFamilies } = getTotalHeadcount(
    participants,
    trip
  );

  // Realtime updates
  useRealtimeTrip(trip.id);

  const isAdmin = participants.some(
    (p) => p.profile_id === userId && p.role === "admin"
  );

  // Get current user's permissions
  const myPerms = permissions.find((p) => p.profile_id === userId);
  // If admin, all permissions; else use actual perms
  const canSee = {
    destination: isAdmin || (myPerms?.can_see_destination ?? true),
    overview: isAdmin || (myPerms?.can_see_overview ?? true),
    meals: isAdmin || (myPerms?.can_see_meals ?? true),
    equipment: isAdmin || (myPerms?.can_see_equipment ?? true),
    shopping: isAdmin || (myPerms?.can_see_shopping ?? true),
    expenses: isAdmin || (myPerms?.can_see_expenses ?? true),
    files: isAdmin || (myPerms?.can_see_files ?? true),
    lessons: isAdmin || (myPerms?.can_see_lessons ?? true),
  };

  const allTabs = [
    ...(destination && canSee.destination ? [{ id: "destination" as Tab, label: "יעד", icon: Compass, count: 0 }] : []),
    ...(canSee.overview ? [{ id: "overview" as Tab, label: "סקירה", icon: Users, count: participants.length }] : []),
    { id: "chat" as Tab, label: "צ׳אט", icon: MessageCircle, count: 0 },
    ...(canSee.meals ? [{ id: "meals" as Tab, label: "ארוחות", icon: ChefHat, count: meals.length }] : []),
    ...(canSee.equipment ? [{ id: "equipment" as Tab, label: "ציוד", icon: Package, count: equipment.length }] : []),
    ...(canSee.shopping ? [{ id: "shopping" as Tab, label: "קניות", icon: ShoppingCart, count: shopping.length }] : []),
    ...(canSee.expenses ? [{ id: "expenses" as Tab, label: "הוצאות", icon: Receipt, count: expenses.length }] : []),
    ...(canSee.files ? [{ id: "files" as Tab, label: "קבצים", icon: Paperclip, count: files.length }] : []),
    ...(canSee.lessons ? [{ id: "lessons" as Tab, label: "לקחים", icon: Lightbulb, count: lessons.length }] : []),
    { id: "summary" as Tab, label: "סיכום", icon: FileText, count: 0 },
    ...(isAdmin ? [{ id: "admin" as Tab, label: "מנהל", icon: Shield, count: 0 }] : []),
    ...(isAdmin ? [{ id: "settings" as Tab, label: "הגדרות", icon: Settings, count: 0 }] : []),
  ];
  const tabs = allTabs;

  return (
    <div className="space-y-6">
      {/* Trip Header — Premium */}
      <div className="animate-fade-in-up">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-3 text-muted-foreground hover:text-foreground">
          <ArrowRight className="ml-1 h-4 w-4" />
          חזרה
        </Button>
        <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">{trip.name}</h1>
        <p className="text-muted-foreground mt-1">
          {trip.destination} · {totalPeople} נפשות · {countedFamilies} משפחות
        </p>
      </div>

      {/* Holiday Banner */}
      {trip.holiday_type !== "regular" && (
        <HolidayBanner holidayType={trip.holiday_type as any} />
      )}

      {/* Command Deck — primary row + "עוד" popover */}
      <CommandDeck
        tabs={tabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
      />

      {/* Tab Content with smooth transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === "destination" && destination && (
            <DestinationOverview destination={destination} rates={rates} trip={trip} days={days} />
          )}
          {activeTab === "chat" && (
            <TripChat
              tripId={trip.id}
              userId={userId}
              userName={participants.find((p) => p.profile_id === userId)?.profile?.full_name || "אני"}
              participants={participants}
            />
          )}
          {activeTab === "admin" && isAdmin && (
            <AdminPanel tripId={trip.id} userId={userId} tripName={trip.name} />
          )}
          {activeTab === "overview" && (
            <OverviewTab
              trip={trip}
              participants={participants}
              totalPeople={totalPeople}
              userId={userId}
            />
          )}
          {activeTab === "meals" && (
            <MealPlanner days={days} meals={meals} mealItems={mealItems} tripId={trip.id} totalPeople={totalPeople} zmanimMap={zmanimMap} />
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
            <ShoppingTab shopping={shopping} tripId={trip.id} mealItems={mealItems} meals={meals} totalPeople={totalPeople} />
          )}
          {activeTab === "expenses" && (
            <ExpensesTab
              trip={trip}
              expenses={
                isAdmin || (myPerms?.can_see_other_expenses ?? true)
                  ? expenses
                  : expenses.filter((e) => e.paid_by === userId)
              }
              participants={participants}
              tripId={trip.id}
              userId={userId}
              isAdmin={isAdmin}
              settlements={settlements}
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
              {isAdmin && (
                <PermissionsManager
                  tripId={trip.id}
                  participants={participants}
                  permissions={permissions}
                />
              )}
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ========= COMMAND DECK TAB NAVIGATION ========= */
function CommandDeck({
  tabs,
  activeTab,
  onSelect,
}: {
  tabs: { id: Tab; label: string; icon: any; count: number }[];
  activeTab: Tab;
  onSelect: (t: Tab) => void;
}) {
  const primaryTabs = tabs.filter((t) => PRIMARY_TAB_IDS.has(t.id));
  const overflowTabs = tabs.filter((t) => !PRIMARY_TAB_IDS.has(t.id));
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeInOverflow = overflowTabs.some((t) => t.id === activeTab);
  const activeOverflowTab = tabs.find(
    (t) => t.id === activeTab && !PRIMARY_TAB_IDS.has(t.id)
  );

  return (
    <div
      className={`sticky top-0 z-30 -mx-4 px-4 py-2 transition-all duration-300 ${
        scrolled
          ? "bg-background/85 backdrop-blur-xl border-b border-[var(--gold-500)]/25 shadow-[0_6px_20px_-12px_rgba(0,0,0,0.8)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin max-w-5xl mx-auto">
      {primaryTabs.map((tab) => (
        <TabPill
          key={tab.id}
          tab={tab}
          active={activeTab === tab.id}
          onClick={() => onSelect(tab.id)}
        />
      ))}

      {overflowTabs.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  activeInOverflow
                    ? "bg-[var(--gold-500)]/20 text-[var(--gold-200)] border border-[var(--gold-500)]/40"
                    : "text-muted-foreground hover:text-foreground glass glass-hover"
                }`}
              >
                <MoreHorizontal className="ml-1 h-4 w-4" />
                {activeInOverflow && activeOverflowTab
                  ? activeOverflowTab.label
                  : "עוד"}
                <span className="mr-1 text-xs opacity-70">
                  {overflowTabs.length}
                </span>
              </motion.button>
            }
          />
          <PopoverContent align="end" className="w-64 p-1.5">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              תפריט מלא
            </div>
            <div className="flex flex-col gap-0.5">
              {overflowTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onSelect(tab.id);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    activeTab === tab.id
                      ? "bg-[var(--gold-500)]/20 text-[var(--gold-200)]"
                      : "text-foreground hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <tab.icon className="h-4 w-4 opacity-70" />
                    {tab.label}
                  </span>
                  {tab.count > 0 && (
                    <span className="text-[11px] text-muted-foreground font-display">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      </div>
    </div>
  );
}

function TabPill({
  tab,
  active,
  onClick,
}: {
  tab: { id: Tab; label: string; icon: any; count: number };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
        active
          ? "text-[var(--gold-50)] bg-[var(--gold-500)]/20 border border-[var(--gold-500)]/50 shadow-[0_0_20px_-6px_rgba(212,169,96,0.5)]"
          : "text-muted-foreground hover:text-foreground glass glass-hover"
      }`}
    >
      {active && (
        <motion.span
          layoutId="active-tab-glow"
          className="absolute inset-0 rounded-full bg-[var(--gold-500)]/10 pointer-events-none"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <tab.icon className="ml-1 h-4 w-4 relative" />
      <span className="relative">{tab.label}</span>
      {tab.count > 0 && (
        <span
          className={`mr-1 text-xs font-display relative ${
            active ? "text-[var(--gold-200)]" : "text-muted-foreground"
          }`}
        >
          {tab.count}
        </span>
      )}
    </motion.button>
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

  const daysCount = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const countedFamilies = getCountedParticipants(participants, trip).length;
  const adminExcluded = trip.admin_participates === false;

  return (
    <div className="space-y-6">
      {/* Premium Stats */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3" delay={0.1}>
        {[
          { value: countedFamilies, label: "משפחות", gradient: "from-blue-500 to-blue-600", icon: "👨‍👩‍👧‍👦" },
          { value: totalPeople, label: "נפשות", gradient: "from-purple-500 to-purple-600", icon: "👥" },
          { value: daysCount, label: "ימים", gradient: "from-teal-500 to-teal-600", icon: "📅" },
          { value: new Date(trip.start_date).toLocaleDateString("he-IL", { day: "numeric", month: "short" }), label: "יציאה", gradient: "from-amber-500 to-orange-600", icon: "✈️" },
        ].map((stat) => (
          <StaggerItem key={stat.label}>
            <div className="relative overflow-hidden rounded-2xl p-4 glass glass-hover transition-all duration-300">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className={`absolute -top-6 -left-6 w-16 h-16 rounded-full bg-gradient-to-r ${stat.gradient} opacity-20 blur-xl`} />
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>

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
          {participants.map((p) => {
            const isAdminOnly =
              adminExcluded && p.profile_id === trip.created_by;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400">
                    {(p.profile as any)?.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1 flex-wrap">
                      <span>{(p.profile as any)?.full_name}</span>
                      {p.role === "admin" && (
                        <Badge variant="outline" className="mr-1 text-xs">
                          מנהל
                        </Badge>
                      )}
                      {isAdminOnly && (
                        <Badge
                          variant="outline"
                          className="mr-1 text-[10px] border-amber-400/40 text-amber-300"
                          title="מנהל בלבד — לא נספר בכמויות, במלאי ובחלוקת הוצאות"
                        >
                          לא נוסע
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isAdminOnly ? (
                        <span className="italic">מנהל הטיול בלבד — לא משתתף בפועל</span>
                      ) : (
                        <>{p.adults} מבוגרים · {p.children} ילדים</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
  meals,
  totalPeople,
}: {
  shopping: ShoppingItem[];
  tripId: string;
  mealItems: MealItem[];
  meals: Meal[];
  totalPeople: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [ingredient, setIngredient] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("יח׳");

  // Aggregated view of meal-derived items (always in sync, client-side)
  const aggregated = useMemo(
    () => generateShoppingList(mealItems, totalPeople, meals),
    [mealItems, totalPeople, meals]
  );
  const aggregatedKeys = useMemo(
    () =>
      new Set(aggregated.map((a) => `${a.ingredient.trim().toLowerCase()}|${a.unit}`)),
    [aggregated]
  );
  // Manually added items are those in `shopping` table not matching any aggregated key.
  const manualShopping = shopping.filter(
    (s) => !aggregatedKeys.has(`${s.ingredient.trim().toLowerCase()}|${s.unit}`)
  );
  // Purchased state — merge from shopping table by key
  const purchasedMap = new Map(
    shopping.map((s) => [
      `${s.ingredient.trim().toLowerCase()}|${s.unit}`,
      s,
    ])
  );

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

  async function toggleAggregatedPurchased(
    key: string,
    ingredient: string,
    unitVal: string,
    category: string,
    totalQty: number
  ) {
    const existing = purchasedMap.get(key);
    if (existing) {
      await supabase
        .from("shopping_items")
        .update({ is_purchased: !existing.is_purchased })
        .eq("id", existing.id);
    } else {
      // create as already-purchased
      await supabase.from("shopping_items").insert({
        trip_id: tripId,
        ingredient,
        total_quantity: Math.round(totalQty * 10) / 10,
        unit: unitVal,
        category,
        is_purchased: true,
      });
    }
    router.refresh();
  }

  async function toggleManualPurchased(item: ShoppingItem) {
    await supabase
      .from("shopping_items")
      .update({ is_purchased: !item.is_purchased })
      .eq("id", item.id);
    router.refresh();
  }

  const aggRows = aggregated.map((a) => {
    const key = `${a.ingredient.trim().toLowerCase()}|${a.unit}`;
    const linked = purchasedMap.get(key);
    const fmt = formatShoppingQuantity(a.total_quantity, a.unit);
    return {
      key,
      ingredient: a.ingredient,
      unit: a.unit,
      category: a.category,
      total: a.total_quantity,
      displayed: fmt.displayed,
      raw: fmt.raw,
      bumped: fmt.bumped,
      meal_count: a.meal_count,
      is_purchased: linked?.is_purchased ?? false,
    };
  });

  const aggRemaining = aggRows.filter((r) => !r.is_purchased);
  const aggPurchased = aggRows.filter((r) => r.is_purchased);
  const manualRemaining = manualShopping.filter((s) => !s.is_purchased);
  const manualPurchased = manualShopping.filter((s) => s.is_purchased);
  const totalRemaining = aggRemaining.length + manualRemaining.length;
  const isEmpty = aggRows.length === 0 && manualShopping.length === 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        הרשימה מתעדכנת אוטומטית מהארוחות
      </p>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold">
          רשימת קניות ({totalRemaining} נותרו)
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

      {aggRemaining.map((r) => (
        <div
          key={r.key}
          className="flex items-center gap-3 p-3 bg-card rounded-lg border cursor-pointer hover:bg-secondary"
          onClick={() =>
            toggleAggregatedPurchased(r.key, r.ingredient, r.unit, r.category, r.total)
          }
        >
          <Checkbox checked={false} />
          <div className="flex-1">
            <div className="text-sm">{r.ingredient}</div>
            <div className="text-xs text-muted-foreground">
              {r.bumped ? (
                <>
                  {r.raw} {r.unit} → {r.displayed} {r.unit}
                </>
              ) : (
                <>
                  {r.displayed} {r.unit}
                </>
              )}{" "}
              · מתוך {r.meal_count} ארוחות
            </div>
          </div>
        </div>
      ))}

      {manualRemaining.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 bg-card rounded-lg border cursor-pointer hover:bg-secondary"
          onClick={() => toggleManualPurchased(item)}
        >
          <Checkbox checked={false} />
          <div className="flex-1">
            <div className="text-sm">{item.ingredient}</div>
            <div className="text-xs text-muted-foreground">
              {item.total_quantity} {item.unit} · ידני
            </div>
          </div>
        </div>
      ))}

      {(aggPurchased.length > 0 || manualPurchased.length > 0) && (
        <>
          <h3 className="text-sm font-medium text-muted-foreground pt-2">
            נקנו ({aggPurchased.length + manualPurchased.length})
          </h3>
          {aggPurchased.map((r) => (
            <div
              key={r.key}
              className="flex items-center gap-3 p-3 bg-secondary rounded-lg border cursor-pointer opacity-60"
              onClick={() =>
                toggleAggregatedPurchased(r.key, r.ingredient, r.unit, r.category, r.total)
              }
            >
              <Checkbox checked={true} />
              <div className="flex-1 line-through">
                <div className="text-sm">{r.ingredient}</div>
              </div>
            </div>
          ))}
          {manualPurchased.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-secondary rounded-lg border cursor-pointer opacity-60"
              onClick={() => toggleManualPurchased(item)}
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

      {isEmpty && (
        <p className="text-center text-muted-foreground py-8">
          רשימת הקניות ריקה — הוסף ארוחות עם מרכיבים או פריטים ידניים
        </p>
      )}
    </div>
  );
}

/* ========= EXPENSES TAB ========= */
function ExpensesTab({
  trip,
  expenses,
  participants,
  tripId,
  userId,
  isAdmin,
  settlements,
}: {
  trip: Trip;
  expenses: Expense[];
  participants: TripParticipant[];
  tripId: string;
  userId: string;
  isAdmin: boolean;
  settlements: any[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const profileNames: Record<string, string> = {};
  participants.forEach((p) => {
    profileNames[p.profile_id] = (p.profile as any)?.full_name || UNKNOWN_NAME;
  });

  const currentUserName = profileNames[userId] || "אני";

  return (
    <div className="space-y-4">
      {/* Premium Balance Dashboard (v8.6) */}
      <BalanceDashboard
        trip={trip}
        tripId={tripId}
        expenses={expenses}
        participants={participants}
        settlements={settlements}
        userId={userId}
        isAdmin={isAdmin}
      />

      {/* Add Expense */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">הוצאות</h2>
        <MagneticButton
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full gradient-gold text-white px-5 py-2 text-sm font-medium shadow-[0_4px_20px_-6px_rgba(212,169,96,0.6)] hover:brightness-110 transition"
        >
          <Plus className="h-4 w-4" />
          הוספת הוצאה
        </MagneticButton>
        <ExpenseDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          tripId={tripId}
          trip={trip}
          participants={participants}
          userId={userId}
          isAdmin={isAdmin}
          currentUserName={currentUserName}
        />
      </div>

      {/* Expense List */}
      {expenses.map((exp) => {
        // Gold shimmer sweep on items created in the last 4 seconds
        const ageMs = Date.now() - new Date(exp.created_at).getTime();
        const isFresh = ageMs < 4000;
        return (
          <div
            key={exp.id}
            className={`flex items-center justify-between p-3 bg-card rounded-lg border border-white/5 ${
              isFresh ? "animate-gold-shimmer" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium font-serif">{exp.description}</div>
              <div className="text-xs text-muted-foreground">
                {(exp as any).payer?.full_name || profileNames[exp.paid_by] || UNKNOWN_NAME} · {EXPENSE_CATEGORIES[exp.category as ExpenseCategory] || "אחר"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-left">
                <div className="font-semibold text-sm tabular-nums font-display">{formatCurrency(Number(exp.amount), exp.currency || "ILS")}</div>
                {/* ILS equivalent + which-day rate — only for foreign currency */}
                {exp.currency && exp.currency !== "ILS" && (exp as any).fx_rate_to_ils && (
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    ≈ {formatCurrency(Number(exp.amount) * Number((exp as any).fx_rate_to_ils), "ILS")}
                    {" · שער "}
                    {Number((exp as any).fx_rate_to_ils).toFixed(4)}
                    {(exp as any).fx_rate_date && ` · ${(exp as any).fx_rate_date}`}
                  </div>
                )}
                {exp.currency && exp.currency !== "ILS" && !(exp as any).fx_rate_to_ils && (
                  <div className="text-[11px] text-amber-400 tabular-nums">
                    ⚠ שער לא נעול
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {(exp as any).expense_date
                    ? new Date((exp as any).expense_date).toLocaleDateString("he-IL")
                    : new Date(exp.created_at).toLocaleDateString("he-IL")}
                </div>
              </div>
              {(isAdmin || exp.paid_by === userId) && (
                <DeleteButton table="expenses" recordId={exp.id} tripId={tripId} userId={userId} isAdmin={isAdmin} />
              )}
            </div>
          </div>
        );
      })}

      {expenses.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          עדיין לא נרשמו הוצאות
        </p>
      )}
    </div>
  );
}

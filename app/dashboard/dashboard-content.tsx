"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Plane,
  Calendar,
  Users,
  MapPin,
  ArrowLeft,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile, Trip, HolidayType, TripStatus, TripType, LocationType, MarkupType } from "@/lib/supabase/types";
import { generateTripDays } from "@/lib/hebrew-calendar";
import { FadeUp, StaggerContainer, StaggerItem, HoverScale } from "@/components/motion";
import { motion, AnimatePresence } from "framer-motion";
import { User, Users as UsersIcon, UserPlus, Briefcase, Home, Plane as PlaneIcon } from "lucide-react";

const STATUS_LABELS: Record<TripStatus, { label: string; color: string }> = {
  planning: { label: "בתכנון", color: "bg-yellow-100 text-yellow-800" },
  active: { label: "פעיל", color: "bg-green-100 text-green-800" },
  completed: { label: "הסתיים", color: "bg-gray-100 text-gray-800" },
  review: { label: "הפקת לקחים", color: "bg-blue-500/20 text-blue-800" },
};

const HOLIDAY_LABELS: Record<HolidayType, string> = {
  pesach: "פסח",
  sukkot: "סוכות",
  rosh_hashana: "ראש השנה",
  shavuot: "שבועות",
  regular: "טיול רגיל",
};

interface PendingInvite {
  id: string;
  token: string;
  trip_id: string;
  message: string | null;
  expires_at: string;
  trip: { name: string; destination: string; start_date: string; end_date: string } | null;
  inviter: { full_name: string | null } | null;
}

interface DashboardContentProps {
  profile: Profile | null;
  trips: (Trip & { role: string })[];
  userId: string;
  canCreateTrip?: boolean;
  pendingInvites?: PendingInvite[];
}

export function DashboardContent({
  profile,
  trips,
  userId,
  canCreateTrip = true,
  pendingInvites = [],
}: DashboardContentProps) {
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);

  async function acceptInvite(token: string) {
    setAcceptingToken(token);
    const { data, error } = await supabase.rpc("accept_trip_invitation", { p_token: token });
    if (error || !data?.ok) {
      toast.error("שגיאה באישור ההזמנה", { description: error?.message || data?.error });
      setAcceptingToken(null);
      return;
    }
    toast.success("הצטרפת לטיול! 🎉");
    const needsOnboarding = !profile || profile.children === null;
    if (needsOnboarding) {
      router.push(`/onboarding?next=/trip/${data.trip_id}`);
    } else {
      router.push(`/trip/${data.trip_id}`);
      router.refresh();
    }
  }

  const router = useRouter();
  const supabase = createClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // New trip form
  const [tripName, setTripName] = useState("");
  const [destination, setDestination] = useState("");
  const [holidayType, setHolidayType] = useState<HolidayType>("regular");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tripType, setTripType] = useState<TripType>("family");
  const [locationType, setLocationType] = useState<LocationType>("international");
  const [adminParticipates, setAdminParticipates] = useState(true);
  const [markupType, setMarkupType] = useState<MarkupType>("none");
  const [markupValue, setMarkupValue] = useState<string>("");

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Create trip
    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        name: tripName,
        destination,
        holiday_type: holidayType,
        start_date: startDate,
        end_date: endDate,
        created_by: userId,
        trip_type: tripType,
        location_type: locationType,
        admin_participates: adminParticipates,
        markup_type: (tripType === "friends" || tripType === "client") ? markupType : "none",
        markup_value: (tripType === "friends" || tripType === "client") && markupType !== "none"
          ? (parseFloat(markupValue) || 0)
          : 0,
      })
      .select()
      .single();

    if (error || !trip) {
      toast.error("שגיאה ביצירת הטיול");
      setLoading(false);
      return;
    }

    // Add creator as admin participant
    await supabase.from("trip_participants").insert({
      trip_id: trip.id,
      profile_id: userId,
      role: "admin",
      adults: profile?.adults || 2,
      children: profile?.children?.length || 0,
    });

    // Generate trip days with Hebrew calendar
    const days = generateTripDays(
      new Date(startDate),
      new Date(endDate),
      false // diaspora
    );

    // Insert trip days
    if (days.length > 0) {
      await supabase.from("trip_days").insert(
        days.map((d) => ({
          trip_id: trip.id,
          date: d.date,
          hebrew_date: d.hebrew_date,
          day_type: d.day_type,
        }))
      );
    }

    // Load equipment templates for this holiday type
    const totalPeople = (profile?.adults || 2) + (profile?.children?.length || 0);
    const { data: templates } = await supabase
      .from("equipment_templates")
      .select("*")
      .or(`holiday_type.eq.${holidayType},holiday_type.eq.regular`);

    if (templates && templates.length > 0) {
      const equipmentItems = templates.map((t: any) => ({
        trip_id: trip.id,
        template_id: t.id,
        name: t.name,
        quantity: t.is_shared
          ? 1
          : Math.max(1, Math.ceil(t.quantity_per_person * totalPeople)),
        status: "pending",
        notes: t.notes,
      }));
      await supabase.from("trip_equipment").insert(equipmentItems);
    }

    toast.success("הטיול נוצר בהצלחה!");
    setDialogOpen(false);
    setLoading(false);
    const suffix = tripType === "family" ? "?setup=family" : "";
    router.push(`/trip/${trip.id}${suffix}`);
    router.refresh();
  }

  const activeTrips = trips.filter((t) => t.status !== "completed");
  const pastTrips = trips.filter((t) => t.status === "completed");

  return (
    <div className="space-y-10">
      {/* Hero Header */}
      <div className="flex items-end justify-between pt-4">
        <FadeUp>
          <p className="text-sm text-muted-foreground mb-1">שלום,</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">{profile?.full_name}</h1>
        </FadeUp>

        {canCreateTrip && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={<Button><Plus className="ml-2 h-4 w-4" />טיול חדש</Button>}
          />
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>יצירת טיול חדש</DialogTitle>
              <DialogDescription>מלא את הפרטים כדי להתחיל לתכנן</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div className="space-y-2">
                <Label>שם הטיול</Label>
                <Input
                  placeholder='למשל "פסח 2026 באיטליה"'
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>יעד</Label>
                <Input
                  placeholder="למשל רומא, איטליה"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>
              {/* Trip type — 2x2 grid of cards */}
              <div className="space-y-2">
                <Label>סוג טיול</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "private", icon: User, title: "פרטי", desc: "טיול אישי, בלי חלוקה" },
                    { value: "family", icon: UsersIcon, title: "משפחתי", desc: "עם בני המשפחה, חלוקת משימות" },
                    { value: "friends", icon: UserPlus, title: "חברים", desc: "קבוצת חברים, עם רווח מנהל" },
                    { value: "client", icon: Briefcase, title: "לקוח", desc: "טיול עבור לקוח, עם עמלה" },
                  ] as { value: TripType; icon: any; title: string; desc: string }[]).map((opt) => {
                    const Icon = opt.icon;
                    const active = tripType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTripType(opt.value)}
                        className={`relative text-right rounded-xl border p-3 transition-all ${
                          active
                            ? "border-[var(--gold-500)] bg-[var(--gold-500)]/10 shadow-[0_0_0_1px_var(--gold-500)]"
                            : "border-border/50 glass hover:border-[var(--gold-500)]/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`h-4 w-4 ${active ? "text-[var(--gold-500)]" : "text-muted-foreground"}`} />
                          <span className="font-semibold text-sm">{opt.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location type chips */}
              <div className="space-y-2">
                <Label>יעד</Label>
                <div className="flex gap-2">
                  {([
                    { value: "domestic", icon: Home, label: "🇮🇱 בישראל" },
                    { value: "international", icon: PlaneIcon, label: "✈️ בחו\"ל" },
                  ] as { value: LocationType; icon: any; label: string }[]).map((opt) => {
                    const active = locationType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLocationType(opt.value)}
                        className={`flex-1 rounded-full px-4 py-2 text-sm transition-all border ${
                          active
                            ? "border-[var(--gold-500)] bg-[var(--gold-500)]/15 text-white font-semibold"
                            : "border-border/50 glass text-muted-foreground hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Admin participates — custom switch */}
              <div className="flex items-center justify-between rounded-xl border border-border/50 glass p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm cursor-pointer" htmlFor="admin-participates-switch">
                    אני משתתף בטיול
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    כבה אם אתה מנהל טיול בלבד עבור אחרים
                  </p>
                </div>
                <button
                  id="admin-participates-switch"
                  type="button"
                  role="switch"
                  aria-checked={adminParticipates}
                  onClick={() => setAdminParticipates((v) => !v)}
                  title="כבה אם אתה מנהל טיול בלבד עבור אחרים"
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    adminParticipates ? "bg-[var(--gold-500)]" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      adminParticipates ? "translate-x-[-22px]" : "translate-x-[-2px]"
                    }`}
                  />
                </button>
              </div>

              {/* Conditional markup (friends / client) */}
              <AnimatePresence initial={false}>
                {(tripType === "friends" || tripType === "client") && (
                  <motion.div
                    key="markup-fields"
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-[var(--gold-500)]/30 bg-[var(--gold-500)]/5 p-3 space-y-3">
                      <div className="text-[10px] uppercase tracking-[0.2em] font-serif italic text-[var(--gold-200)]">
                        תמחור ורווח
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>סוג רווח</Label>
                          <Select
                            value={markupType}
                            onValueChange={(v) => setMarkupType(v as MarkupType)}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {(v: unknown) => {
                                  const map: Record<MarkupType, string> = {
                                    none: "ללא",
                                    percent: "אחוזים",
                                    fixed: "סכום קבוע",
                                  };
                                  return map[(v as MarkupType) ?? "none"] ?? "ללא";
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">ללא</SelectItem>
                              <SelectItem value="percent">אחוזים (%)</SelectItem>
                              <SelectItem value="fixed">סכום קבוע (₪)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>ערך</Label>
                          <Input
                            type="number"
                            min={0}
                            max={markupType === "percent" ? 100 : undefined}
                            step="0.01"
                            disabled={markupType === "none"}
                            placeholder={
                              markupType === "percent"
                                ? "למשל 10 (=10%)"
                                : markupType === "fixed"
                                ? "למשל 500 ₪"
                                : "בחר סוג רווח"
                            }
                            value={markupValue}
                            onChange={(e) => setMarkupValue(e.target.value)}
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label>סוג חג</Label>
                <Select
                  value={holidayType}
                  onValueChange={(v) => setHolidayType(v as HolidayType)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(v: unknown) => HOLIDAY_LABELS[v as HolidayType] ?? "טיול רגיל"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">טיול רגיל</SelectItem>
                    <SelectItem value="pesach">פסח</SelectItem>
                    <SelectItem value="sukkot">סוכות</SelectItem>
                    <SelectItem value="rosh_hashana">ראש השנה</SelectItem>
                    <SelectItem value="shavuot">שבועות</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>תאריך התחלה</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>תאריך סיום</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    dir="ltr"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "יוצר..." : "צור טיול"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          {pendingInvites.map((inv) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-2xl border border-[var(--gold-500)]/40 bg-gradient-to-l from-[var(--gold-500)]/10 via-background to-background p-5 shadow-lg"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] font-serif italic text-[var(--gold-200)]">
                    <Sparkles className="h-3 w-3" />
                    הזמנה חדשה לטיול
                  </div>
                  <h3 className="font-serif text-xl md:text-2xl font-bold leading-tight">
                    {inv.trip?.name || "טיול"}
                  </h3>
                  <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                    {inv.trip?.destination && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {inv.trip.destination}
                      </span>
                    )}
                    {inv.trip?.start_date && inv.trip?.end_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(inv.trip.start_date).toLocaleDateString("he-IL")} — {new Date(inv.trip.end_date).toLocaleDateString("he-IL")}
                      </span>
                    )}
                    {inv.inviter?.full_name && (
                      <span className="opacity-80">מאת {inv.inviter.full_name}</span>
                    )}
                  </p>
                  {inv.message && (
                    <blockquote className="mt-2 text-xs italic px-3 py-2 border-r-2 border-[var(--gold-500)] bg-[var(--gold-500)]/5 rounded">
                      {inv.message}
                    </blockquote>
                  )}
                </div>
                <Button
                  onClick={() => acceptInvite(inv.token)}
                  disabled={acceptingToken === inv.token}
                  className="rounded-full gradient-gold text-white border-0 h-11 px-6 shrink-0 shadow-[0_4px_20px_-6px_rgba(212,169,96,0.6)]"
                >
                  {acceptingToken === inv.token ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="ml-1.5 h-4 w-4" />
                      אשר הצטרפות
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Active Trips */}
      {activeTrips.length === 0 && pastTrips.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Plane className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {canCreateTrip ? (
              <>
                <h3 className="text-lg font-semibold mb-2 font-serif">עדיין אין טיולים</h3>
                <p className="text-muted-foreground mb-4">
                  צור את הטיול הראשון שלך ותתחיל לתכנן!
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="ml-2 h-4 w-4" />
                  טיול חדש
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-2 font-serif">עדיין לא הוזמנת לטיול</h3>
                <p className="text-muted-foreground text-sm">
                  ברגע שמנהל טיול יזמין אותך באימייל, הטיול יופיע כאן.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {activeTrips.length > 0 && (
            <div className="space-y-6">
              <FadeUp delay={0.2}>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-[var(--gold-500)]/30 max-w-[48px]" />
                  <h2 className="text-[11px] uppercase tracking-[0.28em] font-serif italic text-[var(--gold-200)]">
                    טיולים פעילים
                  </h2>
                  <span className="h-px flex-1 bg-[var(--gold-500)]/30" />
                </div>
              </FadeUp>

              {/* Cover Story — first upcoming trip as magazine cover */}
              <CoverStoryCard trip={activeTrips[0]} />

              {/* Remaining trips in grid */}
              {activeTrips.length > 1 && (
                <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" delay={0.3}>
                  {activeTrips.slice(1).map((trip) => (
                    <StaggerItem key={trip.id}>
                      <HoverScale>
                        <TripCard trip={trip} />
                      </HoverScale>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </div>
          )}

          {pastTrips.length > 0 && (
            <div className="space-y-4">
              <FadeUp delay={0.4}>
                <h2 className="text-lg font-semibold text-muted-foreground">
                  טיולים קודמים
                </h2>
              </FadeUp>
              <StaggerContainer className="grid gap-4 md:grid-cols-2" delay={0.5}>
                {pastTrips.map((trip) => (
                  <StaggerItem key={trip.id}>
                    <HoverScale>
                      <TripCard trip={trip} />
                    </HoverScale>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip & { role: string } }) {
  const status = STATUS_LABELS[trip.status as TripStatus];
  const daysCount = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const holidayEmoji: Record<string, string> = {
    pesach: "🫓", sukkot: "🌿", rosh_hashana: "🍎", shavuot: "🥛", regular: "✈️"
  };

  // Destination image map
  const destImages: Record<string, string> = {
    מונטנגרו: "https://images.unsplash.com/photo-1596627116790-af6f46dddbae?w=600&q=75",
    רומא: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=75",
    אתונה: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=600&q=75",
  };
  const heroImage = Object.keys(destImages).find((k) => trip.destination.includes(k))
    ? destImages[Object.keys(destImages).find((k) => trip.destination.includes(k))!]
    : null;

  return (
    <a href={`/trip/${trip.id}`} className="block group">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1">
        {/* Hero image with overlay */}
        <div className="relative h-40 overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage}
              alt={trip.destination}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full gradient-blue" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-0 p-4 flex flex-col justify-between text-white">
            <div className="flex items-start justify-between">
              <span className="text-3xl drop-shadow-lg">{holidayEmoji[trip.holiday_type] || "✈️"}</span>
              <Badge className={`${status.color} border-0 text-xs backdrop-blur-sm`}>
                {status.label}
              </Badge>
            </div>
            <div>
              <h3 className="text-xl font-bold drop-shadow-lg">{trip.name}</h3>
              <p className="text-white/90 text-sm flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {trip.destination}
              </p>
            </div>
          </div>
        </div>
        {/* Info pills */}
        <div className="px-4 pt-4 flex gap-2">
          <div className="glass rounded-xl px-3 py-2 text-center flex-1">
            <div className="text-lg font-bold text-blue-400">{daysCount}</div>
            <div className="text-[10px] text-muted-foreground">ימים</div>
          </div>
          <div className="glass rounded-xl px-3 py-2 text-center flex-1">
            <div className="text-lg font-bold text-purple-400">
              {HOLIDAY_LABELS[trip.holiday_type as HolidayType]}
            </div>
            <div className="text-[10px] text-muted-foreground">סוג</div>
          </div>
        </div>
        {/* Footer */}
        <div className="p-4 pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(trip.start_date).toLocaleDateString("he-IL")} — {new Date(trip.end_date).toLocaleDateString("he-IL")}
          </span>
          <ArrowLeft className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </a>
  );
}

function CoverStoryCard({ trip }: { trip: Trip & { role: string } }) {
  const status = STATUS_LABELS[trip.status as TripStatus];
  const daysCount = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
      (1000 * 60 * 60 * 24)
  ) + 1;
  const daysUntil = Math.ceil(
    (new Date(trip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const holidayEmoji: Record<string, string> = {
    pesach: "🫓",
    sukkot: "🌿",
    rosh_hashana: "🍎",
    shavuot: "🥛",
    regular: "✈️",
  };

  const destImages: Record<string, string> = {
    מונטנגרו: "https://images.unsplash.com/photo-1596627116790-af6f46dddbae?w=1600&q=80",
    רומא: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1600&q=80",
    אתונה: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=1600&q=80",
  };
  const matchedKey = Object.keys(destImages).find((k) => trip.destination.includes(k));
  const heroImage = matchedKey ? destImages[matchedKey] : null;

  return (
    <a href={`/trip/${trip.id}`} className="block group">
      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -3 }}
        className="relative h-[56vh] min-h-[380px] md:min-h-[440px] rounded-3xl overflow-hidden border border-[var(--gold-500)]/15 hover:border-[var(--gold-500)]/40 shadow-2xl shadow-black/50 transition-all"
      >
        <div className="absolute inset-0 overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage}
              alt={trip.destination}
              className="w-full h-full object-cover animate-ken-burns group-hover:scale-[1.05] transition-transform duration-1000"
            />
          ) : (
            <div className="w-full h-full gradient-gold" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />
        <div className="noise-overlay absolute inset-0 pointer-events-none" />

        {/* Masthead */}
        <div className="absolute top-5 right-6 left-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-serif italic opacity-80">
            <span className="h-px w-8 bg-[var(--gold-500)]" />
            הטיול הקרוב
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl drop-shadow-lg">{holidayEmoji[trip.holiday_type] || "✈️"}</span>
            <Badge className={`${status.color} border-0 text-[10px] backdrop-blur-sm`}>
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Body */}
        <div className="absolute bottom-0 right-0 left-0 p-6 md:p-10 text-white">
          <h3
            className="font-serif font-black leading-[0.95] tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)" }}
          >
            {trip.name}
          </h3>
          <p className="mt-2 text-sm md:text-base text-white/85 flex items-center gap-2 font-serif">
            <MapPin className="h-4 w-4" />
            {trip.destination}
          </p>

          {/* Editorial stats */}
          <div className="mt-5 flex items-stretch gap-4 pt-4 border-t border-[var(--gold-500)]/40">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--gold-200)]/70 font-serif italic mb-1">
                {daysUntil > 0 ? "עד יציאה" : daysUntil === 0 ? "היום!" : "בעיצומו"}
              </div>
              <div className="font-display font-bold tabular-nums text-xl md:text-2xl">
                {daysUntil > 0 ? `${daysUntil} ימים` : daysUntil === 0 ? "—" : `${Math.abs(daysUntil)}ד׳`}
              </div>
            </div>
            <div className="w-px bg-[var(--gold-500)]/30" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--gold-200)]/70 font-serif italic mb-1">
                משך
              </div>
              <div className="font-display font-bold tabular-nums text-xl md:text-2xl">{daysCount} ימים</div>
            </div>
            <div className="w-px bg-[var(--gold-500)]/30" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--gold-200)]/70 font-serif italic mb-1">
                תחילה
              </div>
              <div className="font-display font-bold text-xs md:text-sm">
                {new Date(trip.start_date).toLocaleDateString("he-IL", {
                  day: "numeric",
                  month: "short",
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </a>
  );
}

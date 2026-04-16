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
} from "lucide-react";
import { toast } from "sonner";
import type { Profile, Trip, HolidayType, TripStatus } from "@/lib/supabase/types";
import { generateTripDays } from "@/lib/hebrew-calendar";

const STATUS_LABELS: Record<TripStatus, { label: string; color: string }> = {
  planning: { label: "בתכנון", color: "bg-yellow-100 text-yellow-800" },
  active: { label: "פעיל", color: "bg-green-100 text-green-800" },
  completed: { label: "הסתיים", color: "bg-gray-100 text-gray-800" },
  review: { label: "הפקת לקחים", color: "bg-blue-100 text-blue-800" },
};

const HOLIDAY_LABELS: Record<HolidayType, string> = {
  pesach: "פסח",
  sukkot: "סוכות",
  rosh_hashana: "ראש השנה",
  shavuot: "שבועות",
  regular: "טיול רגיל",
};

interface DashboardContentProps {
  profile: Profile | null;
  trips: (Trip & { role: string })[];
  userId: string;
}

export function DashboardContent({ profile, trips, userId }: DashboardContentProps) {
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
    router.push(`/trip/${trip.id}`);
    router.refresh();
  }

  const activeTrips = trips.filter((t) => t.status !== "completed");
  const pastTrips = trips.filter((t) => t.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">שלום {profile?.full_name}!</h1>
          <p className="text-muted-foreground">הטיולים שלך</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={<Button><Plus className="ml-2 h-4 w-4" />טיול חדש</Button>}
          />
          <DialogContent className="max-w-md">
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
              <div className="space-y-2">
                <Label>סוג חג</Label>
                <Select
                  value={holidayType}
                  onValueChange={(v) => setHolidayType(v as HolidayType)}
                >
                  <SelectTrigger>
                    <SelectValue />
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
      </div>

      {/* Active Trips */}
      {activeTrips.length === 0 && pastTrips.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Plane className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">עדיין אין טיולים</h3>
            <p className="text-muted-foreground mb-4">
              צור את הטיול הראשון שלך ותתחיל לתכנן!
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              טיול חדש
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeTrips.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">טיולים פעילים</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {activeTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}

          {pastTrips.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-muted-foreground">
                טיולים קודמים
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {pastTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip & { role: string } }) {
  const status = STATUS_LABELS[trip.status as TripStatus];

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <a href={`/trip/${trip.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{trip.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {trip.destination}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className={status.color}>
                {status.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {HOLIDAY_LABELS[trip.holiday_type as HolidayType]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(trip.start_date).toLocaleDateString("he-IL")} —{" "}
              {new Date(trip.end_date).toLocaleDateString("he-IL")}
            </span>
            <ArrowLeft className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </a>
    </Card>
  );
}

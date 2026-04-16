"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function InvitePage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const router = useRouter();
  const supabase = createClient();

  const [trip, setTrip] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: tripData } = await supabase
        .from("trips")
        .select("name, destination, start_date, end_date, holiday_type")
        .eq("id", tripId)
        .single();
      setTrip(tripData);

      if (user) {
        const { data: existing } = await supabase
          .from("trip_participants")
          .select("id")
          .eq("trip_id", tripId)
          .eq("profile_id", user.id)
          .single();
        if (existing) setAlreadyJoined(true);
      }

      setLoading(false);
    }
    load();
  }, [tripId]);

  async function handleJoin() {
    if (!user) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/invite/${tripId}`);
      return;
    }

    setJoining(true);
    const { error } = await supabase.from("trip_participants").insert({
      trip_id: tripId,
      profile_id: user.id,
      adults,
      children,
    });

    if (error) {
      toast.error("שגיאה בהצטרפות");
      setJoining(false);
      return;
    }

    toast.success("הצטרפת לטיול!");
    router.push(`/trip/${tripId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">הטיול לא נמצא</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Plane className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>{trip.name}</CardTitle>
          <CardDescription>
            {trip.destination} ·{" "}
            {new Date(trip.start_date).toLocaleDateString("he-IL")} —{" "}
            {new Date(trip.end_date).toLocaleDateString("he-IL")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alreadyJoined ? (
            <div className="text-center space-y-4">
              <Check className="h-12 w-12 text-green-600 mx-auto" />
              <p className="font-semibold">כבר הצטרפת לטיול הזה!</p>
              <Button onClick={() => router.push(`/trip/${tripId}`)} className="w-full">
                מעבר לטיול
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                הוזמנת להצטרף לטיול!
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>מבוגרים</Label>
                  <Input
                    type="number"
                    min="1"
                    value={adults}
                    onChange={(e) => setAdults(parseInt(e.target.value))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ילדים</Label>
                  <Input
                    type="number"
                    min="0"
                    value={children}
                    onChange={(e) => setChildren(parseInt(e.target.value))}
                    dir="ltr"
                  />
                </div>
              </div>
              <Button onClick={handleJoin} className="w-full" disabled={joining}>
                {joining ? (
                  <><Loader2 className="ml-2 h-4 w-4 animate-spin" />מצטרף...</>
                ) : user ? (
                  "הצטרף לטיול"
                ) : (
                  "התחבר כדי להצטרף"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

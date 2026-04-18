import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { ItineraryClient } from "./itinerary-client";
import type { TripDay, Meal } from "@/lib/supabase/types";

export default async function ItineraryDayPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>;
}) {
  const { id: tripId, dayId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tripRes, dayRes, mealsRes, allDaysRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("trip_days").select("*").eq("id", dayId).single(),
    supabase.from("meals").select("*").eq("trip_day_id", dayId),
    supabase
      .from("trip_days")
      .select("id, date, hebrew_date, day_type")
      .eq("trip_id", tripId)
      .order("date", { ascending: true }),
  ]);

  if (!tripRes.data || !dayRes.data) notFound();

  return (
    <AppShell>
      <ItineraryClient
        trip={tripRes.data}
        day={dayRes.data as TripDay}
        meals={(mealsRes.data ?? []) as Meal[]}
        allDays={allDaysRes.data ?? []}
      />
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { TripOverview } from "./trip-overview";
import { findDestination } from "@/lib/destinations";
import { getExchangeRate } from "@/lib/currency";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) redirect("/dashboard");

  const { data: participants } = await supabase
    .from("trip_participants")
    .select("*, profile:profiles(*)")
    .eq("trip_id", id);

  const { data: days } = await supabase
    .from("trip_days")
    .select("*")
    .eq("trip_id", id)
    .order("date", { ascending: true });

  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .in("trip_day_id", (days || []).map((d: any) => d.id))
    .order("meal_type", { ascending: true });

  const mealIds = (meals || []).map((m: any) => m.id);
  const { data: mealItems } = mealIds.length > 0
    ? await supabase
        .from("meal_items")
        .select("*")
        .in("meal_id", mealIds)
    : { data: [] };

  const { data: equipment } = await supabase
    .from("trip_equipment")
    .select("*")
    .eq("trip_id", id);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, payer:profiles!paid_by(*)")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });

  const { data: shopping } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("trip_id", id);

  const { data: lessons } = await supabase
    .from("lessons_learned")
    .select("*")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });

  // Files (may not exist yet - table created later)
  let files: any[] = [];
  try {
    const { data: filesData } = await supabase
      .from("trip_files")
      .select("*")
      .eq("trip_id", id)
      .order("created_at", { ascending: false });
    files = filesData || [];
  } catch {}

  // Destination info + live currency rates
  const destination = findDestination(trip.destination, trip.country_code);
  let rates: Record<string, number> | null = null;
  if (destination) {
    const exchange = await getExchangeRate("ILS", [destination.currency, "USD", "EUR"]);
    rates = exchange?.rates || null;
  }

  return (
    <AppShell userName={profile?.full_name}>
      <TripOverview
        trip={trip}
        participants={participants || []}
        days={days || []}
        meals={meals || []}
        mealItems={mealItems || []}
        equipment={equipment || []}
        expenses={expenses || []}
        shopping={shopping || []}
        lessons={lessons || []}
        files={files}
        destination={destination}
        rates={rates}
        userId={user.id}
      />
    </AppShell>
  );
}

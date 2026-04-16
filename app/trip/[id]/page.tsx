import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { TripOverview } from "./trip-overview";
import { findDestination } from "@/lib/destinations";
import { getOrGenerateDestination } from "@/lib/destination-generator";
import { getExchangeRate } from "@/lib/currency";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Trip + profile first (needed for everything else)
  const [profileRes, tripRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("trips").select("*").eq("id", id).single(),
  ]);

  const profile = profileRes.data;
  const trip = tripRes.data;

  if (!trip) redirect("/dashboard");

  // All parallel queries — massive speed improvement
  const [
    participantsRes,
    daysRes,
    equipmentRes,
    expensesRes,
    shoppingRes,
    lessonsRes,
    filesRes,
    permissionsRes,
    expensePayersRes,
  ] = await Promise.all([
    supabase.from("trip_participants").select("*, profile:profiles(*)").eq("trip_id", id),
    supabase.from("trip_days").select("*").eq("trip_id", id).order("date", { ascending: true }),
    supabase.from("trip_equipment").select("*").eq("trip_id", id),
    supabase
      .from("expenses")
      .select("*, payer:profiles!paid_by(*)")
      .eq("trip_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("shopping_items").select("*").eq("trip_id", id),
    supabase
      .from("lessons_learned")
      .select("*")
      .eq("trip_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("trip_files")
      .select("*")
      .eq("trip_id", id)
      .order("created_at", { ascending: false })
      .then((r) => r, () => ({ data: [] })),
    supabase
      .from("trip_permissions")
      .select("*")
      .eq("trip_id", id)
      .then((r) => r, () => ({ data: [] })),
    supabase
      .from("expense_payers")
      .select("*")
      .then((r) => r, () => ({ data: [] })),
  ]);

  const days = daysRes.data || [];
  const dayIds = days.map((d: any) => d.id);

  // Meals + meal items (depend on days) — still parallel
  const [mealsRes, currencyRes] = await Promise.all([
    dayIds.length > 0
      ? supabase.from("meals").select("*").in("trip_day_id", dayIds).order("meal_type")
      : Promise.resolve({ data: [] }),
    (async () => {
      // Try local DB first (fast), fallback to cache + AI generation
      let destination = findDestination(trip.destination, trip.country_code);
      if (!destination) {
        destination = await getOrGenerateDestination(supabase, trip.destination, trip.country_code);
      }
      if (!destination) return { destination: null, rates: null };
      const exchange = await getExchangeRate("ILS", [destination.currency, "USD", "EUR"]);
      return { destination, rates: exchange?.rates || null };
    })(),
  ]);

  const meals = mealsRes.data || [];
  const mealIds = meals.map((m: any) => m.id);
  const { data: mealItems } =
    mealIds.length > 0
      ? await supabase.from("meal_items").select("*").in("meal_id", mealIds)
      : { data: [] };

  return (
    <AppShell userName={profile?.full_name}>
      <TripOverview
        trip={trip}
        participants={participantsRes.data || []}
        days={days}
        meals={meals}
        mealItems={mealItems || []}
        equipment={equipmentRes.data || []}
        expenses={expensesRes.data || []}
        expensePayers={expensePayersRes.data || []}
        shopping={shoppingRes.data || []}
        lessons={lessonsRes.data || []}
        files={filesRes.data || []}
        destination={currencyRes.destination}
        rates={currencyRes.rates}
        permissions={permissionsRes.data || []}
        userId={user.id}
      />
    </AppShell>
  );
}

import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { PlanClient } from "./plan-client";
import type { TripDay } from "@/lib/supabase/types";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tripRes, daysRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", tripId)
      .order("date", { ascending: true }),
  ]);

  if (!tripRes.data) notFound();

  return (
    <AppShell>
      <PlanClient trip={tripRes.data} initialDays={(daysRes.data ?? []) as TripDay[]} />
    </AppShell>
  );
}

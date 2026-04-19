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

  const [tripRes, daysRes, snapsRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", tripId)
      .order("date", { ascending: true }),
    supabase
      .from("plan_snapshots")
      .select("id, created_at, label, total_items")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!tripRes.data) notFound();

  return (
    <AppShell>
      <PlanClient
        trip={tripRes.data}
        initialDays={(daysRes.data ?? []) as TripDay[]}
        snapshots={(snapsRes.data ?? []) as Array<{ id: string; created_at: string; label: string | null; total_items: number | null }>}
      />
    </AppShell>
  );
}

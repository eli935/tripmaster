import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: participations } = await supabase
    .from("trip_participants")
    .select(`
      *,
      trip:trips(*)
    `)
    .eq("profile_id", user.id)
    .order("joined_at", { ascending: false });

  const trips = participations?.map((p: any) => ({
    ...p.trip,
    role: p.role,
  })) || [];

  return (
    <AppShell userName={profile?.full_name}>
      <DashboardContent
        profile={profile}
        trips={trips}
        userId={user.id}
      />
    </AppShell>
  );
}

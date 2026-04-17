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

  // First-time login: redirect to /onboarding if family composition missing.
  // Allow super_admin (Eli) to bypass so he can still reach the dashboard to create trips.
  const needsOnboarding =
    !profile || profile.full_name === null || profile.children === null;
  if (needsOnboarding && !profile?.is_super_admin) {
    redirect("/onboarding?next=/dashboard");
  }

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

  // Pending invitations addressed to this user's email (RLS filters to invitee's email).
  const { data: pendingInvites } = await supabase
    .from("trip_invitations")
    .select("id, token, trip_id, message, expires_at, trip:trips(name, destination, start_date, end_date), inviter:profiles!invited_by(full_name)")
    .eq("status", "pending")
    .eq("email", (user.email || "").toLowerCase())
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Non-admin with exactly one trip → take them directly there.
  const canCreateTrip =
    !!profile?.is_super_admin ||
    trips.some((t: any) => t.role === "admin");

  if (!canCreateTrip && trips.length === 1 && (pendingInvites?.length || 0) === 0) {
    redirect(`/trip/${trips[0].id}`);
  }

  return (
    <AppShell userName={profile?.full_name}>
      <DashboardContent
        profile={profile}
        trips={trips}
        userId={user.id}
        canCreateTrip={canCreateTrip}
        pendingInvites={(pendingInvites as any) || []}
      />
    </AppShell>
  );
}

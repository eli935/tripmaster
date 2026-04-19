import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { LandingPage } from "./landing-page";

export default async function Home() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-[color:var(--background)]" />}>
      <LandingPage />
    </Suspense>
  );
}

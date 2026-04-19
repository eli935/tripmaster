import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { LandingPage } from "./landing-page";

export default async function Home() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
  return <LandingPage />;
}

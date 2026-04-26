import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except public routes)
  const publicRoutes = ["/login", "/auth/callback", "/invite", "/no-access"];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute && request.nextUrl.pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Trip-window access gate: a logged-in non-super_admin user may only access
  // /dashboard, /trip/*, /profile, etc. if they have at least one trip whose
  // end_date is today-7d or later (planning, active, or recently completed).
  // Profile is exempt so they can still update phone/password if they need to.
  const gatedPrefixes = ["/dashboard", "/trip"];
  const isGated = gatedPrefixes.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );
  if (user && isGated) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_super_admin) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffIso = cutoff.toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from("trip_participants")
        .select("trip_id, trip:trips!inner(end_date)")
        .eq("profile_id", user.id)
        .gte("trip.end_date", cutoffIso)
        .limit(1);
      if (!rows || rows.length === 0) {
        const url = request.nextUrl.clone();
        url.pathname = "/no-access";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Only run on auth-sensitive routes; skip static assets, API (handles own auth),
    // public pages (login/invite/auth), and images/manifest.
    "/((?!_next/|api/|login|onboarding|auth|invite|favicon|manifest|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendLeadNotificationEmail } from "@/lib/mailer";

export const runtime = "nodejs";

interface LeadBody {
  name?: string;
  email?: string;
  phone?: string;
  destination?: string;
  travel_dates?: string;
  adults?: number;
  children?: number;
  message?: string;
  locale?: "he" | "en";
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as LeadBody;

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const destination = (body.destination ?? "").trim();
  const phone = (body.phone ?? "").trim() || null;
  const travel_dates = (body.travel_dates ?? "").trim() || null;
  const adults = typeof body.adults === "number" && body.adults > 0 ? Math.floor(body.adults) : 2;
  const children = typeof body.children === "number" && body.children >= 0 ? Math.floor(body.children) : 0;
  const message = (body.message ?? "").trim() || null;
  const locale = body.locale === "en" ? "en" : "he";

  // Basic validation
  if (!name || !email || !destination) {
    return NextResponse.json(
      { error: locale === "en" ? "Name, email, and destination are required" : "נדרשים שם, אימייל ויעד" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: locale === "en" ? "Invalid email" : "אימייל לא תקין" },
      { status: 400 }
    );
  }
  if (name.length > 120 || email.length > 200 || destination.length > 200) {
    return NextResponse.json({ error: "field too long" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const userAgent = req.headers.get("user-agent") ?? null;
  const referrer = req.headers.get("referer") ?? null;

  const { error: insertErr } = await supabase.from("leads").insert({
    name,
    email,
    phone,
    destination,
    travel_dates,
    adults,
    children,
    message,
    locale,
    user_agent: userAgent,
    referrer,
  });

  if (insertErr) {
    console.error("[leads] insert failed", insertErr);
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }

  // Send email to admin — failures are non-fatal, lead is already saved.
  const mailResult = await sendLeadNotificationEmail({
    name,
    email,
    phone: phone ?? undefined,
    destination,
    travelDates: travel_dates ?? undefined,
    adults,
    children,
    message: message ?? undefined,
    locale,
  });

  return NextResponse.json({
    ok: true,
    email_sent: mailResult.ok,
  });
}

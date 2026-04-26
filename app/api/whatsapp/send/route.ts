import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendWhatsAppBulk, type WhatsAppMessage } from "@/lib/whatsapp";

/**
 * POST /api/whatsapp/send
 * Send a WhatsApp message to trip participants.
 * Body: { tripId, message } or { tripId, template, templateData }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tripId, message } = body;

  if (!tripId || !message) {
    return NextResponse.json({ error: "Missing tripId or message" }, { status: 400 });
  }

  // Verify user is admin of this trip
  const { data: participant } = await supabase
    .from("trip_participants")
    .select("role")
    .eq("trip_id", tripId)
    .eq("profile_id", user.id)
    .single();

  if (!participant || participant.role !== "admin") {
    return NextResponse.json({ error: "Only admins can send messages" }, { status: 403 });
  }

  // Get all participants with phone numbers
  const { data: participants } = await supabase
    .from("trip_participants")
    .select("profile:profiles(phone)")
    .eq("trip_id", tripId);

  const messages: WhatsAppMessage[] = (participants || [])
    .map((p: any) => p.profile?.phone)
    .filter((phone: string | null): phone is string => !!phone && phone.length > 5)
    .map((phone: string) => ({
      to: phone.replace(/[^0-9]/g, ""),
      text: message,
    }));

  if (messages.length === 0) {
    return NextResponse.json({ error: "No participants with phone numbers" }, { status: 400 });
  }

  const result = await sendWhatsAppBulk(messages);

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    reasons: result.reasons,
    total: messages.length,
  });
}

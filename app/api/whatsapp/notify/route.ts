import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  sendWhatsAppBulk,
  msgParticipantJoined,
  msgExpenseAdded,
  type WhatsAppMessage,
} from "@/lib/whatsapp";

/**
 * POST /api/whatsapp/notify
 * Automated notifications triggered by app events.
 * Body: { type, tripId, data }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, tripId, data } = body;

  // Get trip info
  const { data: trip } = await supabase
    .from("trips")
    .select("name")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // Get participant phones
  const { data: participants } = await supabase
    .from("trip_participants")
    .select("profile_id, profile:profiles(phone, full_name)")
    .eq("trip_id", tripId);

  const phones = (participants || [])
    .filter((p: any) => p.profile?.phone && p.profile_id !== user.id)
    .map((p: any) => p.profile.phone.replace(/[^0-9]/g, ""));

  let message = "";

  switch (type) {
    case "participant_joined": {
      const totalPeople = data?.totalPeople || 0;
      const familyName = data?.familyName || "משפחה חדשה";
      message = msgParticipantJoined(trip.name, familyName, totalPeople);
      break;
    }
    case "expense_added": {
      message = msgExpenseAdded(
        trip.name,
        data?.payerName || "מישהו",
        data?.amount || 0,
        data?.description || ""
      );
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown notification type" }, { status: 400 });
  }

  const messages: WhatsAppMessage[] = phones
    .filter((p: string) => p.length > 5)
    .map((phone: string) => ({ to: phone, text: message }));

  const sent = await sendWhatsAppBulk(messages);
  return NextResponse.json({ sent, total: messages.length });
}

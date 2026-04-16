/**
 * WhatsApp messaging abstraction.
 * Supports two backends:
 *   1. Baileys (self-hosted, existing bot infrastructure)
 *   2. Twilio WhatsApp API (cloud, paid)
 *
 * Set WHATSAPP_PROVIDER=baileys|twilio in .env
 * For Baileys: WHATSAPP_BOT_URL=http://localhost:3001/api/send
 * For Twilio:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 */

export interface WhatsAppMessage {
  to: string; // phone number with country code, e.g. "972501234567"
  text: string;
}

export async function sendWhatsAppMessage(msg: WhatsAppMessage): Promise<boolean> {
  const provider = process.env.WHATSAPP_PROVIDER || "baileys";

  try {
    if (provider === "twilio") {
      return await sendViaTwilio(msg);
    } else {
      return await sendViaBaileys(msg);
    }
  } catch (error) {
    console.error("[WhatsApp] Send failed:", error);
    return false;
  }
}

export async function sendWhatsAppBulk(messages: WhatsAppMessage[]): Promise<number> {
  let sent = 0;
  for (const msg of messages) {
    const ok = await sendWhatsAppMessage(msg);
    if (ok) sent++;
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }
  return sent;
}

async function sendViaBaileys(msg: WhatsAppMessage): Promise<boolean> {
  const botUrl = process.env.WHATSAPP_BOT_URL || "http://localhost:3001/api/send";

  const res = await fetch(botUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: msg.to,
      message: msg.text,
    }),
  });

  return res.ok;
}

async function sendViaTwilio(msg: WhatsAppMessage): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!; // e.g. "whatsapp:+14155238886"

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: from,
    To: `whatsapp:+${msg.to}`,
    Body: msg.text,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  return res.ok;
}

// ========= Message Templates =========

export function msgParticipantJoined(tripName: string, familyName: string, totalPeople: number): string {
  return `🎉 *${familyName}* הצטרפו לטיול *${tripName}*!\nכרגע ${totalPeople} נפשות בטיול.`;
}

export function msgParticipantLeft(tripName: string, familyName: string): string {
  return `👋 *${familyName}* עזבו את הטיול *${tripName}*.`;
}

export function msgExpenseAdded(
  tripName: string,
  payerName: string,
  amount: number,
  description: string
): string {
  return `💰 *${payerName}* שילם/ה ₪${amount.toLocaleString()} עבור *${description}*\nטיול: ${tripName}`;
}

export function msgDailySummary(
  tripName: string,
  dayDate: string,
  dayType: string,
  mealCount: number,
  totalPeople: number
): string {
  return `📋 *סיכום יומי — ${tripName}*\n📅 ${dayDate} (${dayType})\n🍽️ ${mealCount} ארוחות · ${totalPeople} נפשות`;
}

export function msgEquipmentReminder(tripName: string, daysLeft: number): string {
  return `🎒 *תזכורת ציוד!*\nנשארו ${daysLeft} ימים עד הטיול *${tripName}*.\nבדקו את רשימת הציוד באפליקציה ✅`;
}

export function msgShoppingReminder(tripName: string, itemCount: number): string {
  return `🛒 *רשימת קניות — ${tripName}*\nנותרו ${itemCount} פריטים לקנייה.\nפתחו את האפליקציה לסימון מה נקנה.`;
}

export function msgTripInvite(tripName: string, inviteUrl: string): string {
  return `✈️ הוזמנת לטיול *${tripName}*!\nלהצטרפות: ${inviteUrl}`;
}

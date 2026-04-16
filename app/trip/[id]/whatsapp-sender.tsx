"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  msgEquipmentReminder,
  msgShoppingReminder,
  msgTripInvite,
} from "@/lib/whatsapp";

interface WhatsAppSenderProps {
  tripId: string;
  tripName: string;
  participantCount: number;
  remainingShoppingItems: number;
  daysUntilTrip: number;
  isAdmin: boolean;
}

export function WhatsAppSender({
  tripId,
  tripName,
  participantCount,
  remainingShoppingItems,
  daysUntilTrip,
  isAdmin,
}: WhatsAppSenderProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isAdmin) return null;

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);

    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, message }),
    });

    const data = await res.json();
    setSending(false);

    if (res.ok) {
      toast.success(`נשלח ל-${data.sent} מתוך ${data.total} משתתפים`);
      setMessage("");
    } else {
      toast.error(data.error || "שגיאה בשליחה");
    }
  }

  function useTemplate(template: string) {
    setMessage(template);
  }

  function copyInviteMessage() {
    const inviteUrl = `${window.location.origin}/invite/${tripId}`;
    const msg = msgTripInvite(tripName, inviteUrl);
    navigator.clipboard.writeText(msg);
    setCopied(true);
    toast.success("הודעת הזמנה הועתקה!");
    setTimeout(() => setCopied(false), 2000);
  }

  const templates = [
    {
      label: "תזכורת ציוד",
      text: msgEquipmentReminder(tripName, daysUntilTrip),
      show: daysUntilTrip > 0,
    },
    {
      label: "תזכורת קניות",
      text: msgShoppingReminder(tripName, remainingShoppingItems),
      show: remainingShoppingItems > 0,
    },
  ].filter((t) => t.show);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-400" />
          WhatsApp
        </CardTitle>
        <CardDescription>שלח הודעות למשתתפים ({participantCount})</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick Templates */}
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button
              key={t.label}
              variant="outline"
              size="sm"
              onClick={() => useTemplate(t.text)}
              className="text-xs"
            >
              {t.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={copyInviteMessage}
            className="text-xs"
          >
            {copied ? <Check className="ml-1 h-3 w-3" /> : <Copy className="ml-1 h-3 w-3" />}
            העתק הזמנה
          </Button>
        </div>

        {/* Message input */}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="כתוב הודעה לכל המשתתפים..."
          rows={3}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {sending ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="ml-2 h-4 w-4" />
          )}
          {sending ? "שולח..." : "שלח בוואטסאפ"}
        </Button>
      </CardContent>
    </Card>
  );
}

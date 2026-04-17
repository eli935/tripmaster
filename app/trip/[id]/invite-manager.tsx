"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Mail,
  Copy,
  Check,
  Loader2,
  Trash2,
  RotateCw,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface InviteManagerProps {
  tripId: string;
  tripName: string;
}

interface Invitation {
  id: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  message: string | null;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
}

export function InviteManager({ tripId, tripName }: InviteManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadInvitations() {
    const { data } = await supabase
      .from("trip_invitations")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    if (data) setInvitations(data as Invitation[]);
  }

  useEffect(() => {
    loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    const res = await fetch("/api/invite/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_id: tripId,
        email: email.trim(),
        message: message.trim() || undefined,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error("שגיאה בשליחת ההזמנה", {
        description: json?.details || json?.error,
      });
      setSending(false);
      return;
    }

    if (json.email_sent) {
      toast.success("הזמנה נשלחה במייל!", {
        description: email,
      });
    } else if (json.email_skipped) {
      toast("ההזמנה נוצרה — אך לא נשלחה במייל", {
        description: "הגדר GMAIL_USER + GMAIL_APP_PASSWORD. העתק את הקישור למטה.",
      });
    } else {
      toast.error("ההזמנה נוצרה אך המייל לא נשלח", {
        description: json.email_error || "שגיאת SMTP",
      });
    }

    setEmail("");
    setMessage("");
    setSending(false);
    await loadInvitations();
  }

  function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/invite/accept/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("הקישור הועתק");
    setTimeout(() => setCopiedId(null), 2500);
  }

  async function cancelInvitation(id: string) {
    const { error } = await supabase
      .from("trip_invitations")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast.error("שגיאה בביטול");
    } else {
      toast.success("ההזמנה בוטלה");
      loadInvitations();
    }
  }

  async function resendInvitation(inv: Invitation) {
    const res = await fetch("/api/invite/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_id: tripId,
        email: inv.email,
      }),
    });
    const json = await res.json();
    if (res.ok && json.email_sent) {
      toast.success("נשלח שוב במייל");
    } else if (json.email_skipped) {
      toast("אימייל לא מוגדר — אבל הקישור עודכן");
    } else {
      toast.error("שגיאה בשליחה חוזרת");
    }
    loadInvitations();
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const accepted = invitations.filter((i) => i.status === "accepted");
  const cancelled = invitations.filter(
    (i) => i.status === "cancelled" || i.status === "expired"
  );

  return (
    <div className="space-y-5">
      {/* Invite form */}
      <div className="glass rounded-2xl p-5 border border-[var(--gold-500)]/15 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[var(--gold-500)]" />
          <h3 className="font-serif text-lg font-semibold">הזמנה חדשה</h3>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">אימייל המוזמן</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              required
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">הודעה אישית (אופציונלי)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="למשל: שמח שאתם מצטרפים לטיול הזה!"
              rows={2}
              className="resize-none"
            />
          </div>
          <Button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full h-11 rounded-full gradient-gold text-white border-0 shadow-[0_4px_18px_-6px_rgba(212,169,96,0.55)]"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Mail className="ml-1.5 h-4 w-4" />
                שלח הזמנה
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <Section title="ממתינים לאישור" count={pending.length}>
          <AnimatePresence mode="popLayout">
            {pending.map((inv) => (
              <InvitationRow
                key={inv.id}
                inv={inv}
                copied={copiedId === inv.id}
                onCopy={() => copyLink(inv.token, inv.id)}
                onResend={() => resendInvitation(inv)}
                onCancel={() => cancelInvitation(inv.id)}
              />
            ))}
          </AnimatePresence>
        </Section>
      )}

      {/* Accepted */}
      {accepted.length > 0 && (
        <Section title="הצטרפו" count={accepted.length}>
          {accepted.map((inv) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#5A6B3C]/10 border border-[#5A6B3C]/25"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Check className="h-4 w-4 text-[#C8D5A8] shrink-0" />
                <span className="text-sm truncate" dir="ltr">{inv.email}</span>
              </div>
              {inv.accepted_at && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(inv.accepted_at).toLocaleDateString("he-IL")}
                </span>
              )}
            </motion.div>
          ))}
        </Section>
      )}

      {/* Cancelled/Expired */}
      {cancelled.length > 0 && (
        <details className="opacity-60">
          <summary className="text-xs text-muted-foreground cursor-pointer">
            {cancelled.length} הזמנות ישנות
          </summary>
          <div className="space-y-1.5 mt-2">
            {cancelled.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.02] text-xs"
              >
                <span className="truncate" dir="ltr">{inv.email}</span>
                <Badge variant="outline" className="text-[10px]">
                  {inv.status === "expired" ? "פג תוקף" : "בוטל"}
                </Badge>
              </div>
            ))}
          </div>
        </details>
      )}

      {invitations.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          עדיין לא שלחת הזמנות לטיול הזה
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="h-px flex-1 max-w-[24px] bg-[var(--gold-500)]/30" />
        <h4 className="text-[10px] uppercase tracking-[0.22em] font-serif italic text-[var(--gold-200)]">
          {title}
        </h4>
        <span className="text-[10px] text-muted-foreground font-display">
          {count}
        </span>
        <span className="h-px flex-1 bg-[var(--gold-500)]/30" />
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InvitationRow({
  inv,
  copied,
  onCopy,
  onResend,
  onCancel,
}: {
  inv: Invitation;
  copied: boolean;
  onCopy: () => void;
  onResend: () => void;
  onCancel: () => void;
}) {
  const daysLeft = Math.ceil(
    (new Date(inv.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[var(--gold-500)] shrink-0" />
          <span className="text-sm truncate" dir="ltr">{inv.email}</span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          נותרו {daysLeft} ימים
        </span>
      </div>

      {inv.message && (
        <p className="text-[11px] text-muted-foreground italic truncate font-serif">
          "{inv.message}"
        </p>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={onCopy}
          className="flex-1 h-8 text-xs rounded-lg"
        >
          {copied ? (
            <><Check className="ml-1 h-3 w-3" />הועתק</>
          ) : (
            <><Copy className="ml-1 h-3 w-3" />העתק קישור</>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onResend}
          className="h-8 text-xs rounded-lg"
          title="שלח שוב"
        >
          <RotateCw className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-8 text-xs rounded-lg text-red-400 hover:text-red-400"
          title="בטל"
        >
          <XCircle className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

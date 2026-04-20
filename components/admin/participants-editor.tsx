"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Phone, X, Loader2, Check, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ParticipantRow {
  id: string;
  profile_id: string;
  role: string;
  adults: number;
  children: number;
  profile: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
}

export function ParticipantsEditor({
  tripId,
  participants,
}: {
  tripId: string;
  participants: ParticipantRow[];
}) {
  const [editing, setEditing] = useState<ParticipantRow | null>(null);

  return (
    <Card className="border-[var(--gold-500)]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-[var(--gold-400)]" />
          ניהול פרטי משתתפים
        </CardTitle>
        <CardDescription className="text-xs">
          עריכת שם והזנת טלפון עבור לקוחות. חובה כדי שיקבלו הודעות וואטסאפ יומיות.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-white/5">
          {participants.map((p) => {
            const hasPhone = !!p.profile?.phone && p.profile.phone.replace(/[^\d]/g, "").length >= 9;
            return (
              <li
                key={p.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--gold-100)] truncate">
                      {p.profile?.full_name || "ללא שם"}
                    </span>
                    {p.role === "admin" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gold-500)]/20 text-[var(--gold-200)]">
                        מנהל
                      </span>
                    )}
                    {!hasPhone && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        ללא טלפון
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span dir="ltr">{p.profile?.phone || "—"}</span>
                    <span>·</span>
                    <span>
                      {p.adults} מבוגרים · {p.children} ילדים
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(p)}
                  className="text-xs h-8"
                >
                  <Edit3 className="w-3 h-3 ml-1" />
                  ערוך
                </Button>
              </li>
            );
          })}
          {participants.length === 0 && (
            <li className="py-4 text-center text-xs text-muted-foreground">
              אין משתתפים. הזמן דרך סקשן ההזמנות.
            </li>
          )}
        </ul>
      </CardContent>

      <AnimatePresence>
        {editing && (
          <EditParticipantModal
            key={editing.profile_id}
            tripId={tripId}
            participant={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              // simple refresh — server re-fetches participants
              setTimeout(() => window.location.reload(), 200);
            }}
          />
        )}
      </AnimatePresence>
    </Card>
  );
}

function EditParticipantModal({
  tripId,
  participant,
  onClose,
  onSaved,
}: {
  tripId: string;
  participant: ParticipantRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(participant.profile?.full_name ?? "");
  const [phone, setPhone] = useState(participant.profile?.phone ?? "");
  const [adults, setAdults] = useState(participant.adults);
  const [children, setChildren] = useState(participant.children);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const cleanPhone = phone.trim().replace(/[^\d+]/g, "");
    if (cleanPhone.length < 9) {
      toast.error("טלפון חייב להכיל לפחות 9 ספרות");
      return;
    }
    if (!fullName.trim()) {
      toast.error("שם חובה");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/update-participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          profile_id: participant.profile_id,
          full_name: fullName,
          phone: cleanPhone,
          adults,
          children,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "save failed");
      toast.success("הפרטים עודכנו");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-[var(--card)] rounded-3xl border border-[var(--gold-500)]/30 shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-[var(--gold-100)]">
            עריכת פרטי משתתף
          </h3>
          <button onClick={onClose} className="text-foreground/60 hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>שם מלא *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              <Phone size={12} /> טלפון (וואטסאפ) *
            </Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+972501234567"
              dir="ltr"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              נדרש לקבלת הודעות וואטסאפ יומיות של התוכנית
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>מבוגרים</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                dir="ltr"
              />
            </div>
            <div>
              <Label>ילדים</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-l from-[var(--gold-700)] to-[var(--gold-500)] text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" /> שומר...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 ml-2" /> שמור
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

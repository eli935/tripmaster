"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Users, Calculator, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { Trip, TripParticipant, ExpenseCategory, SplitType } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/expense-calculator";
import { isMultiHouseholdTrip } from "@/lib/participant-utils";
import { getExchangeRate } from "@/lib/currency";
import { EXPENSE_CATEGORIES, SPLIT_TYPES, CURRENCY_LABELS, UNKNOWN_NAME } from "@/lib/i18n-labels";

// EXPENSE_CATEGORIES now imported from @/lib/i18n-labels

interface Payer {
  profile_id: string;
  amount: string;
  name: string;
}

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tripId: string;
  trip: Pick<Trip, "created_by" | "admin_participates">;
  participants: TripParticipant[];
  userId: string;
  isAdmin: boolean;
  currentUserName: string;
}

export function ExpenseDialog({
  open,
  onOpenChange,
  tripId,
  trip,
  participants,
  userId,
  isAdmin,
  currentUserName,
}: ExpenseDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // Single-household mode: no splitting needed, every expense is just recorded.
  const multiHousehold = isMultiHouseholdTrip(participants, trip);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [splitType, setSplitType] = useState<SplitType>(
    multiHousehold ? "per_person" : "private"
  );
  const [currency, setCurrency] = useState<"ILS" | "EUR" | "USD">("ILS");

  // Multi-payer: start with current user
  const [payers, setPayers] = useState<Payer[]>([
    { profile_id: userId, amount: "", name: currentUserName },
  ]);

  const totalAmount = payers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  function addPayer() {
    if (!isAdmin) {
      toast.error("רק מנהל יכול להוסיף משלמים נוספים");
      return;
    }
    // Find a participant not yet in payers
    const taken = payers.map((p) => p.profile_id);
    const available = participants.find((p) => !taken.includes(p.profile_id));
    if (!available) {
      toast.error("כל המשתתפים כבר נוספו");
      return;
    }
    setPayers([
      ...payers,
      {
        profile_id: available.profile_id,
        amount: "",
        name: (available.profile as any)?.full_name || "—",
      },
    ]);
  }

  function removePayer(idx: number) {
    setPayers(payers.filter((_, i) => i !== idx));
  }

  function updatePayer(idx: number, field: keyof Payer, value: string) {
    const updated = [...payers];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "profile_id") {
      const p = participants.find((pp) => pp.profile_id === value);
      updated[idx].name = (p?.profile as any)?.full_name || "—";
    }
    setPayers(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!description.trim()) {
      toast.error("נא למלא תיאור");
      return;
    }
    if (payers.some((p) => !p.amount || parseFloat(p.amount) <= 0)) {
      toast.error("נא למלא סכום חוקי לכל המשלמים");
      return;
    }

    setLoading(true);

    // Main payer = first payer
    const primaryPayer = payers[0];
    const total = totalAmount;

    // Lock FX rate to ILS at moment of creation (historical accuracy)
    let fxRateToIls = 1;
    if (currency !== "ILS") {
      try {
        const rates = await getExchangeRate(currency, ["ILS"]);
        fxRateToIls = rates?.rates?.ILS || (currency === "EUR" ? 4.05 : 3.72);
      } catch {
        fxRateToIls = currency === "EUR" ? 4.05 : 3.72;
      }
    }

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        trip_id: tripId,
        paid_by: primaryPayer.profile_id,
        amount: total,
        currency,
        category,
        description,
        split_type: splitType,
        fx_rate_to_ils: fxRateToIls,
        fx_locked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !expense) {
      toast.error("שגיאה בשמירה", { description: error?.message });
      setLoading(false);
      return;
    }

    // Insert expense_payers (supports multiple payers)
    await supabase.from("expense_payers").insert(
      payers.map((p) => ({
        expense_id: expense.id,
        profile_id: p.profile_id,
        amount: parseFloat(p.amount),
      }))
    );

    // Audit log
    await supabase.from("audit_log").insert({
      trip_id: tripId,
      table_name: "expenses",
      record_id: expense.id,
      action: "insert",
      actor_id: userId,
      new_data: { description, amount: total, payers: payers.map((p) => ({ name: p.name, amount: p.amount })) },
    });

    toast.success("הוצאה נרשמה!");
    setLoading(false);
    onOpenChange(false);
    // Reset
    setDescription("");
    setPayers([{ profile_id: userId, amount: "", name: currentUserName }]);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוספת הוצאה</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "ניתן להוסיף מספר משלמים עם סכומים שונים"
              : "הוספת תשלום שלך להוצאה"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label>תיאור</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='למשל "קניות ב-Voli"'
              required
              className="h-11"
            />
          </div>

          {/* Category + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v as ExpenseCategory)}>
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {(v: unknown) => EXPENSE_CATEGORIES[v as ExpenseCategory] ?? "אחר"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>מטבע</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v as any)}>
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {(v: unknown) => CURRENCY_LABELS[v as string] ?? "₪ שקל"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">₪ שקל</SelectItem>
                  <SelectItem value="EUR">€ יורו</SelectItem>
                  <SelectItem value="USD">$ דולר</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                משלמים ({payers.length})
              </Label>
              {isAdmin && payers.length < participants.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPayer}
                  className="h-8 text-xs rounded-full"
                >
                  <Plus className="ml-1 h-3 w-3" />
                  הוסף משלם
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {payers.map((payer, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass rounded-xl p-3 space-y-2"
                >
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-3">
                      <Select
                        value={payer.profile_id}
                        onValueChange={(v) => v && updatePayer(idx, "profile_id", v)}
                        disabled={!isAdmin && payer.profile_id !== userId}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue>
                            {(v: unknown) => {
                              const p = participants.find((pp) => pp.profile_id === v);
                              return (p?.profile as any)?.full_name || UNKNOWN_NAME;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {participants.map((p) => (
                            <SelectItem key={p.profile_id} value={p.profile_id}>
                              {(p.profile as any)?.full_name || UNKNOWN_NAME}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payer.amount}
                        onChange={(e) => updatePayer(idx, "amount", e.target.value)}
                        placeholder="סכום"
                        dir="ltr"
                        required
                        className="h-10 text-sm text-left"
                      />
                    </div>
                  </div>
                  {isAdmin && payers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePayer(idx)}
                      className="w-full h-7 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="ml-1 h-3 w-3" />
                      הסר
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Total */}
            {totalAmount > 0 && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex items-center justify-between">
                <span className="text-sm flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-blue-400" />
                  סה״כ הוצאה
                </span>
                <span className="text-lg font-bold text-blue-400">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </div>
            )}
          </div>

          {/* Split type — hidden for single-household trips (no split needed) */}
          {multiHousehold && (
            <div className="space-y-2">
              <Label>חלוקה</Label>
              <Select value={splitType} onValueChange={(v) => v && setSplitType(v as SplitType)}>
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {(v: unknown) => SPLIT_TYPES[v as SplitType] ?? "חלוקה"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPLIT_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Info */}
          {!isAdmin && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>רק מנהל יכול להוסיף מספר משלמים. אתה יכול לרשום תשלום שלך בלבד.</span>
            </div>
          )}

          <Button type="submit" className="w-full h-11 rounded-xl gradient-blue border-0" disabled={loading}>
            {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "שומר..." : "שמור הוצאה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

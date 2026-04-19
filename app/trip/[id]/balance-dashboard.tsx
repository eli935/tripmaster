"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Check, Smartphone, Wallet, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { Expense, Trip, TripParticipant } from "@/lib/supabase/types";
import { calculateBalances, minimizeTransfers, formatCurrency } from "@/lib/expense-calculator";
import { isMultiHouseholdTrip } from "@/lib/participant-utils";
import { useRealtimeTable } from "@/lib/hooks/use-realtime";

interface ExpenseRow {
  id: string;
  trip_id: string;
  paid_by: string;
  amount: number | string;
  currency: string;
  description: string;
}

interface ExpensePayerRow {
  id: string;
  expense_id: string;
  profile_id: string;
  amount: number | string;
}

interface ExpenseSplitRow {
  id: string;
  expense_id: string;
  profile_id: string;
  amount: number | string;
}

interface Settlement {
  id: string;
  trip_id: string;
  from_profile: string;
  to_profile: string;
  amount: number;
  method?: string | null;
  settled_at: string;
}

interface Props {
  tripId: string;
  trip: Trip;
  expenses: Expense[];
  participants: TripParticipant[];
  settlements: Settlement[];
  userId: string;
  isAdmin: boolean;
}

/**
 * Animated count-up number
 */
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [target, duration]);
  return value;
}

export function BalanceDashboard({
  tripId,
  trip,
  expenses,
  participants,
  settlements,
  userId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [marking, setMarking] = useState<string | null>(null);

  const profileNames: Record<string, string> = {};
  const profilePhones: Record<string, string | undefined> = {};
  participants.forEach((p) => {
    profileNames[p.profile_id] = (p.profile as any)?.full_name || "—";
    profilePhones[p.profile_id] = (p.profile as any)?.phone;
  });

  // ---------------------------------------------------------------------
  // Realtime sync — expenses, expense_payers, expense_splits, settlements
  // ---------------------------------------------------------------------
  // A small debounce coalesces bursts (e.g. an expense + its payers rows
  // arriving within ms of each other) into a single router.refresh().
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, 250);
  };

  // Toast rate-limiter for expense inserts from other users
  const toastTimesRef = useRef<number[]>([]);
  const pendingCollapseRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; count: number }>({
    timer: null,
    count: 0,
  });
  const TOAST_WINDOW_MS = 10_000;
  const TOAST_MAX_IN_WINDOW = 5;

  function notifyExpenseInsert(row: ExpenseRow) {
    // Only notify if inserted by another user
    if (row.paid_by === userId) return;
    const now = Date.now();
    toastTimesRef.current = toastTimesRef.current.filter((t) => now - t < TOAST_WINDOW_MS);
    toastTimesRef.current.push(now);

    if (toastTimesRef.current.length > TOAST_MAX_IN_WINDOW) {
      const state = pendingCollapseRef.current;
      state.count += 1;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        toast(`💰 ${state.count} הוצאות חדשות`);
        state.count = 0;
        state.timer = null;
      }, 1200);
      return;
    }

    const payerName = profileNames[row.paid_by] || "משתתף";
    const currency = row.currency || "ILS";
    const amountNum = Number(row.amount) || 0;
    toast(`💰 ${payerName} הוסיף הוצאה: ${formatCurrency(amountNum, currency)} — ${row.description}`);
  }

  useRealtimeTable<ExpenseRow>("expenses", tripId, {
    onInsert: (row) => {
      notifyExpenseInsert(row);
      scheduleRefresh();
    },
    onUpdate: () => scheduleRefresh(),
    onDelete: () => scheduleRefresh(),
  });

  // expense_payers / expense_splits don't carry trip_id, so no filter —
  // the hook subscribes to all rows and we simply refresh on any change
  // for this trip's expense list. Volume is low.
  useRealtimeTable<ExpensePayerRow>("expense_payers", undefined, {
    filter: undefined,
    onInsert: () => scheduleRefresh(),
    onUpdate: () => scheduleRefresh(),
    onDelete: () => scheduleRefresh(),
  });

  useRealtimeTable<ExpenseSplitRow>("expense_splits", undefined, {
    filter: undefined,
    onInsert: () => scheduleRefresh(),
    onUpdate: () => scheduleRefresh(),
    onDelete: () => scheduleRefresh(),
  });

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (pendingCollapseRef.current.timer) clearTimeout(pendingCollapseRef.current.timer);
    };
  }, []);

  // Detect household composition. Single-household trips (one couple / one
  // family) skip the settlement UI entirely — there's no-one to owe money to.
  const multiHousehold = isMultiHouseholdTrip(participants, trip);

  // Calculate balances (all in ILS via fx_rate_to_ils)
  const balances = calculateBalances(expenses, participants, profileNames, trip);

  // Apply settlements to balances (settled debts reduce remaining balance)
  const settledByPair = new Map<string, number>();
  for (const s of settlements) {
    const key = `${s.from_profile}→${s.to_profile}`;
    settledByPair.set(key, (settledByPair.get(key) || 0) + Number(s.amount));
  }

  // Adjust balances for settlements
  const adjustedBalances = balances.map((b) => {
    let adjustment = 0;
    // Money this person PAID in settlements → reduces their debt (balance goes up)
    for (const s of settlements) {
      if (s.from_profile === b.profileId) adjustment += Number(s.amount);
      if (s.to_profile === b.profileId) adjustment -= Number(s.amount);
    }
    return { ...b, balance: b.balance + adjustment };
  });

  const transfers = minimizeTransfers(adjustedBalances);
  const totalShared = expenses
    .filter((e) => e.split_type !== "private")
    .reduce((sum, e) => {
      const rate = (e as any).fx_rate_to_ils || 1;
      return sum + Number(e.amount) * Number(rate);
    }, 0);

  const totalOpen = transfers.reduce((s, t) => s + t.amount, 0);

  // Grand total includes private expenses too — used in single-household mode
  // where every expense is effectively "private" (recording-only).
  const totalAll = expenses.reduce((sum, e) => {
    const rate = (e as any).fx_rate_to_ils || 1;
    return sum + Number(e.amount) * Number(rate);
  }, 0);

  const countUpTotal = useCountUp(multiHousehold ? totalShared : totalAll);
  const countUpOpen = useCountUp(totalOpen);

  async function markSettled(transfer: typeof transfers[0]) {
    if (!isAdmin && transfer.from !== userId) {
      toast.error("רק מי ששילם או מנהל יכולים לסמן");
      return;
    }
    setMarking(`${transfer.from}-${transfer.to}`);
    const { error } = await supabase.from("settlements").insert({
      trip_id: tripId,
      from_profile: transfer.from,
      to_profile: transfer.to,
      amount: transfer.amount,
      method: "manual",
      marked_by: userId,
    });
    if (error) {
      toast.error("שגיאה בסימון", { description: error.message });
    } else {
      toast.success("סומן כשולם ✓");
      router.refresh();
    }
    setMarking(null);
  }

  function bitLink(phone?: string, amount?: number) {
    if (!phone) return null;
    const clean = phone.replace(/[^\d]/g, "");
    return `https://www.bitpay.co.il/app/send-money?phone=${clean}${amount ? `&amount=${amount}` : ""}`;
  }

  function paybox(phone?: string) {
    if (!phone) return null;
    const clean = phone.replace(/[^\d]/g, "");
    return `https://payboxapp.page.link/?link=https://www.payboxapp.com/send?phone=${clean}`;
  }

  // -------------------------------------------------------------------------
  // Single-household mode: show running totals only, no settlement.
  // (e.g. a couple on a getaway — there's no "who owes whom".)
  // -------------------------------------------------------------------------
  if (!multiHousehold) {
    // Aggregate by category for a simple "where did the money go" view.
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      const rate = (e as any).fx_rate_to_ils || 1;
      const amountILS = Number(e.amount) * Number(rate);
      const cat = (e as any).category || "other";
      byCategory[cat] = (byCategory[cat] || 0) + amountILS;
    }
    const grandTotal = Object.values(byCategory).reduce((s, v) => s + v, 0);
    const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    return (
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden p-8 text-white noise-overlay"
          style={{ background: "var(--gradient-gold-editorial)" }}
        >
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_top_right,_#FAF3E2,_transparent_60%)]" />
          <div className="relative text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/70 mb-2 font-serif italic">
              <Sparkles className="h-3 w-3" />
              סה״כ הוצאות בטיול
            </div>
            <div className="font-display text-5xl md:text-7xl font-black tracking-tight tabular-nums text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
              {formatCurrency(countUpTotal)}
            </div>
            <div className="mt-2 text-xs text-white/80">
              רישום בלבד — משק בית אחד
            </div>
          </div>
        </motion.div>

        {sortedCats.length > 0 && (
          <div className="glass rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              לפי קטגוריה
            </h4>
            {sortedCats.map(([cat, amount]) => (
              <div
                key={cat}
                className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0"
              >
                <span className="text-muted-foreground">{cat}</span>
                <span className="tabular-nums font-display font-medium">
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Banner — Total */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl overflow-hidden p-8 text-white noise-overlay"
        style={{ background: "var(--gradient-gold-editorial)" }}
      >
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_top_right,_#FAF3E2,_transparent_60%)]" />
        <div className="relative text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/70 mb-2 font-serif italic">
            <Sparkles className="h-3 w-3" />
            סה״כ הוצאות משותפות
          </div>
          <div className="font-display text-5xl md:text-7xl font-black tracking-tight tabular-nums text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
            {formatCurrency(countUpTotal)}
          </div>
          {totalOpen > 0.01 ? (
            <div className="mt-2 text-sm text-white/90">
              נותר להסדיר:{" "}
              <span className="font-bold tabular-nums font-display">{formatCurrency(countUpOpen)}</span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1 text-sm text-white font-medium bg-white/20 rounded-full px-3 py-0.5">
              <Check className="h-3.5 w-3.5" />
              הכל מאוזן
            </div>
          )}
        </div>
      </motion.div>

      {/* Family Balance Chips */}
      <div className="grid grid-cols-2 gap-2.5">
        {adjustedBalances.map((b, i) => {
          const positive = b.balance > 0.01;
          const negative = b.balance < -0.01;
          return (
            <motion.div
              key={b.profileId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass rounded-2xl p-3.5 border transition-all ${
                positive
                  ? "border-[#5A6B3C]/40 hover:border-[#5A6B3C]/80"
                  : negative
                  ? "border-[#8B2E3C]/40 hover:border-[#8B2E3C]/80"
                  : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="text-xs text-muted-foreground truncate font-serif">{b.name}</div>
                {positive && <TrendingUp className="h-3.5 w-3.5 text-[#C8D5A8]" />}
                {negative && <TrendingDown className="h-3.5 w-3.5 text-[#E6B4BC]" />}
              </div>
              <div className="text-lg font-bold tabular-nums font-display">
                {formatCurrency(b.totalPaid)}
              </div>
              <div className="text-[10px] text-muted-foreground">שילם</div>
              <div
                className={`text-sm font-semibold mt-1.5 tabular-nums font-display ${
                  positive
                    ? "text-[#C8D5A8]"
                    : negative
                    ? "text-[#E6B4BC]"
                    : "text-muted-foreground"
                }`}
              >
                {positive
                  ? `+${formatCurrency(b.balance)}`
                  : negative
                  ? `-${formatCurrency(Math.abs(b.balance))}`
                  : "מאוזן"}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Transfers */}
      <AnimatePresence>
        {transfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Wallet className="h-4 w-4" />
                העברות נדרשות ({transfers.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                {transfers.length} במקום {adjustedBalances.length - 1}+ ✨
              </span>
            </div>

            {transfers.map((t, i) => {
              const toPhone = profilePhones[t.to];
              const bit = bitLink(toPhone, t.amount);
              const pbx = paybox(toPhone);
              const canMark = isAdmin || t.from === userId;
              const loadingThis = marking === `${t.from}-${t.to}`;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ scale: 1.01 }}
                  className="glass rounded-2xl p-4 border border-white/10 hover:border-[var(--gold-500)]/50 hover:shadow-[0_0_28px_-8px_rgba(212,169,96,0.45)] transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1.5 rounded-xl bg-[#8B2E3C]/25 text-[#E6B4BC] text-sm font-serif border border-[#8B2E3C]/40">
                      {t.fromName}
                    </span>
                    <ArrowLeft className="w-5 h-5 text-white/40 group-hover:text-[var(--gold-500)] group-hover:-translate-x-1 transition-all" />
                    <span className="px-3 py-1.5 rounded-xl bg-[#5A6B3C]/25 text-[#C8D5A8] text-sm font-serif border border-[#5A6B3C]/40">
                      {t.toName}
                    </span>
                    <div className="mr-auto text-2xl font-bold tabular-nums font-display text-[var(--gold-200)]">
                      {formatCurrency(t.amount)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {bit && (
                      <a
                        href={bit}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--sapphire)]/30 hover:bg-[var(--sapphire)]/50 text-[#9FB5D9] text-xs font-medium text-center inline-flex items-center justify-center gap-1 transition border border-[var(--sapphire)]/40"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        Bit
                      </a>
                    )}
                    {pbx && (
                      <a
                        href={pbx}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--sapphire)]/30 hover:bg-[var(--sapphire)]/50 text-[#9FB5D9] text-xs font-medium text-center inline-flex items-center justify-center gap-1 transition border border-[var(--sapphire)]/40"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        PayBox
                      </a>
                    )}
                    {canMark && (
                      <button
                        onClick={() => markSettled(t)}
                        disabled={loadingThis}
                        className="flex-1 px-3 py-2 rounded-xl gradient-gold text-white text-xs font-medium hover:brightness-110 active:scale-95 transition inline-flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {loadingThis ? "..." : "שולם"}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settlement history */}
      {settlements.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            היסטוריית הסדרים ({settlements.length})
          </h4>
          {settlements.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0"
            >
              <span>
                {profileNames[s.from_profile] || "—"} →{" "}
                {profileNames[s.to_profile] || "—"}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-display font-medium">
                  {formatCurrency(Number(s.amount))}
                </span>
                <span className="text-muted-foreground">
                  {new Date(s.settled_at).toLocaleDateString("he-IL")}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

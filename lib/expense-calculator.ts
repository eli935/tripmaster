import type { Expense, ExpenseSplit, Trip, TripParticipant } from "./supabase/types";
import { getCountedParticipants, getTotalHeadcount } from "./participant-utils";

/**
 * Convert an expense amount to ILS using the LOCKED, per-day FX rate
 * stored on the expense (set at insert time from `daily_fx_rates`).
 *
 * IMPORTANT: we no longer fall back to hardcoded constants. A missing
 * `fx_rate_to_ils` on a foreign-currency expense means the rate fetch
 * failed — we log loudly and treat the amount as ILS so the trip still
 * balances (approximately) while an admin runs /api/admin/backfill-fx to
 * fill the rate in. Silent hardcoded fallbacks caused the original bug
 * where a 3-week trip converted all expenses at one stale rate.
 */
function toILS(expense: Expense): number {
  const rate = (expense as any).fx_rate_to_ils;
  const amount = Number(expense.amount);
  if (expense.currency === "ILS" || !expense.currency) return amount;
  if (rate && Number(rate) > 0) {
    return amount * Number(rate);
  }
  // Foreign currency, no rate locked — loud warning, use raw amount.
  if (typeof console !== "undefined") {
    console.warn(
      `[expense-calculator] Expense ${expense.id} is ${expense.currency} ` +
        `but has no fx_rate_to_ils. Run /api/admin/backfill-fx. ` +
        `Treating ${amount} ${expense.currency} as ${amount} ILS for now.`
    );
  }
  return amount;
}

interface Balance {
  profileId: string;
  name: string;
  totalPaid: number;
  totalOwed: number;
  balance: number; // positive = owed money, negative = owes money
}

interface Transfer {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

/**
 * Calculate the balance for each participant
 */
export function calculateBalances(
  expenses: Expense[],
  participants: TripParticipant[],
  profileNames: Record<string, string>,
  trip?: Pick<Trip, "created_by" | "admin_participates">
): Balance[] {
  // Counted = participants whose adults+children feed into per-person splits
  // and headcount math. When `admin_participates === false`, the admin row is
  // dropped. If `trip` is omitted (legacy callers), fall back to the old
  // behaviour where every row counts.
  const counted = trip ? getCountedParticipants(participants, trip) : participants;
  const totalPeople = trip
    ? getTotalHeadcount(participants, trip).total
    : participants.reduce((sum, p) => sum + p.adults + p.children, 0);

  // When the admin is marked as not participating, they should not appear
  // in the settlements UI at all. Any shared expense they paid is treated
  // as private-to-admin (admin's balance self-cancels, other participants
  // are not debited). This matches the user intent: "only those actually
  // traveling appear in the settlement".
  const adminNotParticipating =
    !!trip && trip.admin_participates === false && !!trip.created_by;
  const adminId = adminNotParticipating ? trip!.created_by : null;

  const balances: Record<string, Balance> = {};

  // Initialize balances for participants. Admin is still included here when
  // excluded — so they can absorb their own shared-expense payments without
  // affecting others — but filtered out of the returned list at the end.
  for (const p of participants) {
    balances[p.profile_id] = {
      profileId: p.profile_id,
      name: profileNames[p.profile_id] || "???",
      totalPaid: 0,
      totalOwed: 0,
      balance: 0,
    };
  }

  for (const expense of expenses) {
    // CRITICAL: Convert to ILS using LOCKED rate so historical balances don't shift
    const amountILS = toILS(expense);

    // Track private expenses separately (each family pays their own)
    if (expense.split_type === "private") {
      if (balances[expense.paid_by]) {
        balances[expense.paid_by].totalPaid += amountILS;
        balances[expense.paid_by].totalOwed += amountILS;
      }
      continue;
    }

    // Non-participating admin paid a shared expense → treat as private to
    // admin. Admin's balance zeros out; no debit is propagated to others.
    if (adminNotParticipating && expense.paid_by === adminId) {
      if (balances[expense.paid_by]) {
        balances[expense.paid_by].totalPaid += amountILS;
        balances[expense.paid_by].totalOwed += amountILS;
      }
      continue;
    }

    // Track what was paid for shared expenses
    if (balances[expense.paid_by]) {
      balances[expense.paid_by].totalPaid += amountILS;
    }

    // Calculate what each person owes
    if (expense.split_type === "custom") {
      if (expense.splits && expense.splits.length > 0) {
        for (const split of expense.splits) {
          if (balances[split.profile_id]) {
            // Split amounts are in expense currency — convert each using
            // the SAME locked per-day rate as the expense total. ILS rows
            // (or missing-rate foreign rows) pass through at 1:1, matching
            // toILS()'s behaviour above.
            const rawRate = (expense as any).fx_rate_to_ils;
            const rate =
              expense.currency === "ILS" || !expense.currency
                ? 1
                : rawRate && Number(rawRate) > 0
                  ? Number(rawRate)
                  : 1; // warned in toILS already
            balances[split.profile_id].totalOwed += Number(split.amount) * rate;
          }
        }
      } else {
        // "custom" without splits → split evenly among counted participants
        // excluding the payer.
        const others = counted.filter((p) => p.profile_id !== expense.paid_by);
        if (others.length > 0) {
          const perOther = amountILS / others.length;
          for (const p of others) {
            balances[p.profile_id].totalOwed += perOther;
          }
        }
      }
    } else if (expense.split_type === "per_person") {
      if (totalPeople > 0) {
        const perPerson = amountILS / totalPeople;
        for (const p of counted) {
          const share = perPerson * (p.adults + p.children);
          balances[p.profile_id].totalOwed += share;
        }
      }
    } else {
      // "equal" — split per family across counted participants
      if (counted.length > 0) {
        const perFamily = amountILS / counted.length;
        for (const p of counted) {
          balances[p.profile_id].totalOwed += perFamily;
        }
      }
    }
  }

  // Calculate net balance
  const out = Object.values(balances).map((b) => ({
    ...b,
    balance: b.totalPaid - b.totalOwed,
  }));

  // Hide non-participating admin from the settlements list entirely.
  // Their row has self-cancelling totals (handled above) so omitting it
  // keeps the list consistent.
  if (adminNotParticipating && adminId) {
    return out.filter((b) => b.profileId !== adminId);
  }
  return out;
}

/**
 * Minimize the number of transfers needed to settle debts.
 * Uses a greedy algorithm: repeatedly match the largest creditor with the largest debtor.
 */
export function minimizeTransfers(balances: Balance[]): Transfer[] {
  const transfers: Transfer[] = [];

  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors = balances
    .filter((b) => b.balance < -0.01)
    .map((b) => ({ ...b, remaining: Math.abs(b.balance) }))
    .sort((a, b) => b.remaining - a.remaining);

  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .map((b) => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);

    if (amount > 0.01) {
      transfers.push({
        from: debtors[i].profileId,
        fromName: debtors[i].name,
        to: creditors[j].profileId,
        toName: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;

    if (debtors[i].remaining < 0.01) i++;
    if (creditors[j].remaining < 0.01) j++;
  }

  return transfers;
}

/**
 * Apply a markup (percent or fixed) to a base amount.
 * Used for v9.0 "friends" and "client" trip types where admin adds a margin.
 */
export function applyMarkup(
  baseAmount: number,
  markupType: "none" | "percent" | "fixed",
  markupValue: number
): { finalAmount: number; markup: number } {
  const base = Number(baseAmount) || 0;
  const value = Number(markupValue) || 0;

  if (markupType === "percent") {
    const markup = base * (value / 100);
    return { finalAmount: base + markup, markup };
  }
  if (markupType === "fixed") {
    return { finalAmount: base + value, markup: value };
  }
  return { finalAmount: base, markup: 0 };
}

/**
 * Format currency amount in ILS
 */
export function formatCurrency(amount: number, currency = "ILS"): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

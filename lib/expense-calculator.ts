import type { Expense, ExpenseSplit, TripParticipant } from "./supabase/types";

/**
 * Convert an expense amount to ILS using the locked FX rate.
 * Falls back to amount (assumes ILS) if rate missing.
 */
function toILS(expense: Expense): number {
  const rate = (expense as any).fx_rate_to_ils;
  if (rate && Number(rate) > 0) {
    return Number(expense.amount) * Number(rate);
  }
  // Fallback for legacy rows
  if (expense.currency === "EUR") return Number(expense.amount) * 4.05;
  if (expense.currency === "USD") return Number(expense.amount) * 3.72;
  return Number(expense.amount); // ILS assumed
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
  profileNames: Record<string, string>
): Balance[] {
  const totalPeople = participants.reduce(
    (sum, p) => sum + p.adults + p.children,
    0
  );

  const balances: Record<string, Balance> = {};

  // Initialize balances for all participants
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

    // Track what was paid for shared expenses
    if (balances[expense.paid_by]) {
      balances[expense.paid_by].totalPaid += amountILS;
    }

    // Calculate what each person owes
    if (expense.split_type === "custom") {
      if (expense.splits && expense.splits.length > 0) {
        for (const split of expense.splits) {
          if (balances[split.profile_id]) {
            // Split amounts are in expense currency — convert each
            const rate = (expense as any).fx_rate_to_ils || 1;
            balances[split.profile_id].totalOwed += Number(split.amount) * Number(rate);
          }
        }
      } else {
        const others = participants.filter((p) => p.profile_id !== expense.paid_by);
        const perOther = amountILS / others.length;
        for (const p of others) {
          balances[p.profile_id].totalOwed += perOther;
        }
      }
    } else if (expense.split_type === "per_person") {
      const perPerson = amountILS / totalPeople;
      for (const p of participants) {
        const share = perPerson * (p.adults + p.children);
        balances[p.profile_id].totalOwed += share;
      }
    } else {
      const perFamily = amountILS / participants.length;
      for (const p of participants) {
        balances[p.profile_id].totalOwed += perFamily;
      }
    }
  }

  // Calculate net balance
  return Object.values(balances).map((b) => ({
    ...b,
    balance: b.totalPaid - b.totalOwed,
  }));
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

import type { Expense, ExpenseSplit, TripParticipant } from "./supabase/types";

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
    if (expense.split_type === "private") continue;

    // Track what was paid
    if (balances[expense.paid_by]) {
      balances[expense.paid_by].totalPaid += expense.amount;
    }

    // Calculate what each person owes
    if (expense.split_type === "custom" && expense.splits) {
      for (const split of expense.splits) {
        if (balances[split.profile_id]) {
          balances[split.profile_id].totalOwed += split.amount;
        }
      }
    } else if (expense.split_type === "per_person") {
      // Split by number of people (adults + children)
      const perPerson = expense.amount / totalPeople;
      for (const p of participants) {
        const share = perPerson * (p.adults + p.children);
        balances[p.profile_id].totalOwed += share;
      }
    } else {
      // Equal split between families
      const perFamily = expense.amount / participants.length;
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
 * Format currency amount in ILS
 */
export function formatCurrency(amount: number, currency = "ILS"): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

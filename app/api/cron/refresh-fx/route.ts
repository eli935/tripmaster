import { NextResponse } from "next/server";
import { getRateForDate } from "@/lib/currency";

/**
 * GET /api/cron/refresh-fx
 *
 * Daily Vercel cron — pre-warms yesterday's FX rates (ILS → USD/EUR/GBP
 * and USD/EUR/GBP → ILS) into `daily_fx_rates` so the first expense
 * lookup in the morning is already cached. Non-destructive: idempotent
 * thanks to the (date, base, target) PK.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const BASES = ["ILS"] as const;
const TARGETS = ["USD", "EUR", "GBP"] as const;

function yesterdayIL(): string {
  // IL is UTC+2/+3. Using UTC-1day is "yesterday" for everyone within ~2h
  // of midnight IL, which is acceptable for a pre-warm cache. Rates are
  // published by ECB once per business day, so exact TZ doesn't matter.
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const date = yesterdayIL();
  const results: Array<{ base: string; target: string; ok: boolean; rate?: number }> = [];

  // Both directions: ILS→X (for quick "how much is today's ILS in EUR")
  // and X→ILS (for the expense insert path). Frankfurter is free.
  for (const base of BASES) {
    for (const target of TARGETS) {
      const r = await getRateForDate(date, base, target);
      results.push({ base, target, ok: !!r, rate: r?.rate });
    }
  }
  for (const base of TARGETS) {
    for (const target of BASES) {
      const r = await getRateForDate(date, base, target);
      results.push({ base, target, ok: !!r, rate: r?.rate });
    }
  }

  return NextResponse.json({ date, count: results.length, results });
}

/**
 * Live currency exchange rates via Frankfurter API (free, no API key)
 * https://www.frankfurter.app/docs/
 *
 * v2 (stage-17): historical per-day rates + Supabase cache.
 * `getRateForDate` is the canonical entrypoint for expense FX math.
 */

import { createClient } from "@supabase/supabase-js";

export interface ExchangeRate {
  base: string;
  rates: Record<string, number>;
  date: string;
}

export interface DatedRate {
  /** rate expressed as: 1 {base} = {rate} {target} */
  rate: number;
  /** the date we *asked* for (normalized YYYY-MM-DD) */
  requested_date: string;
  /** the date Frankfurter actually priced — differs from requested_date
   *  on weekends/holidays (falls back to prior business day) */
  rate_date: string;
  /** where the rate came from */
  source: "cache" | "frankfurter";
}

// In-memory cache (1 hour) — for latest-rate path only.
const cache = new Map<string, { data: ExchangeRate; expires: number }>();

function ymd(d: Date | string): string {
  if (typeof d === "string") {
    // If it already looks like YYYY-MM-DD, accept it.
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    d = new Date(d);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Server-side Supabase client (service role) for cache read/write.
 *  Returns null in browser contexts or when env is missing. */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Get the exchange rate for a specific historical date.
 *
 * Pipeline:
 *   1. Look up (date, base, target) in `daily_fx_rates` cache.
 *   2. On miss, fetch Frankfurter `/{date}?base={base}&symbols={target}`.
 *   3. Cache the result (PK conflict = ignore).
 *
 * Returns null if the currency is not supported or the network fails.
 * Caller must handle null — do NOT silently fall back to a hardcoded rate.
 *
 * Convention: `rate` is the multiplier to convert `base` → `target`.
 * For our expense flow we want ILS per foreign unit, so call with
 * `getRateForDate(date, currency, 'ILS')` to get "1 EUR = 4.05 ILS".
 */
export async function getRateForDate(
  date: string | Date,
  base: string,
  target: string
): Promise<DatedRate | null> {
  const requested = ymd(date);
  if (base === target) {
    return { rate: 1, requested_date: requested, rate_date: requested, source: "cache" };
  }

  const db = serviceClient();

  // 1. Cache lookup
  if (db) {
    const { data } = await db
      .from("daily_fx_rates")
      .select("rate, rate_date")
      .eq("date", requested)
      .eq("base", base)
      .eq("target", target)
      .maybeSingle();
    if (data && data.rate) {
      return {
        rate: Number(data.rate),
        requested_date: requested,
        rate_date: data.rate_date,
        source: "cache",
      };
    }
  }

  // 2. Frankfurter — /{date}?base=X&symbols=Y. For today Frankfurter also
  //    accepts "latest" but we always pass the explicit date.
  try {
    const url = `https://api.frankfurter.app/${requested}?base=${base}&symbols=${target}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as ExchangeRate;
    const rate = json.rates?.[target];
    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) return null;

    const rateDate = json.date || requested;

    // 3. Cache
    if (db) {
      await db
        .from("daily_fx_rates")
        .upsert(
          {
            date: requested,
            base,
            target,
            rate,
            rate_date: rateDate,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "date,base,target" }
        );
    }

    return {
      rate,
      requested_date: requested,
      rate_date: rateDate,
      source: "frankfurter",
    };
  } catch (err) {
    console.error("[currency] Frankfurter fetch failed:", err);
    return null;
  }
}

/**
 * Legacy "latest rate" helper. Kept for backwards compatibility with any
 * caller that only wants today's rate (e.g. travel-plan cost estimation).
 * For expenses, use `getRateForDate` instead.
 */
export async function getExchangeRate(
  base: string = "ILS",
  symbols: string[] = ["USD", "EUR", "GBP"]
): Promise<ExchangeRate | null> {
  const cacheKey = `${base}:${symbols.join(",")}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://api.frankfurter.app/latest?base=${base}&symbols=${symbols.join(",")}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // Next.js cache for 1 hour
    });
    if (!res.ok) return null;
    const data = await res.json();

    cache.set(cacheKey, {
      data,
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return data;
  } catch (error) {
    console.error("Currency fetch error:", error);
    return null;
  }
}

/**
 * Convert amount between currencies
 */
export function convert(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/**
 * Format currency with locale
 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "ILS" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

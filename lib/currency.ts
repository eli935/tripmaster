/**
 * Live currency exchange rates via Frankfurter API (free, no API key)
 * https://www.frankfurter.app/docs/
 */

export interface ExchangeRate {
  base: string;
  rates: Record<string, number>;
  date: string;
}

// In-memory cache (1 hour)
const cache = new Map<string, { data: ExchangeRate; expires: number }>();

/**
 * Get live exchange rates
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

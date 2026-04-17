/**
 * Weather fetcher — Open-Meteo API (free, no key required)
 * Used by destination-overview to render a 7-day forecast strip.
 */

export type WeatherDay = {
  date: string; // YYYY-MM-DD
  temp_max: number; // Celsius
  temp_min: number;
  precipitation: number; // mm
  weather_code: number; // WMO code
  icon: string; // emoji based on code
};

/**
 * Map WMO weather codes to emoji.
 * Reference: https://open-meteo.com/en/docs (weathercode values)
 */
export function wmoCodeToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

/**
 * Fetch a daily forecast from Open-Meteo for the given coordinates and date range.
 * Returns an empty array on failure rather than throwing, so callers can render
 * a graceful placeholder.
 *
 * Note: Open-Meteo's free endpoint supports up to 16 days ahead.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<WeatherDay[]> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
      `&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

    const res = await fetch(url, {
      // Revalidate at most every 3 hours — matches cache policy in destinations_cache
      next: { revalidate: 60 * 60 * 3 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const daily = data?.daily;
    if (!daily || !Array.isArray(daily.time)) return [];

    const result: WeatherDay[] = [];
    for (let i = 0; i < daily.time.length; i++) {
      const code = Number(daily.weathercode?.[i] ?? 0);
      result.push({
        date: String(daily.time[i]),
        temp_max: Number(daily.temperature_2m_max?.[i] ?? 0),
        temp_min: Number(daily.temperature_2m_min?.[i] ?? 0),
        precipitation: Number(daily.precipitation_sum?.[i] ?? 0),
        weather_code: code,
        icon: wmoCodeToEmoji(code),
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ───────────────────────────────────────────────────────────────────
// Geocoding — Open-Meteo Geocoding API (free, no key)
// Docs: https://open-meteo.com/en/docs/geocoding-api
// ───────────────────────────────────────────────────────────────────

export type GeocodeResult = {
  lat: number;
  lng: number;
  country: string;       // full country name (e.g. "Italy")
  country_code: string;  // ISO-2 (e.g. "IT"), uppercased
  timezone?: string;     // IANA tz, e.g. "Europe/Rome"
  name?: string;         // canonical place name from the API
};

/**
 * Resolve a destination string (any language) to coordinates + country.
 * Returns null on failure — caller should fall back gracefully.
 *
 * Caches per-process via Next fetch revalidate (24h) to avoid repeat calls
 * for the same destination within a server instance. Persistent caching
 * into destinations_cache is the caller's responsibility.
 */
export async function geocode(
  destinationName: string
): Promise<GeocodeResult | null> {
  const q = destinationName?.trim();
  if (!q) return null;
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(q)}&count=1&language=he&format=json`;
    const res = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 }, // 24h — geocodes are effectively static
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data?.results) ? data.results[0] : null;
    if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") {
      return null;
    }
    return {
      lat: Number(hit.latitude),
      lng: Number(hit.longitude),
      country: String(hit.country ?? ""),
      country_code: String(hit.country_code ?? "").toUpperCase(),
      timezone: hit.timezone ? String(hit.timezone) : undefined,
      name: hit.name ? String(hit.name) : undefined,
    };
  } catch {
    return null;
  }
}

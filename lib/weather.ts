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

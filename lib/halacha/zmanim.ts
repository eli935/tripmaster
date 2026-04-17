/**
 * Zmanim (Jewish prayer times) via Hebcal API
 * https://www.hebcal.com/home/developer-apis
 *
 * Free API, no auth. Cached aggressively in memory + DB.
 */

import { createClient } from "@supabase/supabase-js";

export interface Zmanim {
  date: string;
  sunrise: string;
  sunset: string;
  candle_lighting?: string;
  havdalah?: string;
  tzeit_hakochavim: string;
  sof_zman_shema_ma: string;
  sof_zman_shema_gra: string;
  sof_zman_tfilla_gra: string;
  mincha_gedola: string;
  mincha_ketana: string;
  plag_hamincha: string;
  chatzot: string;
  hebrew_date?: string;
  parsha?: string;
  candle_lighting_minutes?: number;
  source: "hebcal";
  fetched_at: string;
}

// In-memory cache (per serverless invocation)
const memCache = new Map<string, Zmanim>();

/**
 * Fetch zmanim from Hebcal for given coordinates & date.
 * date format: YYYY-MM-DD
 */
export async function fetchZmanim(
  lat: number,
  lng: number,
  tz: string,
  date: string,
  minhagMinutes: number = 18
): Promise<Zmanim | null> {
  // Round to 2 decimals for better cache hits (~1km precision)
  const rLat = Math.round(lat * 100) / 100;
  const rLng = Math.round(lng * 100) / 100;
  const cacheKey = `${rLat},${rLng},${date},${minhagMinutes}`;

  if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;

  try {
    // 1. Zmanim endpoint — astronomical times
    const zmanimUrl = `https://www.hebcal.com/zmanim?cfg=json&latitude=${rLat}&longitude=${rLng}&tzid=${encodeURIComponent(tz)}&date=${date}`;
    const zmanimRes = await fetch(zmanimUrl, { next: { revalidate: 86400 } });
    if (!zmanimRes.ok) return null;
    const zmanimData = await zmanimRes.json();
    const t = zmanimData.times || {};

    // 2. Hebcal endpoint for candle-lighting + havdalah + hebrew date for that day
    const hebcalUrl = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&nx=on&mf=on&c=on&M=on&i=on&start=${date}&end=${date}&latitude=${rLat}&longitude=${rLng}&tzid=${encodeURIComponent(tz)}&b=${minhagMinutes}`;
    const hebcalRes = await fetch(hebcalUrl, { next: { revalidate: 86400 } });
    const hebcalData = hebcalRes.ok ? await hebcalRes.json() : { items: [] };
    const items = hebcalData.items || [];

    const candleLightingItem = items.find((i: any) => i.category === "candles");
    const havdalahItem = items.find((i: any) => i.category === "havdalah");
    const hebrewDateItem = items.find((i: any) => i.category === "hebdate");
    const parshaItem = items.find((i: any) => i.category === "parashat");

    const extractTime = (isoString: string | undefined): string | undefined => {
      if (!isoString) return undefined;
      try {
        return new Date(isoString).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz,
        });
      } catch {
        return undefined;
      }
    };

    const result: Zmanim = {
      date,
      sunrise: extractTime(t.sunrise) || "—",
      sunset: extractTime(t.sunset) || "—",
      candle_lighting: extractTime(candleLightingItem?.date),
      havdalah: extractTime(havdalahItem?.date),
      tzeit_hakochavim: extractTime(t.tzeit7083deg) || extractTime(t.tzeit72min) || "—",
      sof_zman_shema_ma: extractTime(t.sofZmanShmaMGA) || "—",
      sof_zman_shema_gra: extractTime(t.sofZmanShma) || "—",
      sof_zman_tfilla_gra: extractTime(t.sofZmanTfilla) || "—",
      mincha_gedola: extractTime(t.minchaGedola) || "—",
      mincha_ketana: extractTime(t.minchaKetana) || "—",
      plag_hamincha: extractTime(t.plagHaMincha) || "—",
      chatzot: extractTime(t.chatzot) || "—",
      hebrew_date: hebrewDateItem?.hebrew,
      parsha: parshaItem?.hebrew,
      candle_lighting_minutes: minhagMinutes,
      source: "hebcal",
      fetched_at: new Date().toISOString(),
    };

    memCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[zmanim] fetch error:", error);
    return null;
  }
}

/**
 * Fetch zmanim for multiple dates in parallel.
 * Used to populate all days of a trip at once.
 */
export async function fetchZmanimForDates(
  lat: number,
  lng: number,
  tz: string,
  dates: string[],
  minhagMinutes: number = 18
): Promise<Record<string, Zmanim | null>> {
  const results = await Promise.all(
    dates.map((d) => fetchZmanim(lat, lng, tz, d, minhagMinutes))
  );
  const map: Record<string, Zmanim | null> = {};
  dates.forEach((d, i) => {
    map[d] = results[i];
  });
  return map;
}

/**
 * Pick which fields to display per day type
 */
export type DisplayField =
  | "candle_lighting"
  | "havdalah"
  | "sunrise"
  | "sunset"
  | "tzeit_hakochavim"
  | "sof_zman_shema_ma"
  | "sof_zman_shema_gra"
  | "sof_zman_tfilla_gra"
  | "mincha_gedola"
  | "mincha_ketana"
  | "plag_hamincha"
  | "chatzot";

export function getDisplayFields(dayType: string): DisplayField[] {
  switch (dayType) {
    case "erev_chag":
      return [
        "candle_lighting",
        "sunrise",
        "sof_zman_shema_ma",
        "sof_zman_shema_gra",
        "sof_zman_tfilla_gra",
        "chatzot",
        "mincha_gedola",
        "plag_hamincha",
        "sunset",
      ];
    case "chag":
    case "shabbat":
    case "shabbat_chol_hamoed":
      return [
        "sunrise",
        "sof_zman_shema_ma",
        "sof_zman_shema_gra",
        "sof_zman_tfilla_gra",
        "chatzot",
        "mincha_gedola",
        "mincha_ketana",
        "sunset",
        "havdalah",
      ];
    case "chol_hamoed":
      return ["sunrise", "sof_zman_shema_gra", "chatzot", "mincha_gedola", "sunset"];
    case "chol":
    default:
      return ["sunrise", "sof_zman_shema_gra", "mincha_gedola", "sunset"];
  }
}

export const FIELD_LABELS: Record<DisplayField, string> = {
  candle_lighting: "🕯️ הדלקת נרות",
  havdalah: "✨ הבדלה",
  sunrise: "🌅 זריחה",
  sunset: "🌇 שקיעה",
  tzeit_hakochavim: "⭐ צאת הכוכבים",
  sof_zman_shema_ma: "סוף זמן ק״ש (מג״א)",
  sof_zman_shema_gra: "סוף זמן ק״ש (גר״א)",
  sof_zman_tfilla_gra: "סוף זמן תפילה",
  mincha_gedola: "מנחה גדולה",
  mincha_ketana: "מנחה קטנה",
  plag_hamincha: "פלג המנחה",
  chatzot: "חצות",
};

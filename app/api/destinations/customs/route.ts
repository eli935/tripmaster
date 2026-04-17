import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Local customs API — Stage 3c
 *
 * POST { destination: string, startDate: string, endDate: string, countryCode?: string }
 *
 * Strategy:
 *  1. Lookup destinations_cache by country_code (if supplied) — reuse if < 30 days old.
 *  2. Else call Claude Haiku 4.5 with a cached system prompt, parse JSON, persist.
 *  3. If no API key → return a minimal static fallback, never throw.
 */

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface Holiday {
  name: string;
  dates: string;
  description: string;
  affects_trip: boolean;
}

interface LocalCustoms {
  overview: string;
  special_holidays: Holiday[];
  etiquette: string[];
  tipping: string;
  dress_code: string;
  languages: string[];
  what_closes_on_holidays: string;
}

const FALLBACK: LocalCustoms = {
  overview: "מידע תרבותי יתווסף בקרוב.",
  special_holidays: [],
  etiquette: [],
  tipping: "",
  dress_code: "",
  languages: [],
  what_closes_on_holidays: "",
};

const SYSTEM_PROMPT = `אתה מומחה תרבות ותיירות לטיולי משפחות. אתה מחזיר רק JSON תקף בעברית, ללא markdown, ללא טקסט לפני או אחרי. שים לב לאירועים מקומיים, חגים דתיים, וטיפים תרבותיים שעשויים להשפיע על הטיול.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      destination?: string;
      startDate?: string;
      endDate?: string;
      countryCode?: string;
    };
    const destination = (body.destination || "").trim();
    const startDate = body.startDate || "";
    const endDate = body.endDate || "";
    const countryCode = (body.countryCode || "").trim();

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: "missing destination/startDate/endDate", customs: FALLBACK },
        { status: 400 }
      );
    }

    // 1) Cache lookup (best-effort; ignore failures)
    if (countryCode) {
      try {
        const supabase = await createServerSupabase();
        const { data } = await supabase
          .from("destinations_cache")
          .select("local_customs, weather_cached_at")
          .eq("country_code", countryCode)
          .maybeSingle();
        const cachedAt = data?.weather_cached_at
          ? new Date(data.weather_cached_at).getTime()
          : 0;
        if (data?.local_customs && Date.now() - cachedAt < CACHE_TTL_MS) {
          return NextResponse.json({ customs: data.local_customs, cached: true });
        }
      } catch {
        /* non-fatal */
      }
    }

    // 2) If no API key → return fallback gracefully
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ customs: FALLBACK, cached: false, fallback: true });
    }

    // 3) Call Claude Haiku 4.5 with prompt caching on system prompt
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userPrompt = `עבור טיול ב${destination} בין ${startDate} ל-${endDate}:
החזר JSON תקף בלבד במבנה הבא:
{
  "overview": "מחרוזת קצרה — 2-3 משפטים על המקום",
  "special_holidays": [{"name": "שם החג", "dates": "תאריכים משוערים", "description": "מה קורה", "affects_trip": true}],
  "etiquette": ["טיפ תרבותי 1", "טיפ 2"],
  "tipping": "נהוג לתת X%",
  "dress_code": "קוד לבוש עיקרי",
  "languages": ["שפות נפוצות"],
  "what_closes_on_holidays": "מה נסגר בחגים ומתי"
}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ customs: FALLBACK, cached: false, fallback: true });
    }

    let customs: LocalCustoms;
    try {
      customs = JSON.parse(jsonMatch[0]) as LocalCustoms;
    } catch {
      return NextResponse.json({ customs: FALLBACK, cached: false, fallback: true });
    }

    // 4) Persist (best-effort)
    if (countryCode) {
      try {
        const supabase = await createServerSupabase();
        await supabase
          .from("destinations_cache")
          .upsert(
            {
              country_code: countryCode,
              local_customs: customs,
              weather_cached_at: new Date().toISOString(),
            },
            { onConflict: "country_code" }
          );
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({ customs, cached: false });
  } catch (err) {
    console.error("[customs] error:", err);
    return NextResponse.json({ customs: FALLBACK, cached: false, fallback: true });
  }
}

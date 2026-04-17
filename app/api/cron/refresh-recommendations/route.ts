import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Stage 8 — Daily refresh of trip_recommendations
 *
 * GET /api/cron/refresh-recommendations
 * Auth: Bearer ${CRON_SECRET}
 *
 * Flow:
 *  1. Find unique destinations from active trips (status != 'completed')
 *  2. For each destination whose most-recent trip_recommendations.collected_at
 *     is older than 7 days (or missing), call Claude Sonnet for 5 fresh items
 *  3. POST results to /api/recommendations/ingest
 *
 * Limit: 5 destinations per run.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DESTINATIONS = 5;
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

interface RecommendationItem {
  title: string;
  quote: string;
  source_url: string;
  source?: "reddit" | "tripadvisor" | "facebook" | "blog" | "claude";
  sentiment?: "positive" | "neutral" | "negative";
  tags?: string[];
  popularity_score?: number;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function generateRecommendations(
  destination: string
): Promise<RecommendationItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "[cron/refresh-recommendations] ANTHROPIC_API_KEY missing — skipping"
    );
    return [];
  }

  const client = new Anthropic({ apiKey });
  const prompt = `Find 5 trending things to do in ${destination} for travelers in 2026.
Focus on recent recommendations (last 6 months) — especially things that
travelers are excited about right now, hidden gems, and family-friendly spots.
Prefer kosher-friendly or Jewish-traveler-relevant options when they exist.

Return ONLY a valid JSON array (no markdown, no commentary) of exactly 5 items.
Each item must match this schema:
{
  "title": "string — short attraction/spot name",
  "quote": "string — 1-2 sentence recommendation in English",
  "source_url": "string — a real, plausible URL (reddit thread, blog post, tripadvisor listing)",
  "source": "reddit" | "tripadvisor" | "blog" | "claude",
  "sentiment": "positive",
  "tags": ["food" | "family" | "hidden-gem" | "kosher" | "nature" | "historic" | "nightlife" | "budget" | "luxury"],
  "popularity_score": 0-100
}

Return JSON array only.`;

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Extract JSON array from response.
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as RecommendationItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5);
  } catch (err) {
    console.warn(
      "[cron/refresh-recommendations] Claude call failed:",
      (err as Error).message
    );
    return [];
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 }
    );
  }

  // Step 1: unique destinations from active trips.
  const { data: trips, error: tripsErr } = await supabase
    .from("trips")
    .select("destination, status")
    .neq("status", "completed");

  if (tripsErr) {
    return NextResponse.json({ error: tripsErr.message }, { status: 500 });
  }

  const destinations = Array.from(
    new Set(
      (trips ?? [])
        .map((t: { destination: string | null }) => (t.destination || "").trim())
        .filter((d: string) => d.length > 0)
    )
  );

  // Step 2: filter destinations whose latest recommendation is stale.
  const stale: string[] = [];
  for (const dest of destinations) {
    const { data: latest } = await supabase
      .from("trip_recommendations")
      .select("collected_at")
      .eq("destination", dest)
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestMs = latest?.collected_at
      ? new Date(latest.collected_at).getTime()
      : 0;
    if (Date.now() - latestMs > STALE_THRESHOLD_MS) {
      stale.push(dest);
    }
    if (stale.length >= MAX_DESTINATIONS) break;
  }

  // Step 3: generate and ingest for each stale destination.
  const origin = new URL(req.url).origin;
  const results: Array<{
    destination: string;
    generated: number;
    inserted?: number;
    skipped?: number;
    error?: string;
  }> = [];

  for (const dest of stale) {
    const items = await generateRecommendations(dest);
    if (items.length === 0) {
      results.push({ destination: dest, generated: 0 });
      continue;
    }

    try {
      const ingestRes = await fetch(`${origin}/api/recommendations/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({ destination: dest, items }),
      });
      const json = (await ingestRes.json()) as {
        inserted?: number;
        skipped?: number;
        error?: string;
      };
      results.push({
        destination: dest,
        generated: items.length,
        inserted: json.inserted,
        skipped: json.skipped,
        error: json.error,
      });
    } catch (err) {
      results.push({
        destination: dest,
        generated: items.length,
        error: (err as Error).message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: destinations.length,
    processed: stale.length,
    results,
  });
}

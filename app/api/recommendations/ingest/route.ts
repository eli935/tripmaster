import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Stage 8 — Recommendations ingest endpoint
 *
 * POST /api/recommendations/ingest
 * Auth: Bearer ${CRON_SECRET}
 *
 * Body:
 * {
 *   "destination": "Rome",
 *   "items": [
 *     {
 *       "title": "...",
 *       "quote": "...",
 *       "source_url": "https://...",
 *       "source": "reddit" | "tripadvisor" | "facebook" | "blog" | "claude",
 *       "sentiment": "positive" | "neutral" | "negative",
 *       "tags": ["food","family"],
 *       "popularity_score": 0-100
 *     }
 *   ]
 * }
 *
 * Dedup: skip items whose (destination, source_url) already exists.
 * Returns { inserted, skipped, errors }.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Source = "reddit" | "tripadvisor" | "facebook" | "blog" | "claude";
type Sentiment = "positive" | "neutral" | "negative";

interface IngestItem {
  title?: string;
  quote?: string;
  source_url?: string;
  source?: Source;
  sentiment?: Sentiment;
  tags?: string[];
  popularity_score?: number;
}

interface IngestBody {
  destination?: string;
  items?: IngestItem[];
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const VALID_SOURCES: Source[] = [
  "reddit",
  "tripadvisor",
  "facebook",
  "blog",
  "claude",
];
const VALID_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

function sanitize(item: IngestItem): Required<Pick<IngestItem, "source">> & IngestItem | null {
  if (!item || typeof item !== "object") return null;
  const source = VALID_SOURCES.includes(item.source as Source)
    ? (item.source as Source)
    : "claude";
  const sentiment = VALID_SENTIMENTS.includes(item.sentiment as Sentiment)
    ? (item.sentiment as Sentiment)
    : "positive";
  const score = Number.isFinite(item.popularity_score)
    ? Math.max(0, Math.min(100, Math.round(item.popularity_score as number)))
    : 0;
  const tags = Array.isArray(item.tags)
    ? item.tags.filter((t): t is string => typeof t === "string").slice(0, 6)
    : [];
  const title = typeof item.title === "string" ? item.title.slice(0, 200) : null;
  const quote = typeof item.quote === "string" ? item.quote.slice(0, 600) : null;
  const source_url =
    typeof item.source_url === "string" && item.source_url.startsWith("http")
      ? item.source_url.slice(0, 500)
      : null;
  if (!title && !quote) return null;
  return {
    source,
    sentiment,
    popularity_score: score,
    tags,
    title: title ?? undefined,
    quote: quote ?? undefined,
    source_url: source_url ?? undefined,
  };
}

export async function POST(req: Request) {
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

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const destination =
    typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) {
    return NextResponse.json(
      { error: "destination required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "items required (non-empty array)" },
      { status: 400 }
    );
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of body.items.slice(0, 20)) {
    const item = sanitize(raw);
    if (!item) {
      skipped++;
      continue;
    }

    // Dedup by (destination, source_url) — only when source_url is present.
    if (item.source_url) {
      const { data: existing } = await supabase
        .from("trip_recommendations")
        .select("id")
        .eq("destination", destination)
        .eq("source_url", item.source_url)
        .limit(1)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }
    }

    const { error } = await supabase.from("trip_recommendations").insert({
      destination,
      source: item.source,
      source_url: item.source_url ?? null,
      title: item.title ?? null,
      quote: item.quote ?? null,
      sentiment: item.sentiment,
      popularity_score: item.popularity_score,
      tags: item.tags,
    });

    if (error) {
      errors.push(error.message);
      skipped++;
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    ok: true,
    destination,
    inserted,
    skipped,
    errors: errors.slice(0, 5),
  });
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";
import { findDestination } from "@/lib/destinations";

/**
 * POST /api/trip/[id]/plan/generate
 *
 * Body: { preferences: TripPreferences }
 * Flow:
 *   1. Auth + trip ownership
 *   2. Save preferences to trips.preferences
 *   3. Load all trip_days + destination catalog
 *   4. Call Claude: for each day return a chronological list of plan items
 *      respecting day_type (Shabbat/Chag = no car, walking only, kosher meals)
 *   5. Persist per-day to trip_days.generated_plan
 *   6. Return summary
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `אתה מתכנן טיולים מקצועי למשפחות ישראליות דתיות. חובה:
1. החזר JSON בלבד (ללא markdown, ללא טקסט לפני/אחרי).
2. לעולם אל תמציא מספרי טלפון, וואטסאפ או כתובות ספציפיות — רק מידע שקיים ב-catalog שאני מוסר לך.
3. עבור ימים בסטטוס shabbat או chag: אסור רכב/נסיעה, אסור עסקאות, הצע פעילויות בהליכה בלבד ומסעדות/סעודות כשרות בלבד.
4. התאם את הקצב להעדפת המשתמש (slow/balanced/packed): slow=3-4 פריטים ליום, balanced=5-6, packed=7-8.
5. בחר אטרקציות מ-catalog לפי interests של המשתמש. אם אין התאמה — אל תמציא, הצע "בילוי חופשי" עם notes.
6. ארוחות: breakfast, lunch, dinner (ובשבת גם seuda_1/2/3) עם שעות הגיוניות + התאמה למדיניות meals (restaurant/self_cooking/mixed).
7. כלול זמן נסיעה בין פריטים כ-travel items עם duration_min.
8. כל item עם attraction_id רק אם הוא בקטלוג; אחרת null.`;

interface RequestBody {
  preferences: {
    pace?: "slow" | "balanced" | "packed";
    interests?: string[];
    transport?: "rental_car" | "taxi" | "walking" | "mixed";
    daily_start?: string;
    daily_end?: string;
    siesta?: boolean;
    meals?: { style?: string; cuisines?: string[]; kosher_level?: string };
    budget_per_day?: number;
  };
}

interface GeneratedDay {
  day_id: string;
  items: Array<{
    time: string;
    type: "attraction" | "meal" | "travel" | "rest";
    title: string;
    duration_min?: number;
    attraction_id?: string | null;
    description?: string | null;
    notes?: string | null;
  }>;
}

interface GeneratedPlan {
  days: GeneratedDay[];
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await ctx.params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY missing — contact admin" },
      { status: 500 }
    );
  }

  const body = (await req.json()) as RequestBody;
  if (!body.preferences) {
    return NextResponse.json({ error: "preferences required" }, { status: 400 });
  }

  const [tripRes, daysRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase
      .from("trip_days")
      .select("id, date, hebrew_date, day_type")
      .eq("trip_id", tripId)
      .order("date", { ascending: true }),
  ]);

  if (!tripRes.data) return NextResponse.json({ error: "trip not found" }, { status: 404 });
  const trip = tripRes.data;
  const days = daysRes.data ?? [];

  // Build catalog from static destinations for this country
  const destination = findDestination(trip.destination, trip.country_code);
  const catalog = destination
    ? destination.attractions.map((a, i) => ({
        id: `${trip.id}-${a.name}`,
        name: a.name,
        type: a.type,
        description: a.description,
        duration_minutes: a.duration_minutes ?? 120,
        religious_compatible: a.religious_compatible ?? false,
        kids_friendly: a.kids_friendly ?? false,
        must_visit: a.must_visit ?? false,
      }))
    : [];

  // Save preferences immediately (so UI can reflect them even if AI fails)
  const preferencesWithTimestamp = { ...body.preferences, generated_at: new Date().toISOString() };
  await supabase
    .from("trips")
    .update({ preferences: preferencesWithTimestamp })
    .eq("id", tripId);

  const userPrompt = `טיול:
- שם: ${trip.name}
- יעד: ${trip.destination} (${trip.country_code})
- תאריכים: ${trip.start_date} → ${trip.end_date}
- סוג חג: ${trip.holiday_type}

ימים (${days.length}):
${days.map((d) => `- ${d.id} | ${d.date} (${d.hebrew_date || "-"}) | day_type=${d.day_type}`).join("\n")}

העדפות משתמש:
${JSON.stringify(body.preferences, null, 2)}

Catalog אטרקציות זמינות (השתמש רק באלו):
${JSON.stringify(catalog, null, 2)}

החזר JSON בפורמט הבא בדיוק:
{
  "days": [
    {
      "day_id": "uuid-של-היום",
      "items": [
        { "time": "08:00", "type": "meal", "title": "ארוחת בוקר במלון", "duration_min": 45 },
        { "time": "09:00", "type": "attraction", "title": "שם אטרקציה מהקטלוג", "attraction_id": "trip-id-attraction-name", "duration_min": 120, "description": "למה זה מתאים" },
        { "time": "11:30", "type": "travel", "title": "נסיעה לארוחת צהריים", "duration_min": 30 }
      ]
    }
  ]
}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let plan: GeneratedPlan;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = msg.content.find((c) => c.type === "text")?.text ?? "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    plan = JSON.parse(cleaned) as GeneratedPlan;
  } catch (err) {
    console.error("plan generation failed", err);
    return NextResponse.json(
      { error: "AI generation failed — try again" },
      { status: 502 }
    );
  }

  // Persist each day's plan
  const updates = plan.days.map(async (d) => {
    await supabase
      .from("trip_days")
      .update({ generated_plan: d.items })
      .eq("id", d.day_id)
      .eq("trip_id", tripId);
  });
  await Promise.all(updates);

  return NextResponse.json({
    ok: true,
    days_generated: plan.days.length,
    total_items: plan.days.reduce((acc, d) => acc + d.items.length, 0),
  });
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/trip/[id]/plan/seed  (admin-only)
 * Body: { freeText: string }
 *
 * Admin pastes a trip plan in free-form Hebrew. Claude parses it into the
 * same PlanItem[] schema as the wizard output and we write it to each day's
 * `generated_plan` JSONB. From then on the client sees it as a normal
 * pre-made plan and can adopt/modify just like an AI-generated plan.
 *
 * Same guardrails as /api/trip/[id]/plan/generate — Claude is instructed
 * not to invent phone numbers and to respect Shabbat/Chag rules.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

const PARSE_SYSTEM_PROMPT = `אתה ממיר תכנית טיול שנכתבה בעברית חופשית לפורמט JSON מובנה.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
‼️ כללי ברזל:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 לעולם אל תמציא מספרי טלפון, וואטסאפ או כתובות ספציפיות, גם אם המשתמש כתב אותם בטקסט. אם המשתמש כתב מספר — שמור אותו בשדה notes כ-"טלפון שמסר המנהל: X" כדי שנדע שזה מאומת אנושית.

🕯️ ימי שבת/חג (day_type=shabbat/chag): אסור travel items עם רכב/מונית. אם הטקסט מזכיר "שבת" או יום כזה, בדוק שהפריטים מכבדים.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
פורמט הפלט:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JSON בלבד (ללא markdown, ללא טקסט לפני/אחרי):
{
  "days": [
    {
      "day_number": 1,   // 1-based index matching the trip's days
      "items": [
        { "time": "09:00", "type": "attraction|meal|travel|rest", "title": "...", "duration_min": 120, "description": "...", "notes": "..." }
      ]
    }
  ]
}

כללים:
1. אם המשתמש כתב שעות — השתמש בהן. אם לא — שים ברירות מחדל הגיוניות (בוקר=08:00, צהריים=13:00, ערב=19:00).
2. type: attraction=אתרים/אטרקציות, meal=ארוחות, travel=נסיעה בין נקודות, rest=מנוחה/חזרה למלון.
3. description: 1-2 משפטים על מה זה, בלי פרטי קשר.
4. notes: אם המשתמש כתב הערה ספציפית שלא נכנסת ל-description (למשל "להזמין מראש", "נפתח רק בצהריים") — שים שם.
5. אם המשתמש כתב מספר יום (יום 1, יום שני, Day 2) — השתמש ב-day_number בהתאם (1-based).
6. אם הטקסט לא מפרק לימים — שים הכל ב-day_number: 1.
7. שמור על סדר כרונולוגי בתוך יום.`;

interface SeedRequest {
  freeText?: string;
}

interface ParsedDay {
  day_number: number;
  items: Array<{
    time: string;
    type: "attraction" | "meal" | "travel" | "rest";
    title: string;
    duration_min?: number;
    description?: string | null;
    notes?: string | null;
  }>;
}

interface ParsedPlan {
  days: ParsedDay[];
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await ctx.params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SeedRequest;
  const text = (body.freeText ?? "").trim();
  if (!text || text.length < 20) {
    return NextResponse.json(
      { error: "טקסט התוכנית קצר מדי (מינימום 20 תווים)" },
      { status: 400 }
    );
  }
  if (text.length > 20000) {
    return NextResponse.json({ error: "טקסט ארוך מדי (מקס' 20,000 תווים)" }, { status: 400 });
  }

  // ADMIN-ONLY gate: only the trip creator can seed (planned as an admin concierge tool)
  const { data: trip } = await supabase
    .from("trips")
    .select("id, created_by, country_code")
    .eq("id", tripId)
    .single();
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });
  if (trip.created_by !== user.id) {
    return NextResponse.json({ error: "only the trip admin can seed a plan" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const { data: days } = await supabase
    .from("trip_days")
    .select("id, date, hebrew_date, day_type")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });
  if (!days || days.length === 0) {
    return NextResponse.json({ error: "no trip days found" }, { status: 400 });
  }

  const userPrompt = `פרטי הטיול:
- מספר ימים: ${days.length}
- תאריכי ימים: ${days.map((d, i) => `יום ${i + 1} = ${d.date} (${d.hebrew_date || "-"}, day_type=${d.day_type})`).join(" · ")}

הנה התוכנית שהמנהל כתב בטקסט חופשי:
"""
${text}
"""

פרסר את זה לפי הפורמט המבוקש. חשוב: day_number הוא 1-based ומתאים ל-"יום N" ברשימת הימים לעיל.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let parsed: ParsedPlan;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textOut = msg.content.find((c) => c.type === "text")?.text ?? "";
    const cleaned = textOut.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    parsed = JSON.parse(cleaned) as ParsedPlan;
  } catch (err) {
    console.error("[plan/seed] parse failed", err);
    return NextResponse.json(
      { error: "לא הצלחנו לפרסר את התוכנית — נסו שוב או פשטו את הטקסט" },
      { status: 502 }
    );
  }

  // Apply phone/Shabbat guardrails on the parsed output (same regex as
  // /api/trip/[id]/plan/generate). Admin-pasted text is more trusted but
  // we still strip any accidentally-pasted "0501234567" that looks like
  // free-floating contact info — it should be in notes, not title.
  const phoneLike = /(\+\d[\d\-\s()]{6,}|\b0\d[\d\-]{7,}\b|\bwhatsapp[^\n]*\d)/gi;
  const carWordsRe = /\b(רכב|מונית|מוניות|נסיעה|נסיעות|אוטובוס|רכבת|מטוס|טיסה)\b/;
  const isReligiousDay = (t: string) => t === "shabbat" || t === "chag" || t === "shabbat_chol_hamoed";

  let phonesStripped = 0;
  let carsRemoved = 0;

  // Map day_number (1-based) → trip_day row
  const dayByIdx = new Map<number, (typeof days)[number]>();
  days.forEach((d, i) => dayByIdx.set(i + 1, d));

  // Build the sanitized plan per trip_day.id
  const persistByDayId = new Map<string, ParsedDay["items"]>();

  for (const d of parsed.days ?? []) {
    const tripDay = dayByIdx.get(d.day_number);
    if (!tripDay) continue; // skip out-of-range day numbers silently
    const religious = isReligiousDay(tripDay.day_type);

    const clean = (d.items ?? [])
      .filter((it) => {
        if (!religious) return true;
        const hay = `${it.title} ${it.description ?? ""} ${it.notes ?? ""}`;
        if (carWordsRe.test(hay)) {
          carsRemoved++;
          return false;
        }
        return true;
      })
      .map((it) => {
        const strip = (s: string | null | undefined) => {
          if (!s) return s;
          const before = s;
          const after = s.replace(phoneLike, "[הוסר — אמת ידנית]");
          if (before !== after) phonesStripped++;
          return after;
        };
        return {
          ...it,
          title: strip(it.title) ?? it.title,
          description: strip(it.description),
          notes: strip(it.notes),
        };
      })
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

    persistByDayId.set(tripDay.id, clean);
  }

  // Write: for every day that has items, update trip_days.generated_plan
  await Promise.all(
    Array.from(persistByDayId.entries()).map(([dayId, items]) =>
      supabase
        .from("trip_days")
        .update({ generated_plan: items })
        .eq("id", dayId)
        .eq("trip_id", tripId)
        .then((r) => r)
    )
  );

  // Also save a snapshot labeled "תוכנית המנהל" for the history panel
  try {
    await supabase.from("plan_snapshots").insert({
      trip_id: tripId,
      created_by: user.id,
      preferences: { seeded_by_admin: true, seeded_at: new Date().toISOString() },
      days_payload: Array.from(persistByDayId.entries()).map(([day_id, items]) => ({ day_id, items })),
      label: "תוכנית המנהל",
      total_items: Array.from(persistByDayId.values()).reduce((a, v) => a + v.length, 0),
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    ok: true,
    days_seeded: persistByDayId.size,
    total_items: Array.from(persistByDayId.values()).reduce((a, v) => a + v.length, 0),
    guardrails: { phones_stripped: phonesStripped, cars_removed: carsRemoved },
  });
}

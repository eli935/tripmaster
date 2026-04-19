import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";
import { findDestination } from "@/lib/destinations";
import { callGemini, hasGeminiKey } from "@/lib/gemini";

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

const SYSTEM_PROMPT = `אתה מתכנן טיולים מקצועי למשפחות ישראליות דתיות.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
‼️ כללי ברזל — חובה להקפיד עליהם ללא יוצא מן הכלל:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 איסור הפצת מידע קשר מומצא:
לעולם אל תכתוב מספרי טלפון, מספרי וואטסאפ, כתובות מייל, קישורים לאתרים או כתובות גיאוגרפיות ספציפיות — גם אם המשתמש שואל במפורש.
גם אם אתה "די בטוח" שאתה מכיר את המספר — אל תכתוב אותו.
אם יש צורך להתייחס לספק — כתוב רק את שם העסק ותיאור כללי, בלי פרטי קשר.
כל מספר או כתובת שתכתוב יחשב Hallucination וייחסם אוטומטית.

🕯️ כללי שבת וחג (ימים בסטטוס shabbat/chag/shabbat_chol_hamoed):
- אסור בהחלט: רכב, מונית, אוטובוס, רכבת, טיסה, נסיעות מכל סוג.
- אסור: פעילויות בתשלום, קניות, מסעדות שאינן כשרות.
- מותר: הליכה לבית הכנסת, פעילויות חוץ בקרבת המלון, סעודות (seuda_1/2/3) במלון או בדירה.
- אם יום שבת/חג, הצע רק items מסוג meal או rest או attraction שניתן להגיע אליהם בהליכה (מ-religious_compatible=true בלבד).

✈️ כללי יום נחיתה / יום חזרה:
- ביום הראשון של הטיול (arrival day): התוכנית מתחילה לא לפני שעת הנחיתה + 90 דקות (זמן איסוף מזוודות + מעבר למלון). אל תציע פעילויות לפני זה. אם הנחיתה ב-15:00, היום יתחיל מ-16:30 ויכיל פריט קליל אחד + ארוחת ערב בלבד.
- ביום האחרון של הטיול (departure day): התוכנית מסתיימת לפחות 3 שעות לפני שעת ההמראה (יעד → שדה תעופה + check-in). אל תציע פעילויות אחרי זה. הצע רק ארוחת בוקר + סגירת מזוודות + travel item לשדה התעופה.
- ימי הנחיתה/חזרה מסומנים ב-user prompt עם flag arrival_day=true או departure_day=true.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
פורמט:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. החזר JSON בלבד (ללא markdown, ללא טקסט לפני/אחרי).
2. התאם קצב להעדפת המשתמש: slow=3-4 פריטים ליום, balanced=5-6, packed=7-8.
3. התאם את סוג הפעילויות ל-vibe: adventure=הרפתקני/אאוטדור, sport=פעיל, solid=רגוע ותרבותי, scenic=תצפיות וטבע, mixed=מגוון.
4. אם המשתמש כתב משהו ב-feeling — התייחס אליו בבחירת הפריטים (למשל "זמן איכות עם ילדים" → יותר פעילויות משפחתיות, פחות מוזיאונים).
5. בחר אטרקציות מ-catalog לפי interests של המשתמש. אם אין התאמה — אל תמציא, הצע "בילוי חופשי" עם notes.
6. ארוחות: breakfast, lunch, dinner (ובשבת גם seuda_1/2/3) עם שעות הגיוניות + התאמה למדיניות meals (restaurant/self_cooking/mixed).
7. כלול זמן נסיעה בין פריטים כ-travel items עם duration_min — *רק בימי חול*.
8. כל item עם attraction_id רק אם הוא קיים בקטלוג שמסרתי; אחרת attraction_id=null.
9. description: תיאור קצר (עד 2 משפטים) למה הפריט מתאים — בלי פרטי קשר.`;

/**
 * Ensemble merge: combine two same-schema plans from different models.
 * Per day:
 *   - Start from Claude's items (primary).
 *   - Add Gemini items whose normalized title isn't already present.
 *   - If an item exists in both, keep the one with the richer description.
 *   - Re-sort by time.
 * Days not present in both are taken from whichever plan provided them.
 */
function normTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "");
}

function mergePlans(
  a: GeneratedPlan | null,
  b: GeneratedPlan | null,
  days: Array<{ id: string }>
): GeneratedPlan {
  // Index by day_id
  const aByDay = new Map<string, GeneratedItem[]>();
  const bByDay = new Map<string, GeneratedItem[]>();
  for (const d of a?.days ?? []) aByDay.set(d.day_id, d.items ?? []);
  for (const d of b?.days ?? []) bByDay.set(d.day_id, d.items ?? []);

  const mergedDays: GeneratedDay[] = days.map(({ id }) => {
    const aItems = aByDay.get(id) ?? [];
    const bItems = bByDay.get(id) ?? [];
    if (aItems.length === 0) return { day_id: id, items: bItems };
    if (bItems.length === 0) return { day_id: id, items: aItems };

    const out: GeneratedItem[] = [];
    const seen = new Map<string, number>(); // normalized title → index in `out`

    const pushOrEnrich = (it: GeneratedItem) => {
      const key = normTitle(it.title);
      if (!key) return;
      const existingIdx = seen.get(key);
      if (existingIdx === undefined) {
        out.push(it);
        seen.set(key, out.length - 1);
      } else {
        // Same title — keep the richer description, and the attraction_id
        // that isn't null.
        const existing = out[existingIdx];
        const mergedDesc =
          (it.description?.length ?? 0) > (existing.description?.length ?? 0)
            ? it.description
            : existing.description;
        const mergedAttrId = existing.attraction_id ?? it.attraction_id ?? null;
        out[existingIdx] = {
          ...existing,
          description: mergedDesc ?? existing.description,
          attraction_id: mergedAttrId,
        };
      }
    };

    for (const it of aItems) pushOrEnrich(it);
    for (const it of bItems) pushOrEnrich(it);

    // Sort by time, stable
    out.sort((x, y) => (x.time ?? "").localeCompare(y.time ?? ""));
    return { day_id: id, items: out };
  });

  return { days: mergedDays };
}

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

type GeneratedItem = GeneratedDay["items"][number];

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

  // ── Compute arrival / departure day flags based on flight datetimes ──
  // Used to instruct Claude to shorten first/last day appropriately.
  const outboundDt = trip.outbound_flight_datetime
    ? new Date(trip.outbound_flight_datetime as string)
    : null;
  const returnDt = trip.return_flight_datetime
    ? new Date(trip.return_flight_datetime as string)
    : null;
  const firstDayId = days[0]?.id;
  const lastDayId = days[days.length - 1]?.id;
  const arrivalTimeStr = outboundDt
    ? outboundDt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : null;
  const departureTimeStr = returnDt
    ? returnDt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : null;

  const userPrompt = `טיול:
- שם: ${trip.name}
- יעד: ${trip.destination} (${trip.country_code})
- תאריכים: ${trip.start_date} → ${trip.end_date}
- סוג חג: ${trip.holiday_type}
${arrivalTimeStr ? `- שעת נחיתה ביעד: ${arrivalTimeStr} (יום ראשון של הטיול)` : ""}
${departureTimeStr ? `- שעת המראה חזרה: ${departureTimeStr} (יום אחרון של הטיול)` : ""}

ימים (${days.length}):
${days
  .map((d) => {
    const flags: string[] = [];
    if (d.id === firstDayId && arrivalTimeStr) flags.push(`arrival_day=true arrival_time=${arrivalTimeStr}`);
    if (d.id === lastDayId && departureTimeStr) flags.push(`departure_day=true departure_time=${departureTimeStr}`);
    return `- ${d.id} | ${d.date} (${d.hebrew_date || "-"}) | day_type=${d.day_type}${
      flags.length > 0 ? " | " + flags.join(" ") : ""
    }`;
  })
  .join("\n")}

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

  // ═══════════════════════════════════════════════════════════════════
  // ENSEMBLE: Claude + Gemini in parallel (when Gemini key available).
  // Strategy: both generate full plans; we merge per-day (de-dup by title,
  // keep the richer description). If Gemini key missing → Claude only.
  // Either model failing doesn't break the flow as long as ONE succeeded.
  // ═══════════════════════════════════════════════════════════════════
  const claudePromise = (async (): Promise<GeneratedPlan | null> => {
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = msg.content.find((c) => c.type === "text")?.text ?? "";
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      return JSON.parse(cleaned) as GeneratedPlan;
    } catch (err) {
      console.error("[plan] Claude failed", err);
      return null;
    }
  })();

  const geminiPromise = (async (): Promise<GeneratedPlan | null> => {
    if (!hasGeminiKey()) return null;
    try {
      const raw = await callGemini({
        system: SYSTEM_PROMPT,
        user: userPrompt,
        maxOutputTokens: 4096,
      });
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      return JSON.parse(cleaned) as GeneratedPlan;
    } catch (err) {
      console.warn("[plan] Gemini failed (non-fatal, continuing with Claude only)", err);
      return null;
    }
  })();

  const [claudePlan, geminiPlan] = await Promise.all([claudePromise, geminiPromise]);

  if (!claudePlan && !geminiPlan) {
    return NextResponse.json(
      { error: "AI generation failed — try again" },
      { status: 502 }
    );
  }

  const plan: GeneratedPlan = mergePlans(claudePlan, geminiPlan, days);
  const modelsUsed: string[] = [];
  if (claudePlan) modelsUsed.push("claude");
  if (geminiPlan) modelsUsed.push("gemini");

  // ═══════════════════════════════════════════════════════════════════
  // GUARDRAIL ENFORCEMENT (server-side) — trust but verify the LLM
  // ═══════════════════════════════════════════════════════════════════
  // Build quick lookup for day_type per day
  const dayTypeById = new Map<string, string>();
  for (const d of days) dayTypeById.set(d.id, d.day_type);

  // Regex: international phone numbers, Israeli formats, WhatsApp-style
  // (digits with + prefix, parens, dashes, spaces — 7+ digits total).
  const phoneLike = /(\+\d[\d\-\s()]{6,}|\b0\d[\d\-]{7,}\b|\bwhatsapp[^\n]*\d)/gi;
  // Vehicle-related Hebrew words — blocked on Shabbat/Chag
  const carWordsRe = /\b(רכב|מונית|מוניות|נסיעה|נסיעות|אוטובוס|רכבת|מטוס|טיסה)\b/;
  const isReligiousDay = (t: string | undefined) =>
    t === "shabbat" || t === "chag" || t === "shabbat_chol_hamoed";

  let violationsStripped = 0;
  let carsRemovedOnShabbat = 0;

  const sanitizedDays = plan.days.map((d) => {
    const religious = isReligiousDay(dayTypeById.get(d.day_id));
    const items = d.items
      .filter((it) => {
        // Block car/taxi/travel items on Shabbat/Chag entirely
        if (!religious) return true;
        const hay = `${it.title} ${it.description ?? ""} ${it.notes ?? ""}`;
        if (it.type === "travel" && carWordsRe.test(hay)) {
          carsRemovedOnShabbat++;
          return false;
        }
        if (carWordsRe.test(hay)) {
          carsRemovedOnShabbat++;
          return false;
        }
        return true;
      })
      .map((it) => {
        // Strip any phone-number-like strings from description/notes/title —
        // until we have a verified vendors DB, NO contact details are allowed
        // to reach the user. This enforces the "don't fabricate phones" rule.
        const strip = (s: string | null | undefined) => {
          if (!s) return s;
          const before = s;
          const after = s.replace(phoneLike, "[הוסר — לא מאומת]");
          if (before !== after) violationsStripped++;
          return after;
        };
        return {
          ...it,
          title: strip(it.title) ?? it.title,
          description: strip(it.description),
          notes: strip(it.notes),
        };
      });
    return { ...d, items };
  });

  // ═══════════════════════════════════════════════════════════════════
  // VENDOR ENRICHMENT — match items to verified vendors in DB
  // (No second Claude call needed; pure DB join. AI never sees vendor phones.)
  // ═══════════════════════════════════════════════════════════════════
  const { data: vendorRows } = await supabase
    .from("vendors")
    .select("*")
    .eq("country_code", trip.country_code);
  const vendors = vendorRows ?? [];

  function matchVendor(item: { type: string; title: string }) {
    // Match by type → vendor_type + title similarity (simple substring check)
    const vendorTypes: Record<string, string[]> = {
      meal: ["restaurant", "kosher_store", "chabad"],
      attraction: ["activity", "tour", "guide"],
    };
    const allowed = vendorTypes[item.type];
    if (!allowed) return null;
    const candidates = vendors.filter((v) => allowed.includes(v.vendor_type));
    // Exact-ish match by name overlap
    const titleLower = item.title.toLowerCase();
    return (
      candidates.find((v) => {
        const n = (v.name || "").toLowerCase();
        const ne = (v.name_en || "").toLowerCase();
        return (
          (n && titleLower.includes(n.slice(0, 8))) ||
          (ne && titleLower.includes(ne.slice(0, 8))) ||
          (n && n.includes(titleLower.slice(0, 8)))
        );
      }) ?? null
    );
  }

  const enrichedDays = sanitizedDays.map((d) => ({
    ...d,
    items: d.items.map((it) => {
      const v = matchVendor(it);
      if (!v) return it;
      return {
        ...it,
        vendor: {
          name: v.name as string,
          phone: (v.phone as string | null) ?? undefined,
          whatsapp: (v.whatsapp as string | null) ?? undefined,
          maps_url: (v.maps_url as string | null) ?? undefined,
          notes: (v.notes as string | null) ?? undefined,
        },
        verified: Boolean(v.verified),
      };
    }),
  }));

  // Persist each day's sanitized+enriched plan
  const updates = enrichedDays.map(async (d) => {
    await supabase
      .from("trip_days")
      .update({ generated_plan: d.items })
      .eq("id", d.day_id)
      .eq("trip_id", tripId);
  });
  await Promise.all(updates);

  // Save snapshot for undo/history (Phase 3)
  const totalItems = enrichedDays.reduce((acc, d) => acc + d.items.length, 0);
  try {
    // Count existing snapshots to auto-label ("ריצה #N")
    const { count } = await supabase
      .from("plan_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId);
    const runNumber = (count ?? 0) + 1;
    await supabase.from("plan_snapshots").insert({
      trip_id: tripId,
      created_by: user.id,
      preferences: preferencesWithTimestamp,
      days_payload: enrichedDays,
      label: `ריצה #${runNumber}`,
      total_items: totalItems,
    });
  } catch (snapErr) {
    console.warn("[plan/generate] snapshot save failed (non-fatal)", snapErr);
  }

  if (violationsStripped > 0 || carsRemovedOnShabbat > 0) {
    console.warn("[plan/generate] guardrail violations", {
      tripId,
      violationsStripped,
      carsRemovedOnShabbat,
    });
  }

  return NextResponse.json({
    ok: true,
    days_generated: enrichedDays.length,
    total_items: totalItems,
    models_used: modelsUsed,
    guardrails: {
      phones_stripped: violationsStripped,
      shabbat_vehicles_blocked: carsRemovedOnShabbat,
    },
  });
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Recipe generation API — Stage 4
 *
 * POST { mealDescription: string, attendeesCount: number, tripId: string }
 *
 * Flow:
 *  1. Hash normalized mealDescription → lookup meal_recipes.content_hash. If found, return cached row.
 *  2. Rate limit guard: ≤ 10 generations per trip per hour.
 *  3. If ANTHROPIC_API_KEY missing → return 400 gracefully.
 *  4. Call Claude Haiku 4.5 with cached system prompt, parse JSON.
 *  5. Persist in meal_recipes (content_hash, trip_id) and return.
 */

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
const RATE_LIMIT_PER_HOUR = 10;

interface RecipeIngredient {
  name: string;
  quantity_per_person: number;
  unit: string;
}

interface Recipe {
  name: string;
  description: string;
  instructions: string;
  ingredients: RecipeIngredient[];
}

const SYSTEM_PROMPT = `אתה שף וטבח מקצועי. תמיד החזר JSON תקף בעברית בלבד — ללא markdown, ללא טקסט לפני או אחרי. ודא שכמויות הינן לנפש אחת (quantity_per_person) ולא לכלל הסועדים.`;

function normalizeForHash(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      mealDescription?: string;
      attendeesCount?: number;
      tripId?: string;
    };

    const mealDescription = (body.mealDescription || "").trim();
    const attendeesCount = Math.max(1, Number(body.attendeesCount) || 1);
    const tripId = (body.tripId || "").trim();

    if (!mealDescription || !tripId) {
      return NextResponse.json(
        { error: "missing mealDescription or tripId" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // 1) Cache lookup by content hash
    const contentHash = hashText(normalizeForHash(mealDescription));
    try {
      const { data: cached } = await supabase
        .from("meal_recipes")
        .select("*")
        .eq("content_hash", contentHash)
        .maybeSingle();
      if (cached) {
        return NextResponse.json({ recipe: cached, cached: true });
      }
    } catch {
      /* non-fatal */
    }

    // 2) Rate limit — per trip per hour
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("meal_recipes")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .gte("created_at", oneHourAgo);
      if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
        return NextResponse.json(
          {
            error:
              "הגעת למגבלת יצירת מתכונים לשעה (10 מתכונים). נסה שוב בעוד זמן קצר.",
          },
          { status: 429 }
        );
      }
    } catch {
      /* non-fatal */
    }

    // 3) Graceful fallback when no key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 400 });
    }

    // 4) Claude call
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userPrompt = `עבור: "${mealDescription}" עבור ${attendeesCount} סועדים:
החזר JSON בלבד:
{
  "name": "שם הארוחה",
  "description": "תיאור קצר",
  "instructions": "הוראות הכנה (3-5 שלבים)",
  "ingredients": [
    {"name": "ביצים", "quantity_per_person": 2, "unit": "יח׳"},
    {"name": "עגבנייה", "quantity_per_person": 0.5, "unit": "יח׳"}
  ]
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
      return NextResponse.json(
        { error: "AI returned invalid format" },
        { status: 502 }
      );
    }

    let recipe: Recipe;
    try {
      recipe = JSON.parse(jsonMatch[0]) as Recipe;
    } catch {
      return NextResponse.json(
        { error: "AI returned malformed JSON" },
        { status: 502 }
      );
    }

    if (!Array.isArray(recipe.ingredients)) recipe.ingredients = [];

    // 5) Persist
    const { data: inserted, error: insertErr } = await supabase
      .from("meal_recipes")
      .insert({
        name: recipe.name || mealDescription,
        description: recipe.description || null,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions || null,
        source: "ai",
        trip_id: tripId,
        content_hash: contentHash,
      })
      .select()
      .single();

    if (insertErr) {
      // Likely a race on unique content_hash — re-read the existing row
      const { data: existing } = await supabase
        .from("meal_recipes")
        .select("*")
        .eq("content_hash", contentHash)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ recipe: existing, cached: true });
      }
      return NextResponse.json(
        { error: "Failed to persist recipe" },
        { status: 500 }
      );
    }

    return NextResponse.json({ recipe: inserted, cached: false });
  } catch (err) {
    console.error("[generate-recipe] error:", err);
    return NextResponse.json(
      { error: "שגיאה פנימית בשרת" },
      { status: 500 }
    );
  }
}

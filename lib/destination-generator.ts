import Anthropic from "@anthropic-ai/sdk";
import type { DestinationInfo } from "./destinations";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

/**
 * Generate full destination data using Claude for any location.
 * Returns a DestinationInfo-compatible object with Chabad, restaurants, attractions.
 */
export async function generateDestinationData(
  destination: string,
  countryCode?: string
): Promise<DestinationInfo | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set");
    return null;
  }

  const prompt = `אתה מומחה לתיירות יהודית חרדית בחו"ל. צור מידע מקיף על היעד "${destination}" למשפחה חרדית.

חשוב: כל התוכן בעברית. הפלט חייב להיות JSON תקף בדיוק בפורמט הבא (ללא markdown, ללא הסברים):

{
  "name": "שם היעד בעברית",
  "country": "שם מדינה באנגלית",
  "country_code": "קוד 2-אותיות",
  "currency": "קוד מטבע ISO (EUR/USD/GBP וכו')",
  "currency_symbol": "סמל המטבע",
  "hero_image": "URL של Unsplash עבור תמונת hero ראש הדף של היעד (w=800&q=75)",
  "gallery": ["3-5 URLs של Unsplash לגלריה"],
  "description": "תיאור עברי של 2-3 משפטים על היעד ומה שהוא מציע למשפחות חרדיות",
  "language": "השפה המדוברת",
  "timezone": "אזור זמן (למשל Europe/Paris (UTC+1))",
  "emergency_phone": "מספר חירום מקומי",
  "chabad": [
    {
      "name": "שם בית חב\\"ד בעברית",
      "rabbi": "שם הרב",
      "address": "כתובת מלאה",
      "phone": "+XXX-XX-XXXXXXX",
      "whatsapp": "אותו מספר טלפון",
      "email": "אימייל אם זמין",
      "website": "אתר",
      "google_maps": "https://maps.google.com/?q=...",
      "services": ["תפילות", "סעודות שבת", "מזון כשר"],
      "notes": "הערות חשובות"
    }
  ],
  "restaurants": [
    {
      "name": "שם המסעדה הכשרה בעברית",
      "type": "meat או dairy או parve",
      "certification": "מי נותן את ההכשר",
      "address": "כתובת",
      "phone": "+XXX-XXXXXXX",
      "google_maps": "https://maps.google.com/?q=...",
      "hours": "שעות פתיחה",
      "price_range": "$ או $$ או $$$",
      "specialties": ["מאכלים עיקריים"]
    }
  ],
  "attractions": [
    {
      "name": "שם האטרקציה בעברית",
      "type": "אחד מ: nature, historic, beach, museum, activity, viewpoint, religious, kids",
      "description": "תיאור של 1-2 משפטים בעברית",
      "address": "כתובת",
      "google_maps": "https://maps.google.com/?q=...",
      "website": "אתר אם קיים",
      "price": "מחיר באירו/דולר/מטבע מקומי",
      "duration": "משך ביקור (למשל 2-3 שעות)",
      "hours": "שעות פתיחה",
      "image": "URL של Unsplash מתאים (w=600&q=75)",
      "must_visit": true/false,
      "kids_friendly": true/false,
      "religious_compatible": true/false
    }
  ],
  "shopping_centers": [
    {
      "name": "שם סופרמרקט/מרכז קניות",
      "address": "כתובת",
      "google_maps": "https://maps.google.com/?q=...",
      "notes": "הערות על שעות/כשרות"
    }
  ],
  "airport": {
    "name": "שם שדה התעופה באנגלית",
    "code": "קוד IATA 3 אותיות",
    "address": "מיקום",
    "google_maps": "https://maps.google.com/?q=..."
  },
  "weather_note": "מזג אוויר עדכני (אם עונה רלוונטית)",
  "halachic_notes": ["2-4 הערות הלכתיות ספציפיות ליעד"],
  "coordinates": {
    "lat": 41.9028,
    "lng": 12.4964,
    "tz": "Europe/Rome",
    "geonameid": 3169070
  }
}

הנחיות:
- ספק לפחות 1 בית חב"ד (אם אין — ציין קהילה יהודית הכי קרובה)
- ספק לפחות 1 מסעדה כשרה (אם אין — ציין שניתן להזמין דרך חב"ד)
- ספק 6-10 אטרקציות, לפחות חלקן מתאימות לילדים ולשבת
- השתמש בקישורי Unsplash אמיתיים ומתאימים לאטמוספרה של היעד (photo-XXXXX)
- כל הקישורים ל-Google Maps חייבים להתחיל ב-https://maps.google.com/?q=
- כל הטלפונים עם + וקוד מדינה
- CRITICAL: שדה coordinates חובה! lat+lng+tz (IANA timezone) של מרכז העיר. geonameid אופציונלי (רק אם בטוח).`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response");
      return null;
    }

    const data = JSON.parse(jsonMatch[0]) as DestinationInfo;
    return data;
  } catch (error) {
    console.error("Claude generation error:", error);
    return null;
  }
}

/**
 * Get destination: check cache first, generate if missing
 */
export async function getOrGenerateDestination(
  supabase: any,
  destination: string,
  countryCode?: string
): Promise<DestinationInfo | null> {
  const key = destination.trim().toLowerCase();

  // Check cache
  const { data: cached } = await supabase
    .from("destinations_cache")
    .select("data")
    .eq("destination_key", key)
    .single();

  if (cached?.data) {
    return cached.data as DestinationInfo;
  }

  // Generate new one
  const generated = await generateDestinationData(destination, countryCode);
  if (!generated) return null;

  // Save to cache
  await supabase
    .from("destinations_cache")
    .insert({
      destination_key: key,
      country_code: generated.country_code,
      data: generated,
    });

  return generated;
}

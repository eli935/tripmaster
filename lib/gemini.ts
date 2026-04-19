/**
 * Google Gemini REST wrapper — minimal, no SDK dependency.
 *
 * Env:
 *   GOOGLE_GEMINI_API_KEY — from https://aistudio.google.com/app/apikey (free tier generous)
 *
 * Model used: gemini-2.0-flash — fast, cheap, handles Hebrew well.
 */

const DEFAULT_MODEL = "gemini-2.0-flash";

export function hasGeminiKey(): boolean {
  return typeof process.env.GOOGLE_GEMINI_API_KEY === "string" && process.env.GOOGLE_GEMINI_API_KEY.length > 0;
}

export interface GeminiCallArgs {
  system: string;
  user: string;
  maxOutputTokens?: number;
  model?: string;
  timeoutMs?: number;
}

/**
 * Calls Gemini's generateContent endpoint. Returns the text output or
 * throws on failure. Callers should wrap in try/catch since graceful
 * degradation at the API-route level is preferred.
 */
export async function callGemini(args: GeminiCallArgs): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY missing");

  const model = args.model ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 45000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: args.maxOutputTokens ?? 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty response");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

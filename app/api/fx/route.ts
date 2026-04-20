import { NextResponse } from "next/server";
import { getRateForDate } from "@/lib/currency";

/**
 * GET /api/fx?date=YYYY-MM-DD&base=ILS&target=EUR
 *
 * Returns `{ rate, rate_date, requested_date, source }` or 404 if unsupported.
 * Used by client components (expense dialog) to lock a historical FX rate
 * at the moment the expense is recorded.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const base = url.searchParams.get("base") || "ILS";
  const target = url.searchParams.get("target");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  if (!target || !/^[A-Z]{3}$/.test(target)) {
    return NextResponse.json({ error: "bad target" }, { status: 400 });
  }

  const result = await getRateForDate(date, base, target);
  if (!result) {
    return NextResponse.json(
      { error: "rate unavailable", date, base, target },
      { status: 404 }
    );
  }
  return NextResponse.json(result);
}

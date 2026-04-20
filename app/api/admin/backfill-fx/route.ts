import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRateForDate } from "@/lib/currency";

/**
 * POST /api/admin/backfill-fx
 *
 * For every expense with a foreign currency and a missing `fx_rate_to_ils`
 * or `fx_rate_date`, look up the historical rate (via daily_fx_rates cache
 * → Frankfurter on miss) for `COALESCE(expense_date, created_at::date)` and
 * persist it.
 *
 * Idempotent: rows that already have both `fx_rate_to_ils` and
 * `fx_rate_date` are skipped.
 *
 * Auth: Bearer CRON_SECRET (same gate as Vercel crons — admin-only because
 * only the server knows the secret).
 *
 * Response: `{ scanned, updated, skipped, failed, failures: [...] }`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev fallback
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = serviceClient();
  if (!db) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  // Candidates: foreign currency AND (rate missing OR rate_date missing).
  const { data: rows, error } = await db
    .from("expenses")
    .select("id, currency, amount, expense_date, fx_rate_to_ils, fx_rate_date, created_at")
    .neq("currency", "ILS")
    .or("fx_rate_to_ils.is.null,fx_rate_date.is.null");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const failures: Array<{ id: string; reason: string }> = [];
  let updated = 0;
  let skipped = 0;

  for (const row of rows || []) {
    const date =
      (row.expense_date as string | null) ||
      (row.created_at ? String(row.created_at).slice(0, 10) : null);
    if (!date) {
      failures.push({ id: row.id, reason: "no date to look up" });
      continue;
    }

    // Skip fully-populated rows (defensive — OR filter above should exclude).
    if (row.fx_rate_to_ils && row.fx_rate_date) {
      skipped++;
      continue;
    }

    const rate = await getRateForDate(date, row.currency as string, "ILS");
    if (!rate) {
      failures.push({ id: row.id, reason: `no rate for ${row.currency} on ${date}` });
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (!row.expense_date) patch.expense_date = date;
    if (!row.fx_rate_to_ils) patch.fx_rate_to_ils = rate.rate;
    if (!row.fx_rate_date) patch.fx_rate_date = rate.rate_date;
    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }
    patch.fx_locked_at = new Date().toISOString();

    const { error: upErr } = await db.from("expenses").update(patch).eq("id", row.id);
    if (upErr) {
      failures.push({ id: row.id, reason: upErr.message });
      continue;
    }
    updated++;
  }

  return NextResponse.json({
    scanned: rows?.length || 0,
    updated,
    skipped,
    failed: failures.length,
    failures,
  });
}

// GET mirrors POST for manual browser testing.
export async function GET(req: Request) {
  return POST(req);
}

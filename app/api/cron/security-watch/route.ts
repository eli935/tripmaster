import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendSecurityAlertEmail } from "@/lib/mailer";

/**
 * Daily security watcher.
 *
 * Fetches each bulletin URL in WATCH_LIST, extracts body text, hashes it,
 * compares to the last-known hash in `security_bulletins`. If the hash
 * changed (or the URL is new), sends an email alert to Eli with an excerpt
 * and asks for confirmation before any automated action.
 *
 * Runs from Vercel cron via Bearer CRON_SECRET. Can also be triggered
 * manually for on-demand checks.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const WATCH_LIST: Array<{ url: string; label: string }> = [
  {
    url: "https://vercel.com/kb/bulletin/vercel-april-2026-security-incident",
    label: "Vercel — April 2026 Security Incident",
  },
];

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

function hashContent(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Crudely strip HTML tags + collapse whitespace. Good enough for detecting
// *content* changes on a static bulletin page (false positives on dynamic
// banners are acceptable since the user is the final judge).
function extractBody(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "no service role" }, { status: 500 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const results: Array<{
    url: string;
    status: "unchanged" | "changed" | "new" | "fetch_failed";
    message?: string;
  }> = [];

  for (const item of WATCH_LIST) {
    try {
      const res = await fetch(item.url, {
        headers: { "User-Agent": "TripMaster-SecurityWatcher/1.0" },
        cache: "no-store",
      });
      if (!res.ok) {
        results.push({ url: item.url, status: "fetch_failed", message: `HTTP ${res.status}` });
        continue;
      }
      const html = await res.text();
      const body = extractBody(html);
      const hash = hashContent(body);
      const excerpt = body.slice(0, 1500);

      const { data: existing } = await db
        .from("security_bulletins")
        .select("*")
        .eq("url", item.url)
        .maybeSingle();

      if (!existing) {
        await db.from("security_bulletins").insert({
          url: item.url,
          label: item.label,
          content_hash: hash,
          content_excerpt: excerpt,
          check_count: 1,
        });
        await sendSecurityAlertEmail({
          severity: "watch",
          subject: `מוניטור חדש נוסף: ${item.label}`,
          summary:
            "הוספנו את כתובת ה-bulletin למעקב יומי. נאזעק ברגע שתוכן הדף ישתנה.",
          detailsHtml: `<div><strong>מקור:</strong> ${item.url}</div><hr><pre style='white-space:pre-wrap;font-family:inherit;font-size:12px;'>${escapeHtml(excerpt.slice(0, 800))}...</pre>`,
          sourceUrl: item.url,
        });
        results.push({ url: item.url, status: "new" });
      } else if (existing.content_hash !== hash) {
        await db
          .from("security_bulletins")
          .update({
            content_hash: hash,
            content_excerpt: excerpt,
            last_changed_at: new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
            check_count: (existing.check_count ?? 0) + 1,
          })
          .eq("id", existing.id);
        await sendSecurityAlertEmail({
          severity: "action_required",
          subject: `🔔 עדכון חדש: ${item.label}`,
          summary:
            "תוכן ה-bulletin השתנה מאז הבדיקה האחרונה. בדיקה ידנית + אישור פעולות נדרשים מיד.",
          detailsHtml: `
            <div><strong>שינוי זוהה:</strong> ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</div>
            <div><strong>בדיקה אחרונה לפני:</strong> ${existing.last_checked_at ? new Date(existing.last_checked_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "—"}</div>
            <hr>
            <div><strong>תקציר חדש (1500 תווים ראשונים):</strong></div>
            <pre style='white-space:pre-wrap;font-family:inherit;font-size:12px;'>${escapeHtml(excerpt)}</pre>
          `,
          sourceUrl: item.url,
        });
        results.push({ url: item.url, status: "changed" });
      } else {
        await db
          .from("security_bulletins")
          .update({
            last_checked_at: new Date().toISOString(),
            check_count: (existing.check_count ?? 0) + 1,
          })
          .eq("id", existing.id);
        results.push({ url: item.url, status: "unchanged" });
      }
    } catch (err) {
      results.push({
        url: item.url,
        status: "fetch_failed",
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    results,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

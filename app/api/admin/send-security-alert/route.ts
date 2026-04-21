import { NextRequest, NextResponse } from "next/server";
import { sendSecurityAlertEmail } from "@/lib/mailer";

/**
 * POST /api/admin/send-security-alert
 * Body: { severity, subject, summary, detailsHtml?, sourceUrl? }
 * Auth: Bearer CRON_SECRET.
 *
 * Ad-hoc alert channel — used by the security agent to escalate action
 * items outside the regular watcher loop.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    severity?: "info" | "watch" | "action_required" | "critical";
    subject?: string;
    summary?: string;
    detailsHtml?: string;
    sourceUrl?: string;
  };
  if (!body.subject || !body.summary) {
    return NextResponse.json({ error: "subject + summary required" }, { status: 400 });
  }
  const result = await sendSecurityAlertEmail({
    severity: body.severity ?? "action_required",
    subject: body.subject,
    summary: body.summary,
    detailsHtml: body.detailsHtml,
    sourceUrl: body.sourceUrl,
  });
  return NextResponse.json(result);
}

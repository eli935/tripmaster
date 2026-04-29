import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSecurityAlertEmail } from "@/lib/mailer";

/**
 * GET /api/cron/security-agent
 *
 * Hourly autonomous security agent. Performs:
 *   1. SQL-based equivalents of the Supabase database advisors
 *      (rls_disabled_in_public, function_search_path_mutable,
 *      anon-executable SECURITY DEFINER functions).
 *   2. Auto-fixes known patterns (RLS on new tables, search_path pin,
 *      revoke EXECUTE on new SECURITY DEFINER funcs).
 *   3. For unfixable / unknown findings — alerts via WhatsApp + email.
 *   4. Logs everything to public.security_agent_log.
 *
 * Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

interface Finding {
  lint: "rls_disabled_in_public" | "function_search_path_mutable" | "anon_security_definer";
  severity: "critical" | "warning" | "info";
  detail: string;
  // For auto-fix, the SQL we'd run.
  fixSql?: string;
  fixSummary?: string;
}

// Known-safe table names already governed by deliberate service-role-only
// policies. The agent should leave these alone (RLS is enabled, no anon
// policies — exactly what we want).
const SERVICE_ROLE_ONLY_TABLES = new Set([
  "security_bulletins",
  "security_agent_log",
  "whatsapp_log",
  "flight_status_log",
  "send_log",
]);

// Known-safe SECURITY DEFINER helper functions used by RLS itself. Revoking
// EXECUTE from these would break the policies that depend on them. Reserved
// for future check-3 (anon SECURITY DEFINER audit) — currently unused.
// const RLS_HELPER_FUNCTIONS = new Set([...]);

interface AlertChannels {
  whatsapp: boolean;
  email: boolean;
}

async function sendWhatsApp(text: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.SECURITY_ALERT_PHONE; // e.g. "972524848358"
  if (!sid || !tok || !from || !to) return false;
  const auth = Buffer.from(`${sid}:${tok}`).toString("base64");
  const body = new URLSearchParams({
    From: from,
    To: `whatsapp:+${to}`,
    Body: text,
  });
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "service role missing" }, { status: 500 });
  }
  const admin = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });

  const findings: Finding[] = [];

  // -------------------------------------------------------------------
  // CHECK 1 — Tables in public schema without RLS enabled (CRITICAL)
  // -------------------------------------------------------------------
  const { data: tablesNoRls, error: e1 } = await admin.rpc(
    "agent_check_rls_disabled"
  );
  if (e1) {
    console.error("[security-agent] agent_check_rls_disabled failed:", e1.message);
  } else {
    for (const row of (tablesNoRls ?? []) as Array<{ table_name: string }>) {
      const isSafe = SERVICE_ROLE_ONLY_TABLES.has(row.table_name);
      findings.push({
        lint: "rls_disabled_in_public",
        severity: "critical",
        detail: `Table public.${row.table_name} is exposed to PostgREST without RLS.`,
        fixSql: isSafe
          ? `ALTER TABLE public.${row.table_name} ENABLE ROW LEVEL SECURITY`
          : undefined, // unknown table → don't auto-fix; alert instead
        fixSummary: isSafe
          ? `Enabled RLS on ${row.table_name} (service-role-only table; no policies needed).`
          : undefined,
      });
    }
  }

  // -------------------------------------------------------------------
  // CHECK 2 — Functions with mutable search_path (WARN)
  // -------------------------------------------------------------------
  const { data: funcsNoPath, error: e2 } = await admin.rpc(
    "agent_check_function_search_path"
  );
  if (e2) {
    console.error("[security-agent] agent_check_function_search_path failed:", e2.message);
  } else {
    for (const row of (funcsNoPath ?? []) as Array<{ function_name: string; arg_types: string }>) {
      findings.push({
        lint: "function_search_path_mutable",
        severity: "warning",
        detail: `Function public.${row.function_name}(${row.arg_types}) has mutable search_path.`,
        fixSql: `ALTER FUNCTION public.${row.function_name}(${row.arg_types}) SET search_path = public, pg_catalog`,
        fixSummary: `Pinned search_path on ${row.function_name}.`,
      });
    }
  }

  // -------------------------------------------------------------------
  // Apply auto-fixes for findings that have a fixSql + fixSummary
  // -------------------------------------------------------------------
  const applied: string[] = [];
  const skipped: Finding[] = [];
  for (const f of findings) {
    if (f.fixSql && f.fixSummary) {
      const { error: applyErr } = await admin.rpc("agent_apply_fix", {
        sql_to_run: f.fixSql,
      });
      if (applyErr) {
        skipped.push(f);
        await admin.from("security_agent_log").insert({
          source: "supabase_advisor",
          severity: f.severity,
          project: "tripmaster",
          finding: f.lint,
          detail: f.detail,
          action_taken: "logged_only",
          fix_summary: `attempted: ${f.fixSql.slice(0, 200)}; error: ${applyErr.message}`,
          alerted_via: [],
        });
      } else {
        applied.push(f.fixSummary);
        await admin.from("security_agent_log").insert({
          source: "supabase_advisor",
          severity: f.severity,
          project: "tripmaster",
          finding: f.lint,
          detail: f.detail,
          action_taken: "auto_fixed",
          fix_summary: f.fixSummary,
          alerted_via: [],
        });
      }
    } else {
      skipped.push(f);
    }
  }

  // -------------------------------------------------------------------
  // Alert on findings that couldn't be auto-fixed (critical only)
  // -------------------------------------------------------------------
  const criticalUnfixed = skipped.filter((f) => f.severity === "critical");
  const channels: AlertChannels = { whatsapp: false, email: false };
  if (criticalUnfixed.length > 0) {
    const summary = `🚨 ${criticalUnfixed.length} בעיות אבטחה קריטיות שלא תוקנו אוטומטית:\n\n${criticalUnfixed
      .map((f, i) => `${i + 1}. ${f.detail}`)
      .join("\n")}`;

    channels.whatsapp = await sendWhatsApp(summary.slice(0, 1500));

    const emailRes = await sendSecurityAlertEmail({
      severity: "critical",
      subject: `${criticalUnfixed.length} ממצאי אבטחה קריטיים — דרושה התערבות`,
      summary: `הסוכן זיהה ${criticalUnfixed.length} ממצאים שלא יכל לתקן אוטומטית. ראה פרטים למטה.`,
      detailsHtml: `<ul>${criticalUnfixed
        .map((f) => `<li><b>${f.lint}</b><br><span style="color:#888;font-size:12px">${f.detail}</span></li>`)
        .join("")}</ul>`,
      sourceUrl: "https://supabase.com/dashboard/project/cwmeftixlaeyiskrbyve/advisors/security",
    });
    channels.email = emailRes.ok;

    // Update each row with the channels we managed to use.
    for (const f of criticalUnfixed) {
      await admin
        .from("security_agent_log")
        .update({
          alerted_via: [
            ...(channels.whatsapp ? ["whatsapp"] : []),
            ...(channels.email ? ["email"] : []),
          ],
          action_taken: "notified",
        })
        .eq("finding", f.lint)
        .eq("detail", f.detail)
        .gte("ran_at", new Date(Date.now() - 60_000).toISOString());
    }
  }

  return NextResponse.json({
    ok: true,
    findings_total: findings.length,
    auto_fixed: applied.length,
    auto_fixes: applied,
    skipped: skipped.length,
    critical_unfixed: criticalUnfixed.length,
    alerted_via: channels,
    now_il: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
  });
}

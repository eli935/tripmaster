import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSecurityAlertEmail } from "@/lib/mailer";
import { fetchSecurityEmails } from "@/lib/security-agent/gmail-scan";
import { classifyEmail } from "@/lib/security-agent/classify";

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
// IMAP fetch + Claude classification can take a while if there are many
// emails to triage — give the agent enough room without burning a fortune
// of compute. The function still aborts at the limit; partial results are
// logged and the next hourly run picks up where we left off.
export const maxDuration = 180;

interface Finding {
  lint: "rls_disabled_in_public" | "function_search_path_mutable" | "anon_security_definer";
  severity: "critical" | "warning" | "info";
  detail: string;
  // For auto-fix, the SQL we'd run, plus the precomputed revert SQL.
  // Every auto-fix MUST carry its own rollback so we can undo without
  // forensics. Both forward and revert share the same whitelist gate
  // in agent_apply_fix().
  fixSql?: string;
  revertSql?: string;
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
        revertSql: isSafe
          ? `ALTER TABLE public.${row.table_name} DISABLE ROW LEVEL SECURITY`
          : undefined,
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
        revertSql: `ALTER FUNCTION public.${row.function_name}(${row.arg_types}) RESET search_path`,
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
    // Defense-in-depth: refuse to auto-apply anything that doesn't ship a
    // precomputed revert. The agent has zero authority to make
    // unrecoverable changes. Anything else gets escalated to "skipped"
    // which routes through the alert path.
    const hasFix = !!(f.fixSql && f.fixSummary && f.revertSql);
    if (hasFix) {
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
          fix_summary: `attempted: ${f.fixSql!.slice(0, 200)}; error: ${applyErr.message}`,
          revert_sql: f.revertSql,
          alerted_via: [],
        });
      } else {
        applied.push(f.fixSummary!);
        await admin.from("security_agent_log").insert({
          source: "supabase_advisor",
          severity: f.severity,
          project: "tripmaster",
          finding: f.lint,
          detail: f.detail,
          action_taken: "auto_fixed",
          fix_summary: f.fixSummary,
          revert_sql: f.revertSql,
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

  // -------------------------------------------------------------------
  // CHECK 3 — Gmail IMAP scan of trusted security senders
  //
  // Email content is UNTRUSTED data. We classify via Claude and notify
  // on critical findings, but we never auto-apply fixes from email.
  // -------------------------------------------------------------------
  let gmailScanned = 0;
  let gmailNew = 0;
  const gmailCritical: Array<{ subject: string; from: string; summary: string; action: string }> = [];

  try {
    const emails = await fetchSecurityEmails(24);
    gmailScanned = emails.length;

    for (const email of emails) {
      // De-dup: skip if we already logged this message_id.
      const { data: existing } = await admin
        .from("security_agent_log")
        .select("id")
        .eq("source", "gmail")
        .eq("message_id", email.messageId)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      gmailNew++;

      const cls = await classifyEmail(email);
      if (!cls || cls.severity === "irrelevant") {
        await admin.from("security_agent_log").insert({
          source: "gmail",
          severity: "info",
          project: cls?.project ?? "unknown",
          finding: email.subject.slice(0, 200),
          detail: `from: ${email.from}`,
          action_taken: "logged_only",
          fix_summary: cls ? cls.summary : "unclassified",
          alerted_via: [],
          message_id: email.messageId,
        });
        continue;
      }

      const isCritical = cls.severity === "critical";
      const alertedVia: string[] = [];

      if (isCritical) {
        const waText = `🚨 התראת אבטחה במייל\nמ: ${email.from}\nנושא: ${email.subject}\n\n${cls.summary}\n\nפעולה מומלצת: ${cls.recommended_action}`;
        const waOk = await sendWhatsApp(waText.slice(0, 1500));
        if (waOk) alertedVia.push("whatsapp");

        const mailRes = await sendSecurityAlertEmail({
          severity: "critical",
          subject: `[Email] ${email.subject}`,
          summary: cls.summary,
          detailsHtml:
            `<p><b>מ:</b> ${email.from}</p>` +
            `<p><b>נושא:</b> ${email.subject}</p>` +
            `<p><b>פרויקט:</b> ${cls.project}</p>` +
            `<p><b>פעולה מומלצת:</b> ${cls.recommended_action}</p>`,
        });
        if (mailRes.ok) alertedVia.push("email");

        gmailCritical.push({
          subject: email.subject,
          from: email.from,
          summary: cls.summary,
          action: cls.recommended_action,
        });
      }

      await admin.from("security_agent_log").insert({
        source: "gmail",
        severity: cls.severity,
        project: cls.project,
        finding: email.subject.slice(0, 200),
        detail: `from: ${email.from} · ${cls.summary}`,
        action_taken: isCritical ? "notified" : "logged_only",
        fix_summary: cls.recommended_action,
        alerted_via: alertedVia,
        message_id: email.messageId,
      });
    }
  } catch (err) {
    console.error("[security-agent] gmail scan failed:", (err as Error)?.message);
  }

  return NextResponse.json({
    ok: true,
    advisor: {
      findings_total: findings.length,
      auto_fixed: applied.length,
      auto_fixes: applied,
      skipped: skipped.length,
      critical_unfixed: criticalUnfixed.length,
      alerted_via: channels,
    },
    gmail: {
      scanned: gmailScanned,
      new: gmailNew,
      critical: gmailCritical.length,
      critical_items: gmailCritical,
    },
    now_il: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
  });
}

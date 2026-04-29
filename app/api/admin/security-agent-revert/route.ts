import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/admin/security-agent-revert
 * Body: { log_id: string }
 *
 * Rolls back a single auto-fix applied by the security agent. Calls
 * the SECURITY DEFINER RPC `agent_revert_fix(log_id, actor)`, which:
 *   - reads the precomputed revert_sql from security_agent_log,
 *   - runs it through the same agent_apply_fix() whitelist gate,
 *   - stamps reverted_at + reverted_by on the log row.
 *
 * Auth: super_admin only. The action is recorded with the actor uuid
 * for audit.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { log_id } = (await req.json().catch(() => ({}))) as { log_id?: string };
  if (!log_id) {
    return NextResponse.json({ error: "log_id required" }, { status: 400 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "service role missing" }, { status: 500 });
  }
  const admin = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("agent_revert_fix", {
    p_log_id: log_id,
    p_actor: user.id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reverted: data });
}

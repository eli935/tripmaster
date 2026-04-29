-- =====================================================================
-- security_agent_log — audit trail of every scan + action of the
-- autonomous security agent (/api/cron/security-agent). Service-role
-- only.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.security_agent_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source       TEXT NOT NULL,            -- 'supabase_advisor' | 'gmail' | 'github' | 'manual'
  severity     TEXT NOT NULL,            -- 'critical' | 'warning' | 'info'
  project      TEXT,                     -- 'tripmaster' | 'biglog-bot' | 'scexpert' | NULL
  finding      TEXT NOT NULL,            -- short title / lint name
  detail       TEXT,                     -- full description
  action_taken TEXT NOT NULL,            -- 'auto_fixed' | 'notified' | 'logged_only'
  fix_summary  TEXT,                     -- what was changed
  alerted_via  TEXT[],                   -- e.g. {'whatsapp','email'}
  message_id   TEXT                      -- optional gmail thread id
);

CREATE INDEX IF NOT EXISTS security_agent_log_ran_at_idx
  ON public.security_agent_log (ran_at DESC);
CREATE INDEX IF NOT EXISTS security_agent_log_severity_idx
  ON public.security_agent_log (severity, ran_at DESC);

ALTER TABLE public.security_agent_log ENABLE ROW LEVEL SECURITY;
-- No policies → service_role only (the agent itself).

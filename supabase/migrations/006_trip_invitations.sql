-- ═══════════════════════════════════════════════════════════════════
-- 006 · Trip Invitations
-- Admin-initiated email invitations that create trip_participants on accept.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trip_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,                            -- lowercased on insert
  token        TEXT NOT NULL UNIQUE
                DEFAULT replace(gen_random_uuid()::text, '-', ''),
  status       TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','cancelled','expired')),
  invited_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message      TEXT,                                     -- optional admin message
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ,
  accepted_by  UUID REFERENCES public.profiles(id),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- lowercase email on insert/update for case-insensitive lookup
CREATE OR REPLACE FUNCTION public.lowercase_invitation_email()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.email = lower(NEW.email);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lowercase_email_trg ON public.trip_invitations;
CREATE TRIGGER lowercase_email_trg
  BEFORE INSERT OR UPDATE OF email ON public.trip_invitations
  FOR EACH ROW EXECUTE FUNCTION public.lowercase_invitation_email();

-- Prevent duplicate pending invitations for the same trip+email
CREATE UNIQUE INDEX IF NOT EXISTS trip_invitations_pending_unique
  ON public.trip_invitations (trip_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS trip_invitations_token_idx
  ON public.trip_invitations (token) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS trip_invitations_trip_status_idx
  ON public.trip_invitations (trip_id, status);

-- ───────────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.trip_invitations ENABLE ROW LEVEL SECURITY;

-- Admins (+ super_admin) can see invitations for trips they manage
DROP POLICY IF EXISTS trip_invitations_select ON public.trip_invitations;
CREATE POLICY trip_invitations_select ON public.trip_invitations
  FOR SELECT
  USING (
    public.is_trip_admin(trip_id)
    OR public.is_super_admin()
    -- invitees can see their own invitation by token (via public accept flow)
    OR email = lower(coalesce(
      (SELECT email FROM auth.users WHERE id = auth.uid()), ''
    ))
  );

-- Only trip admins can create invitations
DROP POLICY IF EXISTS trip_invitations_insert ON public.trip_invitations;
CREATE POLICY trip_invitations_insert ON public.trip_invitations
  FOR INSERT
  WITH CHECK (
    (public.is_trip_admin(trip_id) OR public.is_super_admin())
    AND invited_by = auth.uid()
  );

-- Admins can update (cancel / resend) their trip's invitations
DROP POLICY IF EXISTS trip_invitations_update ON public.trip_invitations;
CREATE POLICY trip_invitations_update ON public.trip_invitations
  FOR UPDATE
  USING (public.is_trip_admin(trip_id) OR public.is_super_admin())
  WITH CHECK (public.is_trip_admin(trip_id) OR public.is_super_admin());

-- Admins can delete
DROP POLICY IF EXISTS trip_invitations_delete ON public.trip_invitations;
CREATE POLICY trip_invitations_delete ON public.trip_invitations
  FOR DELETE
  USING (public.is_trip_admin(trip_id) OR public.is_super_admin());

-- ───────────────────────────────────────────────────────────────────
-- Accept helper — called from the accept route with SECURITY DEFINER
-- so the invitee can register themselves as a trip_participant without
-- needing direct INSERT perms on trip_participants (RLS-safe).
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_trip_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_email TEXT;
  v_user_id    UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  SELECT * INTO v_invitation
  FROM public.trip_invitations
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_'||v_invitation.status);
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE public.trip_invitations
      SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Email must match invitee's auth email (case-insensitive)
  IF lower(v_user_email) <> v_invitation.email THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'email_mismatch',
      'invited_email', v_invitation.email
    );
  END IF;

  -- Create the trip_participant row if not exists
  INSERT INTO public.trip_participants (trip_id, profile_id, role, adults, children)
  VALUES (v_invitation.trip_id, v_user_id, 'member', 2, 0)
  ON CONFLICT (trip_id, profile_id) DO NOTHING;

  -- Mark invitation accepted
  UPDATE public.trip_invitations
    SET status      = 'accepted',
        accepted_at = now(),
        accepted_by = v_user_id
    WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'ok', true,
    'trip_id', v_invitation.trip_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.accept_trip_invitation(TEXT) TO authenticated;
